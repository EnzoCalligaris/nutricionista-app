/**
 * Normalização de telefone para E.164 (prompt Fase 12 §26). O cadastro do
 * paciente aceita formatos livres ("(11) 99999-0001", "11 99999 0001",
 * "+55 11 9 9999-0001"); a API oficial do WhatsApp exige o número
 * internacional sem símbolos. Sem DDI assume Brasil (+55), que é o único
 * mercado do produto (docs/PROJECT_SPEC.md). Não valida se o número existe
 * — isso é o provider que responde (INVALID_RECIPIENT, permanente).
 */

export type PhoneNormalization = { ok: true; e164: string } | { ok: false; reason: "EMPTY" | "INVALID" };

const BR_DDI = "55";

export function normalizePhoneE164(raw: string | null | undefined): PhoneNormalization {
  if (!raw) return { ok: false, reason: "EMPTY" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "EMPTY" };
  // Só dígitos; um "+" inicial marca DDI explícito.
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "INVALID" };
  // "011 9..." — prefixo de discagem nacional (0 + DDD): descarta UM zero à esquerda.
  if (!hasPlus && digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);

  let national: string;
  if (hasPlus) {
    if (!digits.startsWith(BR_DDI)) {
      // DDI estrangeiro: aceita como está se tiver tamanho plausível (E.164: até 15 dígitos).
      if (digits.length < 8 || digits.length > 15) return { ok: false, reason: "INVALID" };
      return { ok: true, e164: `+${digits}` };
    }
    national = digits.slice(BR_DDI.length);
  } else if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith(BR_DDI)) return { ok: false, reason: "INVALID" };
    national = digits.slice(BR_DDI.length);
  } else {
    national = digits;
  }

  // Brasil: DDD (2 dígitos, 11–99) + 8 (fixo) ou 9 (celular, começa com 9) dígitos.
  if (national.length !== 10 && national.length !== 11) return { ok: false, reason: "INVALID" };
  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) return { ok: false, reason: "INVALID" };
  const subscriber = national.slice(2);
  if (subscriber.length === 9 && subscriber[0] !== "9") return { ok: false, reason: "INVALID" };
  if (/^(\d)\1+$/.test(subscriber)) return { ok: false, reason: "INVALID" };
  return { ok: true, e164: `+${BR_DDI}${national}` };
}

/** Mascara para logs/UI operacional: "+55 11 •••••-0001" (nunca o número completo desnecessariamente — §90). */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  return `${e164.startsWith("+") ? "+" : ""}${digits.slice(0, 4)} •••• ${digits.slice(-4)}`;
}

/** "e••••@dominio.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}••••${email.slice(at)}`;
}
