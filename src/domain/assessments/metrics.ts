/**
 * Métricas de avaliação (prompt Fase 9 §10–§16). O catálogo real vive em
 * `measurement_types` (banco); aqui ficam as regras puras de apresentação:
 * grupos do formulário, unidades, ranges TÉCNICOS (nunca clínicos), IMC
 * derivado e o "tipo" da avaliação inferido das métricas presentes. Nenhum
 * protocolo, fórmula de dobras ou interpretação automática.
 */

export type MetricGroup = "BASIC" | "COMPOSITION" | "CIRCUMFERENCE";

export type MetricType = {
  id: string;
  code: string;
  name: string;
  unit: string;
  active: boolean;
};

/** Códigos conhecidos pelo app (o catálogo pode ter outros — caem em "COMPOSITION"). */
export const METRIC_GROUP_BY_CODE: Record<string, MetricGroup> = {
  WEIGHT: "BASIC",
  HEIGHT: "BASIC",
  BODY_FAT_PCT: "COMPOSITION",
  FAT_MASS: "COMPOSITION",
  LEAN_MASS: "COMPOSITION",
  MUSCLE_MASS: "COMPOSITION",
  BODY_WATER_PCT: "COMPOSITION",
  VISCERAL_FAT: "COMPOSITION",
  BASAL_METABOLIC_RATE: "COMPOSITION",
  WAIST_CIRCUMFERENCE: "CIRCUMFERENCE",
  ABDOMEN_CIRCUMFERENCE: "CIRCUMFERENCE",
  HIP_CIRCUMFERENCE: "CIRCUMFERENCE",
  CHEST_CIRCUMFERENCE: "CIRCUMFERENCE",
  ARM_CIRCUMFERENCE: "CIRCUMFERENCE",
  THIGH_CIRCUMFERENCE: "CIRCUMFERENCE",
  CALF_CIRCUMFERENCE: "CIRCUMFERENCE",
};

export const METRIC_GROUP_LABEL: Record<MetricGroup, string> = {
  BASIC: "Dados básicos",
  COMPOSITION: "Composição corporal",
  CIRCUMFERENCE: "Medidas corporais",
};

/** Ordem de exibição dentro do formulário/histórico (o resto vem por nome). */
const DISPLAY_ORDER = [
  "WEIGHT",
  "HEIGHT",
  "BODY_FAT_PCT",
  "FAT_MASS",
  "LEAN_MASS",
  "MUSCLE_MASS",
  "BODY_WATER_PCT",
  "VISCERAL_FAT",
  "BASAL_METABOLIC_RATE",
  "WAIST_CIRCUMFERENCE",
  "ABDOMEN_CIRCUMFERENCE",
  "HIP_CIRCUMFERENCE",
  "CHEST_CIRCUMFERENCE",
  "ARM_CIRCUMFERENCE",
  "THIGH_CIRCUMFERENCE",
  "CALF_CIRCUMFERENCE",
];

/** "Circunferência da cintura" → "Cintura" (rótulo curto dentro do grupo Medidas). */
export function shortMetricName(name: string): string {
  const short = name.replace(/^Circunfer[êe]ncia d[aoe]s? /i, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function metricGroup(code: string): MetricGroup {
  return METRIC_GROUP_BY_CODE[code] ?? "COMPOSITION";
}

export function sortMetricTypes<T extends { code: string; name: string }>(types: T[]): T[] {
  return [...types].sort((a, b) => {
    const ia = DISPLAY_ORDER.indexOf(a.code);
    const ib = DISPLAY_ORDER.indexOf(b.code);
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, "pt-BR");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function groupMetricTypes<T extends { code: string; name: string }>(types: T[]): Record<MetricGroup, T[]> {
  const groups: Record<MetricGroup, T[]> = { BASIC: [], COMPOSITION: [], CIRCUMFERENCE: [] };
  for (const type of sortMetricTypes(types)) groups[metricGroup(type.code)].push(type);
  return groups;
}

/** Máximo técnico do numeric(10,3) — nunca um "limite clínico". */
export const MAX_METRIC_VALUE = 9_999_999.999;

/**
 * Range TÉCNICO por unidade: sempre > 0; percentuais ≤ 100. Não existe
 * "peso saudável" aqui (§50) — isso é do nutricionista.
 */
export function validateMetricValue(value: number, unit: string): "OK" | "NOT_POSITIVE" | "PERCENT_OVER_100" | "TOO_LARGE" | "NOT_A_NUMBER" {
  if (!Number.isFinite(value)) return "NOT_A_NUMBER";
  if (value <= 0) return "NOT_POSITIVE";
  if (unit === "%" && value > 100) return "PERCENT_OVER_100";
  if (value > MAX_METRIC_VALUE) return "TOO_LARGE";
  return "OK";
}

export const METRIC_VALIDATION_MESSAGE: Record<Exclude<ReturnType<typeof validateMetricValue>, "OK">, string> = {
  NOT_A_NUMBER: "Informe um número válido (ex.: 78,5).",
  NOT_POSITIVE: "O valor precisa ser maior que zero.",
  PERCENT_OVER_100: "Percentual não pode passar de 100.",
  TOO_LARGE: "Valor acima do limite.",
};

/**
 * IMC derivado (peso em kg, altura em cm), com 1 casa. Só valor — sem faixa
 * ou interpretação (§9). Null quando falta um dos dois.
 */
export function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (weightKg == null || heightCm == null || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export type AssessmentKind = "BIOIMPEDANCE" | "ANTHROPOMETRY" | "GENERAL";

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = {
  BIOIMPEDANCE: "Bioimpedância",
  ANTHROPOMETRY: "Medidas",
  GENERAL: "Geral",
};

/** "Tipo" derivado das métricas presentes (o schema não tem enum — §6). */
export function inferKind(codes: string[]): AssessmentKind {
  if (codes.some((code) => metricGroup(code) === "COMPOSITION")) return "BIOIMPEDANCE";
  if (codes.some((code) => metricGroup(code) === "CIRCUMFERENCE")) return "ANTHROPOMETRY";
  return "GENERAL";
}
