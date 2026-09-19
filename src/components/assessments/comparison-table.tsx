import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DirectionTag } from "@/components/assessments/trend-cards";
import { compareAssessments, type AssessmentSummary } from "@/domain/assessments/evolution";
import { sortMetricTypes } from "@/domain/assessments/metrics";
import { formatDelta, formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";

/**
 * Comparação A → B (prompt Fase 9 §33–§35): valor em A, valor em B,
 * diferença com sinal e unidade (percentual em p.p.) e direção descritiva.
 * Sem "melhorou/piorou".
 */
export function ComparisonTable({ a, b }: { a: AssessmentSummary; b: AssessmentSummary }) {
  const rows = sortMetricTypes(compareAssessments(a, b));
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">As duas avaliações não têm métricas registradas.</CardContent>
      </Card>
    );
  }
  return (
    <>
      <Card className="hidden py-0 sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="pl-4">Métrica</TableHead>
              <TableHead scope="col" className="text-right">{formatCalendarDate(a.assessmentDate)}</TableHead>
              <TableHead scope="col" className="text-right">{formatCalendarDate(b.assessmentDate)}</TableHead>
              <TableHead scope="col" className="text-right">Diferença</TableHead>
              <TableHead scope="col" className="pr-4">Direção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="pl-4 font-medium">{row.name}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.from == null ? "—" : formatMetric(row.from, row.unit)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.to == null ? "—" : formatMetric(row.to, row.unit)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.delta == null ? "—" : formatDelta(row.delta, row.unit)}</TableCell>
                <TableCell className="pr-4">{row.direction ? <DirectionTag direction={row.direction} /> : <span className="text-xs text-muted-foreground">sem par</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ul className="grid gap-2 sm:hidden" aria-label="Comparação por métrica">
        {rows.map((row) => (
          <li key={row.code} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <p className="font-medium">{row.name}</p>
            <p className="font-mono text-sm tabular-nums">
              {row.from == null ? "—" : formatMetric(row.from, row.unit)} → {row.to == null ? "—" : formatMetric(row.to, row.unit)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono font-medium tabular-nums">{row.delta == null ? "—" : formatDelta(row.delta, row.unit)}</span>
              {row.direction ? <DirectionTag direction={row.direction} /> : <span className="text-xs text-muted-foreground">sem par</span>}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
