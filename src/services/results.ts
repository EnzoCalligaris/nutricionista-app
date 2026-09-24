import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { recordAudit } from "@/services/audit";
import { requireOwnedPatient } from "@/services/patients";
import { getDashboardResult, type DashboardResult } from "@/data/results";
import { publicDisplayName, type NameDisplayMode } from "@/domain/results/display";
import { CONSENT_FIXED_FIELDS, resultImageSchema, type MediaConsentInput, type ResultInput } from "@/validators/results";

/**
 * Casos de uso dos resultados antes/depois (prompt Fase 14 §27–§38).
 *
 * Regras que NÃO são negociáveis aqui:
 * - publicar passa pela função SQL `publish_before_after_result`, que confere
 *   imagens + consentimento VÁLIDO numa transação (§29/§47/§70);
 * - o nome público é DERIVADO do nome real do paciente no formato
 *   autorizado — nunca digitado (§36/§91);
 * - o bucket `before-after` é privado e continua privado; a entrega ao
 *   visitante é feita pela rota server-side (§32/§33);
 * - apagar é exceção: arquivar preserva o histórico (§37).
 */

export const RESULT_BUCKET = "before-after";
/** URL assinada só existe DENTRO do servidor, por poucos segundos (§33). */
export const RESULT_SIGNED_URL_SECONDS = 30;

export async function requireOwnedResult(nutritionistId: string, resultId: string): Promise<DashboardResult> {
  const result = await getDashboardResult(resultId);
  // A RLS já filtra por dono; a checagem explícita deixa a regra visível.
  if (!result) throw new DomainError("RESULT_NOT_FOUND");
  void nutritionistId;
  return result;
}

/**
 * Nome público a gravar: derivado do paciente + modo do consentimento.
 * Sem paciente vinculado, o resultado é sempre anônimo — a aplicação não
 * tem de onde tirar um nome, e não inventa.
 */
async function resolveDisplayName(
  patientId: string | null,
  consentMode: NameDisplayMode | null,
  patientName: string | null,
): Promise<string | null> {
  if (!patientId || !consentMode) return null;
  return publicDisplayName(patientName, consentMode) ?? null;
}

export async function createResult(nutritionistId: string, input: ResultInput): Promise<{ resultId: string }> {
  if (input.patientId) await requireOwnedPatient(nutritionistId, input.patientId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("before_after_results")
    .insert({
      nutritionist_id: nutritionistId,
      patient_id: input.patientId,
      title: input.title,
      description: input.description,
      period: input.period,
      image_alt: input.imageAlt,
      sort_order: input.sortOrder,
      published: false,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_CREATED",
    entityType: "before_after_result",
    entityId: data.id,
    // Sem título nem depoimento no log (§53): só ids e flags.
    metadata: { has_patient: input.patientId !== null, sort_order: input.sortOrder },
  });

  return { resultId: data.id };
}

export async function updateResult(nutritionistId: string, resultId: string, input: ResultInput): Promise<void> {
  const result = await requireOwnedResult(nutritionistId, resultId);
  if (result.archivedAt) throw new DomainError("RESULT_ARCHIVED");
  if (input.patientId) await requireOwnedPatient(nutritionistId, input.patientId);

  // Trocar de paciente invalida o consentimento anexado (que é de outra
  // pessoa): o vínculo é desfeito e o resultado despublicado, em vez de
  // ficar publicado com consentimento alheio.
  const patientChanged = (result.patientId ?? null) !== input.patientId;
  const dropConsent = patientChanged && result.consent !== null;

  const displayName = await resolveDisplayName(
    input.patientId,
    dropConsent ? null : result.consent?.nameDisplayMode ?? null,
    patientChanged ? null : result.patientName,
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("before_after_results")
    .update({
      patient_id: input.patientId,
      title: input.title,
      description: input.description,
      period: input.period,
      image_alt: input.imageAlt,
      sort_order: input.sortOrder,
      ...(dropConsent ? { media_consent_id: null, published: false, published_at: null, published_by: null } : {}),
      ...(patientChanged ? { display_name: displayName } : {}),
    })
    .eq("id", resultId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_UPDATED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: {
      changed_fields: [
        ...(result.title !== input.title ? ["title"] : []),
        ...((result.description ?? null) !== input.description ? ["description"] : []),
        ...((result.period ?? null) !== input.period ? ["period"] : []),
        ...((result.imageAlt ?? null) !== input.imageAlt ? ["image_alt"] : []),
        ...(result.sortOrder !== input.sortOrder ? ["sort_order"] : []),
        ...(patientChanged ? ["patient_id"] : []),
      ],
      consent_detached: dropConsent,
    },
  });
}

/** Assinaturas de imagem aceitas — o MIME informado pelo browser não vale (§87). */
function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const MIME_TO_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/**
 * Sobe a foto de antes/depois. Path sempre `<result_id>/<uuid>.<ext>` — nunca
 * o nome original do arquivo (que poderia conter o nome do paciente) e nunca
 * um path vindo do cliente (§56).
 */
export async function uploadResultImage(
  nutritionistId: string,
  resultId: string,
  slot: "before" | "after",
  file: File,
): Promise<void> {
  const result = await requireOwnedResult(nutritionistId, resultId);
  if (result.archivedAt) throw new DomainError("RESULT_ARCHIVED");

  const meta = resultImageSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (!meta.success) throw new DomainError("RESULT_IMAGE_INVALID");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new DomainError("RESULT_IMAGE_INVALID");

  const path = `${resultId}/${randomUUID()}.${MIME_TO_EXT[mime]}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(RESULT_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[results] upload falhou:", uploadError.message);
    throw new DomainError("RESULT_UPLOAD_FAILED");
  }

  const previousPath = slot === "before" ? result.beforePath : result.afterPath;
  const { error } = await supabase
    .from("before_after_results")
    .update(slot === "before" ? { before_path: path } : { after_path: path })
    .eq("id", resultId);
  if (error) {
    await supabase.storage.from(RESULT_BUCKET).remove([path]);
    throw domainErrorFromDatabase(error);
  }

  // Só remove a anterior depois de a nova estar gravada na linha.
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(RESULT_BUCKET).remove([previousPath]);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_IMAGE_UPLOADED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: { slot, mime, bytes: file.size, replaced: previousPath !== null },
  });
}

/**
 * Registra o consentimento de uso de imagem e o anexa ao resultado. A
 * finalidade (`consent_type`) e a versão do texto são fixadas pela aplicação
 * — o formulário não escolhe (§30). `granted_by` é o nutricionista
 * autenticado, nunca um ator vindo do client (§56).
 */
export async function registerMediaConsent(
  nutritionistId: string,
  resultId: string,
  input: MediaConsentInput,
): Promise<{ consentId: string }> {
  const result = await requireOwnedResult(nutritionistId, resultId);
  if (result.archivedAt) throw new DomainError("RESULT_ARCHIVED");
  const patient = await requireOwnedPatient(nutritionistId, input.patientId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_consents")
    .insert({
      patient_id: input.patientId,
      consent_type: CONSENT_FIXED_FIELDS.consentType,
      consent_version: CONSENT_FIXED_FIELDS.consentVersion,
      name_display_mode: input.nameDisplayMode,
      evidence_reference: input.evidenceReference,
      granted_by: nutritionistId,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  const displayName = publicDisplayName(patient.full_name, input.nameDisplayMode) ?? null;

  const { error: linkError } = await supabase
    .from("before_after_results")
    .update({ patient_id: input.patientId, media_consent_id: data.id, display_name: displayName })
    .eq("id", resultId);
  if (linkError) throw domainErrorFromDatabase(linkError);

  await recordAudit({
    actorId: nutritionistId,
    action: "MEDIA_CONSENT_REGISTERED",
    entityType: "media_consent",
    entityId: data.id,
    // Sem o texto da evidência (pode citar pessoas): só ids, versão e modo.
    metadata: {
      result_id: resultId,
      patient_id: input.patientId,
      consent_type: CONSENT_FIXED_FIELDS.consentType,
      consent_version: CONSENT_FIXED_FIELDS.consentVersion,
      name_display_mode: input.nameDisplayMode,
    },
  });

  return { consentId: data.id };
}

/**
 * Revoga o consentimento. O resultado sai do site NA HORA porque a policy
 * pública chama `has_valid_media_consent()` — nenhuma edição manual do
 * resultado é necessária (§31). `published` continua como estava de
 * propósito: o histórico do que foi publicado é preservado, e o dashboard
 * mostra "fora do ar — consentimento revogado".
 */
export async function revokeMediaConsent(nutritionistId: string, consentId: string, reason: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_media_consent", { p_consent_id: consentId, p_reason: reason ?? undefined });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "MEDIA_CONSENT_REVOKED",
    entityType: "media_consent",
    entityId: consentId,
    metadata: { has_reason: reason !== null },
  });
}

export async function publishResult(nutritionistId: string, resultId: string): Promise<void> {
  await requireOwnedResult(nutritionistId, resultId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_before_after_result", { p_result_id: resultId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_PUBLISHED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: { published: true },
  });
}

export async function unpublishResult(nutritionistId: string, resultId: string): Promise<void> {
  await requireOwnedResult(nutritionistId, resultId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_before_after_result", { p_result_id: resultId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_UNPUBLISHED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: { published: false },
  });
}

export async function archiveResult(nutritionistId: string, resultId: string): Promise<void> {
  await requireOwnedResult(nutritionistId, resultId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_before_after_result", { p_result_id: resultId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_ARCHIVED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: { archived: true },
  });
}

export async function restoreResult(nutritionistId: string, resultId: string): Promise<void> {
  await requireOwnedResult(nutritionistId, resultId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_before_after_result", { p_result_id: resultId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "RESULT_RESTORED",
    entityType: "before_after_result",
    entityId: resultId,
    metadata: { archived: false },
  });
}

/**
 * URL assinada de curta duração para o PREVIEW do dashboard (§38). Nunca
 * persistida e nunca logada; o nutricionista já tem acesso ao bucket pela
 * policy `before_after_select_nutritionist`.
 */
export async function signResultImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RESULT_BUCKET).createSignedUrl(path, RESULT_SIGNED_URL_SECONDS);
  if (error) {
    console.error("[results] assinatura de URL falhou:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Bytes da imagem para a ROTA PÚBLICA. A elegibilidade é decidida pelo BANCO
 * (`public_result_image_path`, que exige published + não arquivado +
 * consentimento válido): se a função não devolver path, a rota responde 404.
 * O service role é usado só para LER o objeto do bucket privado depois dessa
 * autorização — nunca para contornar a regra (§32/§33).
 */
export async function readPublicResultImage(
  resultId: string,
  slot: "before" | "after",
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const { createPublicClient } = await import("@/lib/supabase/public");
  const anon = createPublicClient();
  const { data: path, error } = await anon.rpc("public_result_image_path", { p_result_id: resultId, p_slot: slot });
  if (error) {
    console.error("[results] elegibilidade pública falhou:", error.message);
    return null;
  }
  if (!path) return null;

  const admin = createAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(RESULT_BUCKET).download(path);
  if (downloadError || !blob) {
    console.error("[results] download da imagem pública falhou:", downloadError?.message ?? "sem corpo");
    return null;
  }

  return { bytes: await blob.arrayBuffer(), contentType: blob.type || "application/octet-stream" };
}
