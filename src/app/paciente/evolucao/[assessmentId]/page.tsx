import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComparisonTable } from "@/components/assessments/comparison-table";
import { MeasurementList } from "@/components/assessments/measurement-list";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { getVisibleAssessment, listVisibleAssessments } from "@/data/assessments";
import { sortByDateDesc } from "@/domain/assessments/evolution";
import { assessmentIdSchema } from "@/validators/assessments";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Avaliação" };
export const dynamic = "force-dynamic";

/** Detalhe de uma avaliação liberada: medidas, observação do nutricionista, comparação com a anterior visível e relatório. */
export default async function AvaliacaoPacientePage({ params }: PageProps<"/paciente/evolucao/[assessmentId]">) {
  const profile = await requirePatient();
  const { assessmentId } = await params;
  const parsed = assessmentIdSchema.safeParse(assessmentId);
  const context = await getPatientBookingContext(profile.id);
  if (!parsed.success || !context) notFound();
  const assessment = await getVisibleAssessment(context.patientId, parsed.data);
  if (!assessment) notFound();

  const all = sortByDateDesc(await listVisibleAssessments(context.patientId));
  const index = all.findIndex((entry) => entry.id === assessment.id);
  const previous = index >= 0 ? (all[index + 1] ?? null) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/paciente/evolucao" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Minha Evolução
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-medium">Avaliação de {formatCalendarDate(assessment.assessmentDate)}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Medidas</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasurementList measurements={assessment.measurements} />
        </CardContent>
      </Card>

      {assessment.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Observação do nutricionista</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{assessment.notes}</CardContent>
        </Card>
      ) : null}

      {assessment.report ? (
        <Button asChild>
          <a href={`/paciente/evolucao/${assessment.id}/relatorio`} target="_blank" rel="noopener">
            <Download data-icon="inline-start" />
            Abrir relatório de bioimpedância
          </a>
        </Button>
      ) : null}

      {previous ? (
        <section aria-labelledby="cmp-h" className="space-y-3">
          <h2 id="cmp-h" className="font-heading text-lg font-medium">
            Em relação à avaliação de {formatCalendarDate(previous.assessmentDate)}
          </h2>
          <ComparisonTable a={previous} b={assessment} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Primeira avaliação disponível — a comparação aparece a partir da próxima.</p>
      )}
    </div>
  );
}
