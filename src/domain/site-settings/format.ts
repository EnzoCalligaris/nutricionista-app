/**
 * Formatação de valores de contato para exibição. Nada aqui inventa dado:
 * recebe o que está configurado e só apresenta melhor.
 */

import { normalizePhoneE164 } from "@/domain/notifications/phone";

/**
 * Telefone guardado em E.164 (+5511999990001) exibido no formato brasileiro.
 * Número de outro DDI é mostrado como está — não tentamos adivinhar máscara
 * de país que o produto não atende.
 */
export function formatPhoneForDisplay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("+55")) return trimmed;

  const national = trimmed.slice(3);
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return trimmed;
}

/** Link `tel:` a partir do número configurado. */
export function telHref(value: string): string {
  const normalized = normalizePhoneE164(value);
  return normalized.ok ? `tel:${normalized.e164}` : `tel:${value.replace(/[^\d+]/g, "")}`;
}

/** `@usuario` a partir da URL salva do Instagram (ou do próprio handle). */
export function instagramHandle(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("@")) return trimmed;
  try {
    const path = new URL(trimmed).pathname.replace(/^\/+|\/+$/g, "");
    return path ? `@${path}` : undefined;
  } catch {
    return undefined;
  }
}
