/**
 * Números de saúde em pt-BR (prompt Fase 9 §7/§51–§52): parsing seguro
 * ("78", "78,5", "78.5", "1.234,56") e formatação sem perder precisão do
 * banco (numeric(10,3)). Nunca `parseFloat` ingênuo.
 */

/**
 * Entrada humana → número com até 3 casas. Aceita vírgula ou ponto como
 * decimal; "1.234,56" (milhar com ponto + vírgula) também. Devolve null
 * quando ambíguo/inválido (quem chama decide a mensagem).
 */
export function parseDecimalPtBr(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "");
  if (cleaned === "") return null;
  let normalized: string;
  if (cleaned.includes(",")) {
    // vírgula é o decimal; pontos são milhar
    if ((cleaned.match(/,/g) ?? []).length > 1) return null;
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // sem vírgula: um único ponto é decimal ("78.5"); vários pontos são milhar ("1.234.567")
    const dots = (cleaned.match(/\./g) ?? []).length;
    normalized = dots > 1 ? cleaned.replace(/\./g, "") : cleaned;
  }
  if (!/^-?\d+(\.\d{1,3})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const formatters = new Map<number, Intl.NumberFormat>();
function formatter(digits: number): Intl.NumberFormat {
  let entry = formatters.get(digits);
  if (!entry) {
    entry = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    formatters.set(digits, entry);
  }
  return entry;
}

/** "78,45", "165", "28,5" — até 3 casas, sem zeros à direita. */
export function formatDecimalPtBr(value: number, maxDigits = 3): string {
  return formatter(maxDigits).format(value);
}

/** Valor + unidade: "78,45 kg", "28,5%", "1.450 kcal". */
export function formatMetric(value: number, unit: string): string {
  const text = formatDecimalPtBr(value);
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

/** Delta com sinal explícito: "+1,2 kg", "−1,5 kg", "0 kg"; % vira p.p. (§34). */
export function formatDelta(delta: number, unit: string): string {
  const abs = formatDecimalPtBr(Math.abs(delta));
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const suffix = unit === "%" ? " p.p." : ` ${unit}`;
  return `${sign}${abs}${suffix}`;
}

/** Diferença exata em centésimos/milésimos sem ruído binário. */
export function subtractPrecise(a: number, b: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(a * factor - b * factor) / factor;
}

/** Texto para input: "78,45" (o banco guarda 78.450). */
export function toInputValue(value: number | null | undefined): string {
  if (value == null) return "";
  return formatDecimalPtBr(value).replace(/\./g, "");
}
