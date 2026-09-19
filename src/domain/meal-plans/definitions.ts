/**
 * Cardápio / plano alimentar — definições puras (prompt Fase 8).
 *
 * - PLANO (`meal_plans`): container por paciente; no máximo um plano ativo
 *   (não arquivado) por paciente. A evolução normal é por VERSÃO.
 * - VERSÃO (`meal_plan_versions`): DRAFT (editável) → PUBLISHED (o que o
 *   paciente vê; só uma por plano) → ARCHIVED (histórico, imutável).
 *   Publicar uma nova versão arquiva a anterior — nunca sobrescreve.
 * - DIA (`meal_plan_days`): um por dia da semana (0 = domingo … 6 =
 *   sábado, mesma convenção da agenda); o plano pode ser parcial.
 * - REFEIÇÃO (`meals`): nome livre, horário opcional, ordem explícita.
 * - ALIMENTO (`meal_items`): nome, quantidade + unidade, observação,
 *   preparo; calorias/macros só quando informados manualmente (nunca
 *   calculados nesta fase).
 * - SUBSTITUIÇÃO (`meal_substitutions`): alternativa cadastrada
 *   explicitamente pelo nutricionista para um alimento — sem equivalência
 *   nutricional automática.
 */

export type MealPlanVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const VERSION_STATUS_LABEL: Record<MealPlanVersionStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

/** 0 = domingo … 6 = sábado (convenção do banco e da agenda). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

/** Ordem de exibição da semana: segunda a domingo (PROJECT_SPEC "SEG–DOM"). */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/** Posição do dia na semana exibida (segunda = 0 … domingo = 6). */
export function weekPosition(weekday: Weekday): number {
  return WEEK_ORDER.indexOf(weekday);
}

/**
 * Unidades de quantidade aceitas (texto controlado; sem cálculo). Cada uma
 * tem singular/plural para a leitura "2 fatias", "1 unidade", "100 g".
 */
export const UNIT_OPTIONS = [
  { value: "g", singular: "g", plural: "g", spaced: true },
  { value: "ml", singular: "ml", plural: "ml", spaced: true },
  { value: "unidade", singular: "unidade", plural: "unidades", spaced: true },
  { value: "fatia", singular: "fatia", plural: "fatias", spaced: true },
  { value: "colher de sopa", singular: "colher de sopa", plural: "colheres de sopa", spaced: true },
  { value: "colher de chá", singular: "colher de chá", plural: "colheres de chá", spaced: true },
  { value: "xícara", singular: "xícara", plural: "xícaras", spaced: true },
  { value: "copo", singular: "copo", plural: "copos", spaced: true },
  { value: "porção", singular: "porção", plural: "porções", spaced: true },
  { value: "concha", singular: "concha", plural: "conchas", spaced: true },
  { value: "pedaço", singular: "pedaço", plural: "pedaços", spaced: true },
  { value: "prato", singular: "prato", plural: "pratos", spaced: true },
  { value: "punhado", singular: "punhado", plural: "punhados", spaced: true },
  { value: "pitada", singular: "pitada", plural: "pitadas", spaced: true },
  { value: "a gosto", singular: "a gosto", plural: "a gosto", spaced: true },
] as const;

export type UnitValue = (typeof UNIT_OPTIONS)[number]["value"];

export const UNIT_VALUES: readonly string[] = UNIT_OPTIONS.map((unit) => unit.value);

export function isKnownUnit(value: string): value is UnitValue {
  return UNIT_VALUES.includes(value);
}

/** Máximos técnicos para os campos numéricos (numeric(10,2) no banco). */
export const MAX_QUANTITY = 99_999.99;
export const MAX_NUTRIENT = 99_999.99;
