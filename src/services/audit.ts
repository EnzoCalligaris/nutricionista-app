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
  | "CONTRACT_COMPLETED";

/**
 * Auditoria append-only (`audit_logs`, Fase 2) escrita pela aplicação a
 * partir da Fase 5 (prompt §49). Metadata é o mínimo para rastrear "quem fez
 * o quê" — nunca dado sensível completo (nem e-mail, nem telefone, nem
 * nascimento): só identificadores e campos alterados por NOME.
 *
 * A policy exige `actor_id = auth.uid()` e role NUTRITIONIST, então usamos
 * o cliente de sessão (não o admin). Uma falha ao auditar é logada no
 * servidor e NÃO desfaz a operação de negócio (não há transação cobrindo as
 * duas escritas) — decisão registrada em docs/DECISIONS.md.
 */
export async function recordAudit(input: {
  actorId: string;
  action: AuditAction;
  entityType: "patient" | "contract";
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
