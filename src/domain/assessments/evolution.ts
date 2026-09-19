import { subtractPrecise } from "@/domain/assessments/numbers";

/**
 * Evolução e comparação (prompt Fase 9 §31–§42): ordenação por
 * `assessment_date` (nunca `created_at`), séries por métrica sem inventar
 * zero para valor ausente, variação entre avaliações e comparação A x B com
 * deltas descritivos (subiu/desceu/sem alteração) — sem interpretação
 * clínica.
 */

export type MeasurementValue = { code: string; name: string; unit: string; value: number };

export type AssessmentSummary = {
  id: string;
  assessmentDate: string; // YYYY-MM-DD
  visibleToPatient: boolean;
  archivedAt: string | null;
  hasReport: boolean;
  measurements: MeasurementValue[];
  createdAt: string;
};

/** Mais recente primeiro; empate de data pela criação mais recente. */
export function sortByDateDesc<T extends { assessmentDate: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate) || b.createdAt.localeCompare(a.createdAt));
}

export function sortByDateAsc<T extends { assessmentDate: string; createdAt: string }>(items: T[]): T[] {
  return sortByDateDesc(items).reverse();
}

export function findValue(assessment: { measurements: MeasurementValue[] }, code: string): number | null {
  return assessment.measurements.find((entry) => entry.code === code)?.value ?? null;
}

export type Direction = "UP" | "DOWN" | "SAME";

export const DIRECTION_LABEL: Record<Direction, string> = { UP: "subiu", DOWN: "desceu", SAME: "sem alteração" };

export type MetricDelta = {
  code: string;
  name: string;
  unit: string;
  from: number | null;
  to: number | null;
  /** Diferença (to − from); null quando falta um dos lados. */
  delta: number | null;
  direction: Direction | null;
};

export function deltaBetween(from: number | null, to: number | null): { delta: number | null; direction: Direction | null } {
  if (from == null || to == null) return { delta: null, direction: null };
  const delta = subtractPrecise(to, from);
  return { delta, direction: delta > 0 ? "UP" : delta < 0 ? "DOWN" : "SAME" };
}

/**
 * Comparação A (anterior) → B (posterior): união das métricas dos dois
 * lados; delta só quando ambos têm valor. Percentual: delta em p.p. (§34).
 */
export function compareAssessments(a: AssessmentSummary, b: AssessmentSummary): MetricDelta[] {
  const byCode = new Map<string, { name: string; unit: string }>();
  for (const entry of [...a.measurements, ...b.measurements]) byCode.set(entry.code, { name: entry.name, unit: entry.unit });
  return [...byCode.entries()].map(([code, meta]) => {
    const from = findValue(a, code);
    const to = findValue(b, code);
    return { code, name: meta.name, unit: meta.unit, from, to, ...deltaBetween(from, to) };
  });
}

/**
 * Variação da última avaliação em relação à anterior COM a mesma métrica
 * (§40): "primeira avaliação" quando não há baseline (§41).
 */
export type MetricTrend = {
  code: string;
  name: string;
  unit: string;
  current: number;
  currentDate: string;
  previous: number | null;
  previousDate: string | null;
  delta: number | null;
  direction: Direction | null;
  first: boolean;
};

export function trendForMetric(assessments: AssessmentSummary[], code: string): MetricTrend | null {
  const withMetric = sortByDateDesc(assessments.filter((assessment) => findValue(assessment, code) != null));
  const latest = withMetric[0];
  if (!latest) return null;
  const meta = latest.measurements.find((entry) => entry.code === code)!;
  const previous = withMetric[1] ?? null;
  const current = findValue(latest, code)!;
  const previousValue = previous ? findValue(previous, code) : null;
  return {
    code,
    name: meta.name,
    unit: meta.unit,
    current,
    currentDate: latest.assessmentDate,
    previous: previousValue,
    previousDate: previous?.assessmentDate ?? null,
    ...deltaBetween(previousValue, current),
    first: previous === null,
  };
}

export type SeriesPoint = { date: string; value: number; assessmentId: string };

/**
 * Série de uma métrica em ordem cronológica. Avaliação sem a métrica
 * simplesmente não entra (nunca vira zero — §42/§73).
 */
export function seriesForMetric(assessments: AssessmentSummary[], code: string): SeriesPoint[] {
  return sortByDateAsc(assessments)
    .map((assessment) => ({ date: assessment.assessmentDate, value: findValue(assessment, code), assessmentId: assessment.id }))
    .filter((point): point is SeriesPoint => point.value != null);
}

/** Métricas que não fazem sentido como série (altura é praticamente constante). */
export const NON_CHARTABLE_CODES = new Set(["HEIGHT"]);

/** Métricas que têm pelo menos `min` pontos — só essas viram gráfico (§36). */
export function chartableMetrics(assessments: AssessmentSummary[], min = 2): { code: string; name: string; unit: string; points: number }[] {
  const meta = new Map<string, { name: string; unit: string; points: number }>();
  for (const assessment of assessments) {
    for (const entry of assessment.measurements) {
      if (NON_CHARTABLE_CODES.has(entry.code)) continue;
      const current = meta.get(entry.code) ?? { name: entry.name, unit: entry.unit, points: 0 };
      current.points += 1;
      meta.set(entry.code, current);
    }
  }
  return [...meta.entries()].filter(([, value]) => value.points >= min).map(([code, value]) => ({ code, ...value }));
}

/** Última avaliação (por data) e a anterior a ela. */
export function latestAndPrevious<T extends { assessmentDate: string; createdAt: string }>(assessments: T[]): { latest: T | null; previous: T | null } {
  const sorted = sortByDateDesc(assessments);
  return { latest: sorted[0] ?? null, previous: sorted[1] ?? null };
}

/** Regra de visibilidade do paciente (espelha a RLS): visível e não arquivada. */
export function isVisibleToPatient(assessment: { visibleToPatient: boolean; archivedAt: string | null }): boolean {
  return assessment.visibleToPatient && assessment.archivedAt === null;
}

/** Delete físico só para avaliação nunca exibida ao paciente (§29). */
export function canHardDelete(assessment: { publishedAt: string | null; archivedAt: string | null }): boolean {
  return assessment.publishedAt === null && assessment.archivedAt === null;
}
