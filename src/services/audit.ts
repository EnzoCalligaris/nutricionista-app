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
  | "BIOIMPEDANCE_REPORT_REMOVED"
  | "SUPPLEMENT_RECOMMENDATION_CREATED"
  | "SUPPLEMENT_RECOMMENDATION_UPDATED"
  | "SUPPLEMENT_RECOMMENDATION_DEACTIVATED"
  | "SUPPLEMENT_RECOMMENDATION_REACTIVATED"
  | "SUPPLEMENT_RECOMMENDATION_ARCHIVED"
  | "FEEDBACK_CREATED"
  | "FEEDBACK_UPDATED"
  | "FEEDBACK_PUBLISHED"
  | "FEEDBACK_ARCHIVED"
  | "FEEDBACK_DELETED"
  | "MATERIAL_CREATED"
  | "MATERIAL_UPDATED"
  | "MATERIAL_ARCHIVED"
  | "MATERIAL_ASSIGNED"
  | "MATERIAL_UNASSIGNED"
  | "MATERIAL_FILE_UPLOADED"
  | "MATERIAL_FILE_REMOVED"
  | "MEAL_AI_CONSENT_ACCEPTED"
  | "MEAL_AI_CONSENT_REVOKED"
  | "MEAL_PHOTO_UPLOADED"
  | "MEAL_ANALYSIS_REQUESTED"
  | "MEAL_ANALYSIS_COMPLETED"
  | "MEAL_ANALYSIS_FAILED"
  | "MEAL_ANALYSIS_CONFIRMED"
  | "MEAL_ANALYSIS_UPDATED"
  | "MEAL_ANALYSIS_REOPENED"
  | "MEAL_ANALYSIS_ARCHIVED"
  | "NOTIFICATION_RETRY_REQUESTED"
  | "NOTIFICATION_SETTINGS_UPDATED"
  | "APPOINTMENT_CONFIRMATION_REQUESTED"
  | "PAYMENT_CHARGE_CREATED"
  | "PAYMENT_CHARGE_CANCELLED"
  | "PAYMENT_RECONCILIATION_REQUESTED"
  | "PAYMENT_REVIEW_RESOLVED"
  // --- Fase 14 (prompt §52) ----------------------------------------------
  | "SETTINGS_UPDATED"
  | "PUBLIC_PROFILE_UPDATED"
  | "SITE_ASSET_UPLOADED"
  | "SITE_ASSET_REMOVED"
  | "PLAN_UPDATED"
  | "PLAN_PRICE_CREATED"
  | "PLAN_PRICE_UPDATED"
  | "PLAN_PRICE_PRIMARY_SET"
  | "PLAN_BENEFIT_CREATED"
  | "PLAN_BENEFIT_UPDATED"
  | "PLAN_BENEFIT_REORDERED"
  | "RESULT_CREATED"
  | "RESULT_UPDATED"
  | "RESULT_IMAGE_UPLOADED"
  | "RESULT_PUBLISHED"
  | "RESULT_UNPUBLISHED"
  | "RESULT_ARCHIVED"
  | "RESULT_RESTORED"
  | "MEDIA_CONSENT_REGISTERED"
  | "MEDIA_CONSENT_REVOKED"
  | "BLOG_POST_CREATED"
  | "BLOG_POST_UPDATED"
  | "BLOG_POST_PUBLISHED"
  | "BLOG_POST_UNPUBLISHED"
  | "BLOG_POST_ARCHIVED"
  | "BLOG_POST_SLUG_CHANGED";

/**
 * Auditoria append-only (`audit_logs`, Fase 2) escrita pela aplicação a
 * partir da Fase 5 (prompt §49). Metadata é o mínimo para rastrear "quem fez
 * o quê" — nunca dado sensível completo (nem e-mail, nem telefone, nem
 * nascimento): só identificadores e campos alterados por NOME.
 *
 * A policy exige `actor_id = auth.uid()` (role NUTRITIONIST, ou PATIENT só
 * para `entity_type = 'appointment'` — Fase 6 — e para
 * `food_photo_analysis`/`patient_consent` — Fase 11), então usamos o cliente de
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
    | "assessment"
    | "supplement_recommendation"
    | "feedback_message"
    | "patient_material"
    | "material_assignment"
    | "food_photo_analysis"
    | "patient_consent"
    | "notification_delivery"
    | "notification_preferences"
    | "payment_charge"
    | "payment_reconciliation"
    | "site_settings"
    | "plan"
    | "plan_price"
    | "plan_benefit"
    | "before_after_result"
    | "media_consent"
    | "blog_post";
  /**
   * `null` para entidade sem id de linha — o caso de `site_settings`, que é
   * key/value global. A coluna `audit_logs.entity_id` é nullable desde a
   * Fase 2.
   */
  entityId: string | null;
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
