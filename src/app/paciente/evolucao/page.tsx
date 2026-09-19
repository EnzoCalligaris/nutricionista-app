import type { Metadata } from "next";
import Link from "next/link";
import { FileText, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EvolutionCharts } from "@/components/assessments/evolution-charts";
import { TrendCards } from "@/components/assessments/trend-cards";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { listVisibleAssessments } from "@/data/assessments";
import { findValue } from "@/domain/assessments/evolution";
import { formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Minha Evolução" };
export const dynamic = "force-dynamic";

/**
 * Minha Evolução (prompt Fase 9 §43–§46): só avaliações liberadas pelo
 * nutricionista (RLS + query, sem nota interna); resumo, gráficos,
 * histórico em cards e relatórios. Mobile-first; sem interpretação.
 */
export default async function MinhaEvolucaoPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-medium">Minha Evolução</h1>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Sua conta ainda não está vinculada a um cadastro de paciente. Fale com o nutricionista.</CardContent>
        </Card>
      </div>
    );
  }
  const assessments = await listVisibleAssessments(context.patientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Minha Evolução</h1>
        <p className="text-sm text-muted-foreground">{assessments.length === 0 ? "Suas avaliações aparecem aqui quando o nutricionista liberar." : `${assessments.length} avaliação(ões) · valores como registrados pelo nutricionista`}</p>
      </div>

      {assessments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <LineChart className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma avaliação disponível ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Depois da avaliação, o nutricionista libera os resultados e eles aparecem aqui com a sua evolução.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <TrendCards assessments={assessments} />
          <section aria-labelledby="graficos-h" className="space-y-3">
            <h2 id="graficos-h" className="font-heading text-lg font-medium">
              Gráficos
            </h2>
            <EvolutionCharts assessments={assessments} />
          </section>
          <section aria-labelledby="historico-h" className="space-y-3">
            <h2 id="historico-h" className="font-heading text-lg font-medium">
              Histórico
            </h2>
            <ul className="grid gap-2" aria-label="Avaliações">
              {assessments.map((assessment) => {
                const weight = findValue(assessment, "WEIGHT");
                const fat = findValue(assessment, "BODY_FAT_PCT");
                return (
                  <li key={assessment.id} className="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading text-base font-medium">{formatCalendarDate(assessment.assessmentDate)}</p>
                        <p className="text-sm text-muted-foreground">
                          {weight != null ? formatMetric(weight, "kg") : "sem peso"}
                          {fat != null ? ` · gordura ${formatMetric(fat, "%")}` : ""}
                          {` · ${assessment.measurements.length} medida(s)`}
                        </p>
                      </div>
                      {assessment.report ? <FileText className="size-4 shrink-0 text-muted-foreground" aria-label="Com relatório" /> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/paciente/evolucao/${assessment.id}`}>Ver detalhes</Link>
                      </Button>
                      {assessment.report ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`/paciente/evolucao/${assessment.id}/relatorio`} target="_blank" rel="noopener">
                            Relatório
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className="text-xs text-muted-foreground">Os valores são registrados pelo nutricionista. A interpretação dos resultados é feita em consulta.</p>
        </>
      )}
    </div>
  );
}
