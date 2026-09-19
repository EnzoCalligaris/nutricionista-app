/**
 * Validador central de URL externa (prompt Fase 10 §9/§48/§61): link de
 * compra de suplemento e material de link externo passam por aqui — e só
 * por aqui. Aceita apenas `http:`/`https:` absolutos com host; recusa
 * `javascript:`, `data:`, `file:`, `ftp:`, protocol-relative (`//host`),
 * espaço/controle e credenciais embutidas. Nunca reescreve o link (não
 * "corrige" http para https — só prefere https na mensagem de UX).
 */

export const EXTERNAL_URL_MAX_LENGTH = 2048;

/** `rel` de todo link externo aberto em nova aba (§16/§70). */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

export type ExternalUrlCheck = { ok: true; url: string; secure: boolean } | { ok: false; reason: ExternalUrlError };

export type ExternalUrlError = "EMPTY" | "TOO_LONG" | "INVALID" | "UNSAFE_PROTOCOL" | "MISSING_HOST" | "CREDENTIALS";

export const EXTERNAL_URL_MESSAGE: Record<ExternalUrlError, string> = {
  EMPTY: "Informe o link.",
  TOO_LONG: `O link precisa ter até ${EXTERNAL_URL_MAX_LENGTH} caracteres.`,
  INVALID: "Link inválido. Use um endereço completo começando com https://.",
  UNSAFE_PROTOCOL: "Só links http:// ou https:// são aceitos.",
  MISSING_HOST: "Link inválido. Use um endereço completo começando com https://.",
  CREDENTIALS: "O link não pode conter usuário ou senha.",
};

export function validateExternalUrl(input: string | null | undefined): ExternalUrlCheck {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: false, reason: "EMPTY" };
  if (raw.length > EXTERNAL_URL_MAX_LENGTH) return { ok: false, reason: "TOO_LONG" };
  // Espaço/controle no meio do link nunca é um link válido — e é o vetor de
  // truques como "https://a b" ou quebras de linha.
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: "INVALID" };
  // Protocol-relative é resolvido pelo browser contra a origem atual — nunca aceito.
  if (raw.startsWith("//")) return { ok: false, reason: "UNSAFE_PROTOCOL" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "INVALID" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, reason: "UNSAFE_PROTOCOL" };
  if (!parsed.hostname || !parsed.hostname.includes(".") && parsed.hostname !== "localhost") return { ok: false, reason: "MISSING_HOST" };
  if (parsed.username || parsed.password) return { ok: false, reason: "CREDENTIALS" };

  return { ok: true, url: raw, secure: parsed.protocol === "https:" };
}

/** Host exibido ao lado de um link externo (identificação do destino, §96). */
export function externalUrlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
