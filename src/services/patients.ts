import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { getPatientById, type PatientRow } from "@/data/patients";
import { canArchivePatient, canReactivatePatient } from "@/domain/patients/status";
import { derivePortalAccess, type PortalAccessStatus } from "@/domain/patients/portal-access";
import { invitePatientToPortal, getPortalAuthUser } from "@/services/onboarding";
import { recordAudit } from "@/services/audit";
import type { CreatePatientInput, UpdatePatientInput } from "@/validators/patients";

/**
 * Casos de uso de paciente (prompt Fase 5 §45). Toda função recebe o
 * `nutritionistId` já autenticado pela action (`requireNutritionist()`) e
 * revalida ownership no banco antes de qualquer escrita — nunca confia em
 * `patient_id` vindo do client (§1). A RLS continua como camada final.
 */

/** Carrega o paciente garantindo que pertence ao nutricionista. */
export async function requireOwnedPatient(nutritionistId: string, patientId: string): Promise<PatientRow> {
  const patient = await getPatientById(nutritionistId, patientId);
  if (!patient) throw new DomainError("PATIENT_NOT_FOUND");
  // Defesa em profundidade: a query já filtrou por nutritionist_id e a RLS
  // já esconderia a linha, mas a checagem explícita torna a regra visível.
  if (patient.nutritionist_id !== nutritionistId) throw new DomainError("PATIENT_NOT_AUTHORIZED");
  return patient;
}

async function assertEmailAvailable(nutritionistId: string, email: string, exceptPatientId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id")
    .eq("nutritionist_id", nutritionistId)
    .ilike("email", email);
  if (exceptPatientId) query = query.neq("id", exceptPatientId);
  const { data, error } = await query.limit(1);
  if (error) throw domainErrorFromDatabase(error);
  if (data && data.length > 0) throw new DomainError("PATIENT_EMAIL_ALREADY_EXISTS");
}

export type CreatePatientResult = {
  patientId: string;
  /** Presente só quando o convite foi solicitado. */
  invite?: { sent: true } | { sent: false; reason: "INVITE_NOT_SENT" };
};

/**
 * Cadastro de paciente (§12–§15). Paciente existe SEM conta Auth por
 * padrão (`profile_id` null); o convite é opcional e reutiliza
 * `invitePatientToPortal` (Fase 3). Se o convite falhar depois que o
 * paciente foi salvo (ex.: já existe conta Auth para o e-mail), o cadastro
 * é mantido e o resultado informa que o convite não saiu — nunca cria
 * duplicidade nem finge sucesso.
 */
export async function createPatient(nutritionistId: string, input: CreatePatientInput): Promise<CreatePatientResult> {
  const supabase = await createClient();

  if (input.email) await assertEmailAvailable(nutritionistId, input.email);

  const { data, error } = await supabase
    .from("patients")
    .insert({
      nutritionist_id: nutritionistId,
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      birth_date: input.birthDate ?? null,
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "PATIENT_CREATED",
    entityType: "patient",
    entityId: data.id,
    metadata: { with_invite: input.sendInvite },
  });

  if (!input.sendInvite || !input.email) {
    return { patientId: data.id };
  }

  try {
    await invitePatientToPortal({ nutritionistId, email: input.email, fullName: input.fullName });
    await recordAudit({ actorId: nutritionistId, action: "PATIENT_INVITED", entityType: "patient", entityId: data.id });
    return { patientId: data.id, invite: { sent: true } };
  } catch (error) {
    if (error instanceof DomainError && (error.code === "INVITE_NOT_SENT" || error.code === "PATIENT_ALREADY_LINKED")) {
      return { patientId: data.id, invite: { sent: false, reason: "INVITE_NOT_SENT" } };
    }
    throw error;
  }
}

/**
 * Edição de dados de negócio (§16). `patients.email` é o e-mail de CONTATO —
 * alterá-lo não muda o e-mail de login do Supabase Auth (§17, documentado em
 * docs/DECISIONS.md). role/profile_id/nutritionist_id/ids nunca passam por
 * aqui: o payload é construído campo a campo a partir do schema validado.
 */
export async function updatePatient(nutritionistId: string, patientId: string, input: UpdatePatientInput): Promise<void> {
  const current = await requireOwnedPatient(nutritionistId, patientId);
  if (input.email) await assertEmailAvailable(nutritionistId, input.email, patientId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      birth_date: input.birthDate ?? null,
    })
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId);

  if (error) throw domainErrorFromDatabase(error);

  const changedFields = (["full_name", "email", "phone", "birth_date"] as const).filter((field) => {
    const next = field === "full_name" ? input.fullName : field === "email" ? input.email ?? null : field === "phone" ? input.phone ?? null : input.birthDate ?? null;
    return current[field] !== next;
  });

  await recordAudit({
    actorId: nutritionistId,
    action: "PATIENT_UPDATED",
    entityType: "patient",
    entityId: patientId,
    // Só os NOMES dos campos alterados — nunca os valores (dado pessoal).
    metadata: { changed_fields: changedFields },
  });
}

/**
 * Desativação (§18–§20): `status = INACTIVE` + `archived_at`. Nada é
 * apagado — contratos, parcelas, pagamentos, consultas e histórico ficam.
 * Não usa cascade, não usa DELETE (a tabela nem tem policy de delete).
 */
export async function archivePatient(nutritionistId: string, patientId: string): Promise<void> {
  const patient = await requireOwnedPatient(nutritionistId, patientId);
  if (!canArchivePatient(patient.status)) throw new DomainError("PATIENT_INVALID_STATUS");

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ status: "INACTIVE", archived_at: new Date().toISOString() })
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({ actorId: nutritionistId, action: "PATIENT_ARCHIVED", entityType: "patient", entityId: patientId });
}

/**
 * Reativação (§19): o schema suporta (`status` é o override administrativo
 * da Fase 2) — volta a ACTIVE e limpa `archived_at`. Se não houver contrato
 * vigente, o paciente aparece como "Sem contrato" até um novo contrato.
 */
export async function reactivatePatient(nutritionistId: string, patientId: string): Promise<void> {
  const patient = await requireOwnedPatient(nutritionistId, patientId);
  if (!canReactivatePatient(patient.status)) throw new DomainError("PATIENT_INVALID_STATUS");

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ status: "ACTIVE", archived_at: null })
    .eq("id", patientId)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({ actorId: nutritionistId, action: "PATIENT_REACTIVATED", entityType: "patient", entityId: patientId });
}

/** "Enviar convite" a partir do perfil de um paciente cadastrado sem conta. */
export async function invitePatientFromProfile(nutritionistId: string, patientId: string): Promise<void> {
  const patient = await requireOwnedPatient(nutritionistId, patientId);
  if (patient.profile_id) throw new DomainError("PATIENT_ALREADY_LINKED");
  if (!patient.email) throw new DomainError("VALIDATION_ERROR", "Cadastre um e-mail antes de enviar o convite.");

  await invitePatientToPortal({ nutritionistId, email: patient.email, fullName: patient.full_name });
  await recordAudit({ actorId: nutritionistId, action: "PATIENT_INVITED", entityType: "patient", entityId: patientId });
}

/** Status do acesso ao portal (§24) — só após ownership confirmado. */
export async function getPatientPortalAccess(patient: Pick<PatientRow, "profile_id">): Promise<PortalAccessStatus> {
  if (!patient.profile_id) return "NO_ACCOUNT";
  const authUser = await getPortalAuthUser(patient.profile_id);
  return derivePortalAccess({ profileId: patient.profile_id, authUser });
}
