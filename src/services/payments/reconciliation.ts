import "server-only";

import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/services/audit";
import { reconcilePendingCharges, expireStaleCharges } from "@/services/payments/webhook";

/**
 * Reconciliação operada por gente (prompt Fase 13 §53–§57/§82). Divergência
 * nunca é "corrigida" automaticamente: o nutricionista lê o caso, resolve no
 * mundo real (painel do provedor, devolução, pagamento manual) e marca o
 * item como resolvido — com auditoria. Dinheiro não some.
 */

export async function resolveReconciliationItem(nutritionistId: string, itemId: string, note: string | null, outcome: "RESOLVED" | "IGNORED"): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_reconciliation_items")
    .update({ status: outcome, resolved_at: new Date().toISOString(), resolved_by: nutritionistId, resolution_note: note?.trim() || null })
    .eq("id", itemId)
    .eq("nutritionist_id", nutritionistId)
    .eq("status", "OPEN")
    .select("id, kind, charge_id")
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) throw new DomainError("PAYMENT_NOT_FOUND");

  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_REVIEW_RESOLVED",
    entityType: "payment_reconciliation",
    entityId: itemId,
    metadata: { kind: data.kind, charge_id: data.charge_id, outcome, has_note: Boolean(note?.trim()) },
  });
}

export type ReconciliationRunSummary = { expired: number; checked: number; opened: number; confirmed: number };

/** Conferência manual disparada pelo nutricionista (mesma rotina do job). */
export async function runReconciliation(nutritionistId: string): Promise<ReconciliationRunSummary> {
  const expire = await expireStaleCharges();
  const reconcile = await reconcilePendingCharges({ limit: 50 });
  await recordAudit({
    actorId: nutritionistId,
    action: "PAYMENT_RECONCILIATION_REQUESTED",
    entityType: "payment_reconciliation",
    entityId: nutritionistId,
    metadata: { expired: expire.expired, checked: reconcile.checked, opened: reconcile.opened, confirmed: reconcile.confirmed },
  });
  return { ...expire, ...reconcile };
}

/**
 * Varredura de integridade entre cobrança e financeiro (§53): cobrança PAID
 * sem `payments` vinculado. É a checagem que não depende do provider —
 * pega estado parcial que nunca deveria existir.
 */
export async function detectPaidWithoutPayment(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("payment_charges").select("id, patient_id, nutritionist_id, amount_cents").eq("status", "PAID").is("payment_id", null).limit(100);
  let opened = 0;
  for (const charge of data ?? []) {
    const { error } = await admin.from("payment_reconciliation_items").insert({
      nutritionist_id: charge.nutritionist_id,
      patient_id: charge.patient_id,
      charge_id: charge.id,
      kind: "PAID_WITHOUT_PAYMENT",
      detail: { amount_cents: charge.amount_cents },
    });
    if (!error) opened += 1;
  }
  return opened;
}
