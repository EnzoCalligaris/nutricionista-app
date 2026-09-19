import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { MATERIAL_MAX_BYTES, MATERIAL_MIME_TO_EXT, canArchiveMaterial, canAssignMaterial, canEditMaterial, safeFileDisplayName } from "@/domain/patient-content/materials";
import { findAssignment, getAssignmentById, getMaterialById, getVisibleMaterialForPatient, type MaterialDetail } from "@/data/materials";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import { recordNotificationEvent } from "@/services/notifications";
import type { MaterialInput, MaterialUpdateInput } from "@/validators/patient-content";

/**
 * Casos de uso dos materiais (prompt Fase 10 §64): MATERIAL reutilizável
 * (arquivo no bucket privado `patient-documents` ou link externo) separado
 * da ATRIBUIÇÃO ao paciente. Ownership reconferido no servidor além da RLS;
 * path seguro `<material_id>/<uuid>.<ext>` (nunca nome de paciente nem nome
 * original); tipo conferido pela assinatura do arquivo; entrega por URL
 * assinada de curta duração, nunca persistida nem logada; auditoria só com
 * ids, mime e tamanho — nunca o nome do arquivo (§56).
 */

export const MATERIAL_BUCKET = "patient-documents";
export const SIGNED_URL_SECONDS = 60;

export async function requireOwnedMaterial(nutritionistId: string, materialId: string): Promise<MaterialDetail> {
  const material = await getMaterialById(materialId);
  if (!material) throw new DomainError("MATERIAL_NOT_FOUND");
  // A query de sessão já é filtrada pela RLS; a checagem explícita torna a regra visível.
  if (material.nutritionistId !== nutritionistId) throw new DomainError("MATERIAL_NOT_AUTHORIZED");
  return material;
}

/** Assinaturas de arquivo aceitas (o MIME do browser não é confiável, §39). */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf"; // %PDF-
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  return null;
}

/**
 * Cria o material. Link: pronto para atribuir. Arquivo: a linha nasce
 * primeiro (o bucket só autoriza a escrita para `<material_id>/…` de material
 * do nutricionista), o objeto é enviado e os metadados gravados; se o upload
 * falhar, a linha (nunca atribuída) é removida — nada fica "pela metade".
 */
export async function createMaterial(nutritionistId: string, input: MaterialInput, file: File | null): Promise<{ materialId: string }> {
  const supabase = await createClient();
  if (input.kind === "FILE" && !file) throw new DomainError("INVALID_MATERIAL_FILE");
  const { data, error } = await supabase
    .from("patient_materials")
    .insert({
      nutritionist_id: nutritionistId,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      external_url: input.kind === "LINK" ? input.externalUrl : null,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_CREATED", entityType: "patient_material", entityId: data.id, metadata: { kind: input.kind, has_description: input.description != null } });

  if (input.kind === "FILE" && file) {
    try {
      await storeFile(nutritionistId, data.id, file, null);
    } catch (uploadError) {
      await supabase.from("patient_materials").delete().eq("id", data.id);
      throw uploadError;
    }
  }
  return { materialId: data.id };
}

export async function updateMaterial(nutritionistId: string, materialId: string, input: MaterialUpdateInput): Promise<void> {
  const material = await requireOwnedMaterial(nutritionistId, materialId);
  if (!canEditMaterial(material)) throw new DomainError("MATERIAL_ARCHIVED");
  if (material.kind === "LINK" && !input.externalUrl) throw new DomainError("INVALID_EXTERNAL_URL");
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_materials")
    .update({
      title: input.title,
      description: input.description ?? null,
      ...(material.kind === "LINK" ? { external_url: input.externalUrl } : {}),
    })
    .eq("id", materialId);
  if (error) throw domainErrorFromDatabase(error);
  const changed = [
    ...(material.title !== input.title ? ["title"] : []),
    ...((material.description ?? null) !== (input.description ?? null) ? ["description"] : []),
    ...(material.kind === "LINK" && material.externalUrl !== input.externalUrl ? ["external_url"] : []),
  ];
  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_UPDATED", entityType: "patient_material", entityId: materialId, metadata: { changed_fields: changed } });
}

/** Envia (ou substitui) o arquivo de um material de arquivo; o anterior só é removido após o novo estar gravado. */
export async function replaceMaterialFile(nutritionistId: string, materialId: string, file: File): Promise<void> {
  const material = await requireOwnedMaterial(nutritionistId, materialId);
  if (!canEditMaterial(material)) throw new DomainError("MATERIAL_ARCHIVED");
  if (material.kind !== "FILE") throw new DomainError("INVALID_MATERIAL_FILE");
  await storeFile(nutritionistId, materialId, file, material.storagePath);
}

async function storeFile(nutritionistId: string, materialId: string, file: File, previousPath: string | null): Promise<void> {
  if (file.size <= 0 || file.size > MATERIAL_MAX_BYTES) throw new DomainError("INVALID_MATERIAL_FILE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime || !(mime in MATERIAL_MIME_TO_EXT)) throw new DomainError("INVALID_MATERIAL_FILE");
  const path = `${materialId}/${randomUUID()}.${MATERIAL_MIME_TO_EXT[mime]!}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from(MATERIAL_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[materials] upload falhou:", uploadError.message);
    throw new DomainError("MATERIAL_UPLOAD_FAILED");
  }
  const { error } = await supabase
    .from("patient_materials")
    .update({ storage_path: path, mime_type: mime, file_name: safeFileDisplayName(file.name), file_size_bytes: bytes.byteLength })
    .eq("id", materialId);
  if (error) {
    await supabase.storage.from(MATERIAL_BUCKET).remove([path]);
    throw domainErrorFromDatabase(error);
  }
  if (previousPath) {
    const { error: removeError } = await supabase.storage.from(MATERIAL_BUCKET).remove([previousPath]);
    if (removeError) console.error("[materials] arquivo anterior não removido:", removeError.message);
    await recordAudit({ actorId: nutritionistId, action: "MATERIAL_FILE_REMOVED", entityType: "patient_material", entityId: materialId, metadata: { replaced: true } });
  }
  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_FILE_UPLOADED", entityType: "patient_material", entityId: materialId, metadata: { mime, size_bytes: bytes.byteLength, replaced: previousPath !== null } });
}

/** Arquivar (§44): sai do portal mesmo com atribuições ativas, não é reatribuído; histórico administrativo permanece. O objeto NÃO é apagado (dado preservado). */
export async function archiveMaterial(nutritionistId: string, materialId: string): Promise<void> {
  const material = await requireOwnedMaterial(nutritionistId, materialId);
  if (!canArchiveMaterial(material)) throw new DomainError("MATERIAL_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("patient_materials").update({ archived_at: new Date().toISOString(), archived_by: nutritionistId }).eq("id", materialId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_ARCHIVED", entityType: "patient_material", entityId: materialId, metadata: { kind: material.kind } });
}

/** Atribui a um paciente próprio (§41); reatribuir um revogado reativa a mesma linha (única por par). */
export async function assignMaterial(nutritionistId: string, materialId: string, patientId: string): Promise<{ assignmentId: string }> {
  const material = await requireOwnedMaterial(nutritionistId, materialId);
  await requireOwnedPatient(nutritionistId, patientId);
  if (!canAssignMaterial(material)) throw new DomainError(material.archivedAt ? "MATERIAL_ARCHIVED" : "MATERIAL_INCOMPLETE");
  const supabase = await createClient();
  const existing = await findAssignment(materialId, patientId);
  let assignmentId: string;
  if (existing) {
    if (existing.revokedAt === null) throw new DomainError("MATERIAL_ALREADY_ASSIGNED");
    const { error } = await supabase.from("material_assignments").update({ revoked_at: null }).eq("id", existing.id);
    if (error) throw domainErrorFromDatabase(error);
    assignmentId = existing.id;
  } else {
    const { data, error } = await supabase.from("material_assignments").insert({ material_id: materialId, patient_id: patientId, assigned_by: nutritionistId }).select("id").single();
    if (error || !data) throw domainErrorFromDatabase(error);
    assignmentId = data.id;
  }
  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_ASSIGNED", entityType: "material_assignment", entityId: assignmentId, metadata: { material_id: materialId, patient_id: patientId, reassigned: existing !== null } });
  await recordNotificationEvent({ type: "MATERIAL_ASSIGNED", entityType: "material_assignment", entityId: assignmentId });
  return { assignmentId };
}

/** Remove a atribuição (§43): `revoked_at`; o material global permanece; o paciente perde o acesso (tabela + bucket). */
export async function unassignMaterial(nutritionistId: string, assignmentId: string): Promise<{ patientId: string; materialId: string }> {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw new DomainError("MATERIAL_ASSIGNMENT_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, assignment.patientId);
  if (assignment.material.nutritionistId !== nutritionistId) throw new DomainError("MATERIAL_NOT_AUTHORIZED");
  if (assignment.revokedAt) throw new DomainError("MATERIAL_ASSIGNMENT_NOT_FOUND");
  const supabase = await createClient();
  const { error } = await supabase.from("material_assignments").update({ revoked_at: new Date().toISOString(), revoked_by: nutritionistId }).eq("id", assignmentId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "MATERIAL_UNASSIGNED", entityType: "material_assignment", entityId: assignmentId, metadata: { material_id: assignment.materialId, patient_id: assignment.patientId } });
  return { patientId: assignment.patientId, materialId: assignment.materialId };
}

/** URL assinada de curta duração para o nutricionista (ownership no servidor). */
export async function signMaterialForNutritionist(nutritionistId: string, materialId: string): Promise<{ url: string; name: string }> {
  const material = await requireOwnedMaterial(nutritionistId, materialId);
  if (!material.storagePath) throw new DomainError("MATERIAL_NOT_FOUND");
  return signObject(material.storagePath, material.fileName ?? "material");
}

/** URL assinada para o paciente (§46): só material atribuído a si, não revogado, não arquivado (a RLS do bucket repete a regra). */
export async function signMaterialForPatient(patientId: string, materialId: string): Promise<{ url: string; name: string }> {
  const assignment = await getVisibleMaterialForPatient(patientId, materialId);
  if (!assignment) throw new DomainError("MATERIAL_NOT_ASSIGNED");
  if (!assignment.material.storagePath) throw new DomainError("MATERIAL_NOT_FOUND");
  return signObject(assignment.material.storagePath, assignment.material.fileName ?? "material");
}

async function signObject(path: string, name: string): Promise<{ url: string; name: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(MATERIAL_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, { download: name });
  if (error || !data?.signedUrl) throw new DomainError("MATERIAL_NOT_FOUND");
  return { url: data.signedUrl, name };
}
