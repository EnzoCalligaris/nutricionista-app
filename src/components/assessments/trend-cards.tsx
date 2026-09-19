import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DIRECTION_LABEL, trendForMetric, type AssessmentSummary, type Direction } from "@/domain/assessments/evolution";
import { formatDelta, formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";

const DEFAULT_CODES = ["WEIGHT", "BODY_FAT_PCT", "MUSCLE_MASS", "LEAN_MASS", "WAIST_CIRCUMFERENCE"];

/** Ícone + texto: cor nunca é o único sinal (§90); sem juízo clínico (§35). */
export function DirectionTag({ direction }: { direction: Direction }) {
  const Icon = direction === "UP" ? ArrowUp : direction === "DOWN" ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {DIRECTION_LABEL[direction]}
    </span>
  );
}

/**
 * Resumo da evolução (prompt Fase 9 §40–§41): valor atual, anterior e
 * diferença por métrica principal; "Primeira avaliação" quando não há
 * baseline. Só métricas presentes nas avaliações.
 */
export function TrendCards({ assessments, codes = DEFAULT_CODES, limit = 4 }: { assessments: AssessmentSummary[]; codes?: string[]; limit?: number }) {
  const trends = codes.map((code) => trendForMetric(assessments, code)).filter((trend) => trend !== null).slice(0, limit);
  if (trends.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {trends.map((trend) => (
        <Card key={trend.code} size="sm">
          <CardHeader>
            <CardDescription>{trend.name}</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{formatMetric(trend.current, trend.unit)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>Em {formatCalendarDate(trend.currentDate)}</p>
            {trend.first || trend.delta == null || trend.direction == null ? (
              <p className="font-medium text-foreground">Primeira avaliação com esta métrica</p>
            ) : (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-medium text-foreground tabular-nums">{formatDelta(trend.delta, trend.unit)}</span>
                <DirectionTag direction={trend.direction} />
                <span>vs {formatMetric(trend.previous!, trend.unit)} em {formatCalendarDate(trend.previousDate!)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
