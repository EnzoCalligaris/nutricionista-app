import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { canArchiveSupplement, canDeactivateSupplement, canEditSupplement, canReactivateSupplement } from "@/domain/patient-content/supplements";
import { getSupplementById, type SupplementDetail } from "@/data/supplements";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import { recordNotificationEvent } from "@/services/notifications";
import type { SupplementInput } from "@/validators/patient-content";

/**
 * Casos de uso das recomendações de suplemento (prompt Fase 10 §64). O
 * sistema só registra e apresenta a orientação do nutricionista (§1):
 * ownership reconferido no servidor além da RLS; auditoria só com ids e
 * status — nunca produto, dose ou orientação (§54).
 */

async function requireOwnedSupplement(nutritionistId: string, supplementId: string): Promise<SupplementDetail> {
  const supplement = await getSupplementById(supplementId);
  if (!supplement) throw new DomainError("SUPPLEMENT_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, supplement.patientId);
  return supplement;
}

function toRow(input: SupplementInput) {
  return {
    name: input.name,
    brand: input.brand ?? null,
    instructions: input.instructions ?? null,
    dose_text: input.doseText ?? null,
    schedule_text: input.scheduleText ?? null,
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    notes: input.notes ?? null,
    purchase_url: input.purchaseUrl ?? null,
  };
}

export async function createSupplement(nutritionistId: string, patientId: string, input: SupplementInput): Promise<{ supplementId: string }> {
  await requireOwnedPatient(nutritionistId, patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplement_recommendations")
    .insert({ patient_id: patientId, created_by: nutritionistId, active: true, ...toRow(input) })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: nutritionistId,
    action: "SUPPLEMENT_RECOMMENDATION_CREATED",
    entityType: "supplement_recommendation",
    entityId: data.id,
    metadata: { patient_id: patientId, has_purchase_url: input.purchaseUrl != null, has_period: input.startsOn != null || input.endsOn != null },
  });
  await recordNotificationEvent({ type: "SUPPLEMENT_RECOMMENDATION_CREATED", entityType: "supplement_recommendation", entityId: data.id });
  return { supplementId: data.id };
}

export async function updateSupplement(nutritionistId: string, supplementId: string, input: SupplementInput): Promise<{ patientId: string }> {
  const supplement = await requireOwnedSupplement(nutritionistId, supplementId);
  if (!canEditSupplement(supplement)) throw new DomainError("SUPPLEMENT_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("supplement_recommendations").update(toRow(input)).eq("id", supplementId);
  if (error) throw domainErrorFromDatabase(error);
  const changed = (Object.keys(toRow(input)) as (keyof ReturnType<typeof toRow>)[]).filter((key) => {
    const before = { name: supplement.name, brand: supplement.brand, instructions: supplement.instructions, dose_text: supplement.doseText, schedule_text: supplement.scheduleText, starts_on: supplement.startsOn, ends_on: supplement.endsOn, notes: supplement.notes, purchase_url: supplement.purchaseUrl }[key];
    return before !== toRow(input)[key];
  });
  await recordAudit({
    actorId: nutritionistId,
    action: "SUPPLEMENT_RECOMMENDATION_UPDATED",
    entityType: "supplement_recommendation",
    entityId: supplementId,
    metadata: { patient_id: supplement.patientId, changed_fields: changed },
  });
  return { patientId: supplement.patientId };
}

/** Encerrar (active = false): paciente deixa de ver; histórico preservado; reativação explícita (§13). */
export async function deactivateSupplement(nutritionistId: string, supplementId: string): Promise<{ patientId: string }> {
  const supplement = await requireOwnedSupplement(nutritionistId, supplementId);
  if (!canDeactivateSupplement(supplement)) throw new DomainError(supplement.archivedAt ? "SUPPLEMENT_ARCHIVED" : "INVALID_STATUS_TRANSITION");
  const supabase = await createClient();
  const { error } = await supabase.from("supplement_recommendations").update({ active: false }).eq("id", supplementId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "SUPPLEMENT_RECOMMENDATION_DEACTIVATED", entityType: "supplement_recommendation", entityId: supplementId, metadata: { patient_id: supplement.patientId } });
  return { patientId: supplement.patientId };
}

export async function reactivateSupplement(nutritionistId: string, supplementId: string): Promise<{ patientId: string }> {
  const supplement = await requireOwnedSupplement(nutritionistId, supplementId);
  if (!canReactivateSupplement(supplement)) throw new DomainError(supplement.archivedAt ? "SUPPLEMENT_ARCHIVED" : "INVALID_STATUS_TRANSITION");
  const supabase = await createClient();
  const { error } = await supabase.from("supplement_recommendations").update({ active: true }).eq("id", supplementId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "SUPPLEMENT_RECOMMENDATION_REACTIVATED", entityType: "supplement_recommendation", entityId: supplementId, metadata: { patient_id: supplement.patientId } });
  return { patientId: supplement.patientId };
}

/** Arquivar (§14): sai do portal e vira só leitura; a linha nunca é apagada (o banco também recusa DELETE). */
export async function archiveSupplement(nutritionistId: string, supplementId: string): Promise<{ patientId: string }> {
  const supplement = await requireOwnedSupplement(nutritionistId, supplementId);
  if (!canArchiveSupplement(supplement)) throw new DomainError("SUPPLEMENT_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("supplement_recommendations").update({ archived_at: new Date().toISOString(), archived_by: nutritionistId, active: false }).eq("id", supplementId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "SUPPLEMENT_RECOMMENDATION_ARCHIVED", entityType: "supplement_recommendation", entityId: supplementId, metadata: { patient_id: supplement.patientId, was_active: supplement.active } });
  return { patientId: supplement.patientId };
}
