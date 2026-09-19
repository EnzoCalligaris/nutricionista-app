import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AuditAction =
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "PATIENT_ARCHIVED"
  | "PATIENT_REACTIVATED"
  | "PATIENT_INVITED"
  | "CONTRACT_CREATED"
  | "CONTRACT_CANCELLED"
  | "CONTRACT_COMPLETED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_UPDATED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_NO_SHOW"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_RESCHEDULED"
  | "BLOCKED_TIME_CREATED"
  | "BLOCKED_TIME_REMOVED"
  | "AVAILABILITY_UPDATED"
  | "SCHEDULING_SETTINGS_UPDATED"
  | "FINANCIAL_TRANSACTION_CREATED"
  | "FINANCIAL_TRANSACTION_UPDATED"
  | "FINANCIAL_TRANSACTION_CANCELLED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_CANCELLED"
  | "INSTALLMENT_PAYMENT_APPLIED"
  | "MEAL_PLAN_CREATED"
  | "MEAL_PLAN_UPDATED"
  | "MEAL_PLAN_VERSION_CREATED"
  | "MEAL_PLAN_VERSION_PUBLISHED"
  | "MEAL_PLAN_VERSION_DISCARDED"
  | "MEAL_PLAN_ARCHIVED"
  | "MEAL_DUPLICATED"
  | "MEAL_PLAN_DAY_DUPLICATED"
  | "ASSESSMENT_CREATED"
  | "ASSESSMENT_UPDATED"
  | "ASSESSMENT_PUBLISHED"
  | "ASSESSMENT_UNPUBLISHED"
  | "ASSESSMENT_ARCHIVED"
  | "ASSESSMENT_DELETED"
  | "BIOIMPEDANCE_REPORT_UPLOADED"
  | "BIOIMPEDANCE_REPORT_REMOVED";

/**
 * Auditoria append-only (`audit_logs`, Fase 2) escrita pela aplicação a
 * partir da Fase 5 (prompt §49). Metadata é o mínimo para rastrear "quem fez
 * o quê" — nunca dado sensível completo (nem e-mail, nem telefone, nem
 * nascimento): só identificadores e campos alterados por NOME.
 *
 * A policy exige `actor_id = auth.uid()` (role NUTRITIONIST, ou PATIENT só
 * para `entity_type = 'appointment'` — Fase 6), então usamos o cliente de
 * sessão (não o admin): o ator é sempre quem está autenticado. Uma falha ao auditar é logada no
 * servidor e NÃO desfaz a operação de negócio (não há transação cobrindo as
 * duas escritas) — decisão registrada em docs/DECISIONS.md.
 */
export async function recordAudit(input: {
  actorId: string;
  action: AuditAction;
  entityType:
    | "patient"
    | "contract"
    | "appointment"
    | "blocked_time"
    | "availability"
    | "scheduling_settings"
    | "financial_transaction"
    | "payment"
    | "installment"
    | "meal_plan"
    | "meal_plan_version"
    | "assessment";
  entityId: string;
  metadata?: Record<string, Json>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ?? null,
  });
  if (error) {
    console.error(`[audit] falha ao registrar ${input.action} em ${input.entityType}/${input.entityId}: ${error.message}`);
  }
}
