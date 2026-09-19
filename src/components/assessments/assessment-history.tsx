import Link from "next/link";
import { Archive, Eye, EyeOff, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { findValue } from "@/domain/assessments/evolution";
import { ASSESSMENT_KIND_LABEL, inferKind } from "@/domain/assessments/metrics";
import { formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";
import type { AssessmentDetail } from "@/data/assessments";

export function VisibilityBadge({ assessment }: { assessment: { visibleToPatient: boolean; archivedAt: string | null } }) {
  if (assessment.archivedAt) {
    return (
      <Badge variant="outline" className="gap-1 border-transparent bg-muted text-muted-foreground">
        <Archive className="size-3" aria-hidden="true" />
        Arquivada
      </Badge>
    );
  }
  return assessment.visibleToPatient ? (
    <Badge variant="outline" className="gap-1 border-transparent bg-success/10 text-success">
      <Eye className="size-3" aria-hidden="true" />
      Visível ao paciente
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-transparent bg-warning/15 text-warning-foreground">
      <EyeOff className="size-3" aria-hidden="true" />
      Só nutricionista
    </Badge>
  );
}

function metricCell(assessment: AssessmentDetail, code: string): string {
  const value = findValue(assessment, code);
  const unit = assessment.measurements.find((entry) => entry.code === code)?.unit ?? "";
  return value == null ? "—" : formatMetric(value, unit);
}

function muscleOrLean(assessment: AssessmentDetail): string {
  return findValue(assessment, "MUSCLE_MASS") != null ? metricCell(assessment, "MUSCLE_MASS") : metricCell(assessment, "LEAN_MASS");
}

/**
 * Histórico do nutricionista (prompt Fase 9 §31–§32/§47): tabela ≥ md,
 * cards abaixo; mais recente primeiro por `assessment_date`.
 */
export function AssessmentHistory({ patientId, assessments }: { patientId: string; assessments: AssessmentDetail[] }) {
  if (assessments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação registrada.</CardContent>
      </Card>
    );
  }
  const href = (assessment: AssessmentDetail) => `/dashboard/pacientes/${patientId}/avaliacoes/${assessment.id}`;
  return (
    <>
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="pl-4">Data</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">Tipo</TableHead>
              <TableHead scope="col" className="text-right">Peso</TableHead>
              <TableHead scope="col" className="hidden text-right lg:table-cell">Gordura</TableHead>
              <TableHead scope="col" className="hidden text-right xl:table-cell">Massa musc./magra</TableHead>
              <TableHead scope="col">Visibilidade</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">Relatório</TableHead>
              <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.map((assessment) => (
              <TableRow key={assessment.id} className={cn(assessment.archivedAt && "text-muted-foreground")}>
                <TableCell className="pl-4 font-medium">
                  <Link href={href(assessment)} className="hover:underline">
                    {formatCalendarDate(assessment.assessmentDate)}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{ASSESSMENT_KIND_LABEL[inferKind(assessment.measurements.map((entry) => entry.code))]}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{metricCell(assessment, "WEIGHT")}</TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums lg:table-cell">{metricCell(assessment, "BODY_FAT_PCT")}</TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums xl:table-cell">{muscleOrLean(assessment)}</TableCell>
                <TableCell><VisibilityBadge assessment={assessment} /></TableCell>
                <TableCell className="hidden lg:table-cell">
                  {assessment.report ? (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                      Anexado
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button asChild size="xs" variant="outline">
                    <Link href={href(assessment)}>Abrir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ul className="grid gap-2 md:hidden" aria-label="Avaliações">
        {assessments.map((assessment) => (
          <li key={assessment.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-2">
              <Link href={href(assessment)} className="font-medium hover:underline">
                {formatCalendarDate(assessment.assessmentDate)}
              </Link>
              <VisibilityBadge assessment={assessment} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Peso</dt>
                <dd className="font-mono tabular-nums">{metricCell(assessment, "WEIGHT")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gordura</dt>
                <dd className="font-mono tabular-nums">{metricCell(assessment, "BODY_FAT_PCT")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Massa musc./magra</dt>
                <dd className="font-mono tabular-nums">{muscleOrLean(assessment)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Relatório</dt>
                <dd>{assessment.report ? "Anexado" : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
