import Link from "next/link";
import { GitCompare, Plus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentHistory } from "@/components/assessments/assessment-history";
import { EvolutionCharts } from "@/components/assessments/evolution-charts";
import { TrendCards } from "@/components/assessments/trend-cards";
import { latestAndPrevious } from "@/domain/assessments/evolution";
import type { AssessmentDetail } from "@/data/assessments";
import { formatCalendarDate } from "@/lib/dates";

/**
 * Aba Avaliações do perfil (prompt Fase 9 §3): última avaliação, resumo da
 * evolução (só avaliações ativas), gráficos, histórico completo (arquivadas
 * incluídas), comparação e relatórios.
 */
export function PatientAssessmentsSection({ patientId, assessments, canCreate }: { patientId: string; assessments: AssessmentDetail[]; canCreate: boolean }) {
  const active = assessments.filter((assessment) => assessment.archivedAt === null);
  const { latest, previous } = latestAndPrevious(active);
  const reports = active.filter((assessment) => assessment.report);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium">Evolução</h2>
          <p className="text-sm text-muted-foreground">
            {latest ? `Última avaliação em ${formatCalendarDate(latest.assessmentDate)} · ${active.length} ativa(s)` : "Nenhuma avaliação ativa."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {latest && previous ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/pacientes/${patientId}/avaliacoes/comparar?a=${previous.id}&b=${latest.id}`}>
                <GitCompare data-icon="inline-start" />
                Comparar
              </Link>
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild size="sm">
              <Link href={`/dashboard/pacientes/${patientId}/avaliacoes/nova`}>
                <Plus data-icon="inline-start" />
                Nova avaliação
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Ruler className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma avaliação registrada.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Registre peso, composição corporal e medidas; libere para o paciente quando quiser.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TrendCards assessments={active} />
          <EvolutionCharts assessments={active} />
        </>
      )}

      <section aria-labelledby="hist-avaliacoes" className="space-y-3">
        <h2 id="hist-avaliacoes" className="font-heading text-lg font-medium">
          Histórico
        </h2>
        <AssessmentHistory patientId={patientId} assessments={assessments} />
      </section>

      {reports.length > 0 ? (
        <section aria-labelledby="relatorios-h" className="space-y-3">
          <h2 id="relatorios-h" className="font-heading text-lg font-medium">
            Relatórios disponíveis
          </h2>
          <ul className="flex flex-wrap gap-2">
            {reports.map((assessment) => (
              <li key={assessment.id}>
                <Button asChild size="sm" variant="outline">
                  <a href={`/dashboard/pacientes/${patientId}/avaliacoes/${assessment.id}/relatorio`} target="_blank" rel="noopener">
                    {formatCalendarDate(assessment.assessmentDate)} · {assessment.report!.name}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
