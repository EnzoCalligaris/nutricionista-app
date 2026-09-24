/**
 * Como um resultado antes/depois se apresenta publicamente (prompt Fase 14
 * §36/§85). Regra dura: NENHUM nome é inventado. O nome exibido é sempre
 * DERIVADO do nome real do paciente no formato que ele autorizou — nunca um
 * texto livre digitado pelo nutricionista, e nunca um nome quando o
 * resultado não tem paciente vinculado.
 */

export type NameDisplayMode = "ANONYMOUS" | "FIRST_NAME" | "INITIALS" | "FULL_NAME";

export const NAME_DISPLAY_MODES: readonly NameDisplayMode[] = ["ANONYMOUS", "FIRST_NAME", "INITIALS", "FULL_NAME"];

export const NAME_DISPLAY_LABELS: Record<NameDisplayMode, string> = {
  ANONYMOUS: "Anônimo (nenhum nome aparece)",
  FIRST_NAME: "Primeiro nome",
  INITIALS: "Iniciais",
  FULL_NAME: "Nome completo",
};

function nameTokens(fullName: string): string[] {
  return fullName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Nome público a partir do nome real e do modo autorizado. Retorna
 * `undefined` para anônimo, para nome vazio e para resultado sem paciente.
 */
export function publicDisplayName(fullName: string | null | undefined, mode: NameDisplayMode): string | undefined {
  if (mode === "ANONYMOUS") return undefined;
  const tokens = nameTokens(fullName ?? "");
  if (tokens.length === 0) return undefined;

  if (mode === "FULL_NAME") return tokens.join(" ");
  if (mode === "FIRST_NAME") return tokens[0];

  // INITIALS: "Maria Aparecida Souza" -> "M. A. S."
  return tokens.map((token) => `${token[0]!.toUpperCase()}.`).join(" ");
}

/**
 * Texto alternativo das imagens (§85). Nunca expõe nome, data de
 * nascimento, medida ou diagnóstico: descreve a imagem e o momento
 * (antes/depois). Quando o nutricionista escreve um alt próprio, ele é
 * usado — a UI avisa para não incluir dado sensível.
 */
export function resultImageAlt(slot: "before" | "after", customAlt: string | null | undefined): string {
  const custom = (customAlt ?? "").trim();
  const moment = slot === "before" ? "antes" : "depois";
  if (custom) return `${custom} — ${moment} do acompanhamento`;
  return `Foto de ${moment} do acompanhamento nutricional, publicada com autorização`;
}
