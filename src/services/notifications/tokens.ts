import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { evaluateToken, isWellFormedToken, type TokenPurpose } from "@/domain/notifications/tokens";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tokens de ação por link (prompt Fase 12 §20/§93–§95): 32 bytes aleatórios
 * (base64url) no link; no banco só `sha256(token || pimenta)`. Propósito
 * único, expiram, uso único e consumo ATÔMICO (`update … where used_at is
 * null returning`) — duplo clique/replay nunca executa duas vezes. Leitura
 * e escrita só pelo service role: a tabela não tem policy nenhuma.
 *
 * O token NUNCA é logado nem persistido em `variables`/`notifications`.
 */

function pepper(): string {
  const env = getServerEnv();
  if (env.NOTIFICATIONS_TOKEN_SECRET) return env.NOTIFICATIONS_TOKEN_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NOTIFICATIONS_TOKEN_SECRET é obrigatória em produção para tokens de confirmação por link.");
  }
  // Dev/teste: pimenta fixa e claramente não secreta (o hash continua sendo sha256 de 256 bits aleatórios).
  return "dev-only-pepper";
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(`${raw}:${pepper()}`).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createAppointmentConfirmToken(input: {
  appointmentId: string;
  patientId: string;
  deliveryId: string | null;
  expiresAt: Date;
}): Promise<string> {
  const admin = createAdminClient();
  const raw = generateRawToken();
  // Um reenvio da mesma entrega invalida o link anterior (um link vivo por entrega).
  if (input.deliveryId) {
    await admin.from("notification_action_tokens").update({ used_at: new Date().toISOString() }).eq("delivery_id", input.deliveryId).is("used_at", null);
  }
  const { error } = await admin.from("notification_action_tokens").insert({
    token_hash: hashToken(raw),
    purpose: "APPOINTMENT_CONFIRM" satisfies TokenPurpose,
    appointment_id: input.appointmentId,
    patient_id: input.patientId,
    delivery_id: input.deliveryId,
    expires_at: input.expiresAt.toISOString(),
  });
  if (error) throw new Error(`[notifications] falha ao criar token de confirmação: ${error.code ?? "?"}`);
  return raw;
}

export type ConsumeTokenResult =
  | { ok: true; appointmentId: string; patientId: string }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" | "WRONG_PURPOSE" | "MALFORMED" };

/**
 * Consome o token (uso único). A comparação é pelo hash indexado; o
 * `timingSafeEqual` extra protege contra comparação de hash por tempo no
 * caso improvável de colisão de prefixo.
 */
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<ConsumeTokenResult> {
  if (!isWellFormedToken(raw)) return { ok: false, reason: "MALFORMED" };
  const admin = createAdminClient();
  const hash = hashToken(raw);
  const now = new Date();
  const { data: claimed } = await admin
    .from("notification_action_tokens")
    .update({ used_at: now.toISOString() })
    .eq("token_hash", hash)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("token_hash, appointment_id, patient_id")
    .maybeSingle();
  if (claimed && timingSafeEqual(Buffer.from(claimed.token_hash), Buffer.from(hash))) {
    return { ok: true, appointmentId: claimed.appointment_id, patientId: claimed.patient_id };
  }
  // Não consumiu: descobre o motivo sem revelar mais do que "expirou/usado/não existe".
  const { data: existing } = await admin.from("notification_action_tokens").select("purpose, expires_at, used_at").eq("token_hash", hash).maybeSingle();
  const verdict = evaluateToken(existing, purpose, now);
  if (verdict === "VALID") return { ok: false, reason: "USED" }; // corrida: outro request consumiu entre as duas queries
  return { ok: false, reason: verdict };
}
