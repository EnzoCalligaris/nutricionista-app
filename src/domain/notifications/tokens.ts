/**
 * Regras puras dos tokens de ação por link (prompt Fase 12 §20/§93–§95):
 * propósito único, expiram, uso único. A geração/hash (crypto) e a
 * persistência ficam no service (`src/services/notifications/tokens.ts`);
 * aqui só a decisão sobre validade, testável sem banco.
 */

export const TOKEN_PURPOSES = ["APPOINTMENT_CONFIRM"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

/** Token de confirmação vale até a hora da consulta, limitado a 7 dias — o lembrete sai 5 dias antes. */
export const CONFIRM_TOKEN_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function confirmTokenExpiresAt(input: { now: Date; appointmentStartsAt: Date }): Date {
  const cap = input.now.getTime() + CONFIRM_TOKEN_MAX_TTL_MS;
  return new Date(Math.min(cap, input.appointmentStartsAt.getTime()));
}

export type TokenRecordLike = { purpose: string; expires_at: string; used_at: string | null };

export type TokenVerdict = "VALID" | "EXPIRED" | "USED" | "WRONG_PURPOSE";

export function evaluateToken(record: TokenRecordLike | null, expectedPurpose: TokenPurpose, now: Date): TokenVerdict | "NOT_FOUND" {
  if (!record) return "NOT_FOUND";
  if (record.purpose !== expectedPurpose) return "WRONG_PURPOSE";
  if (record.used_at) return "USED";
  if (new Date(record.expires_at).getTime() <= now.getTime()) return "EXPIRED";
  return "VALID";
}

/** Formato do token na URL: base64url de 32 bytes aleatórios (43 chars). Rejeita qualquer outra coisa antes de tocar o banco. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export function isWellFormedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
