import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { AssessmentActions } from "@/components/assessments/assessment-actions";
import { VisibilityBadge } from "@/components/assessments/assessment-history";
import { MeasurementList } from "@/components/assessments/measurement-list";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getAssessmentById } from "@/data/assessments";
import { canHardDelete } from "@/domain/assessments/evolution";
import { ASSESSMENT_KIND_LABEL, inferKind } from "@/domain/assessments/metrics";
import { patientIdSchema } from "@/validators/patients";
import { assessmentIdSchema } from "@/validators/assessments";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Avaliação" };
export const dynamic = "force-dynamic";

/** Detalhe da avaliação: medidas, observações (visível + interna), relatório e ações. Ownership: paciente da rota + avaliação desse paciente. */
export default async function AvaliacaoPage({ params }: PageProps<"/dashboard/pacientes/[id]/avaliacoes/[assessmentId]">) {
  const nutritionist = await requireNutritionist();
  const { id, assessmentId } = await params;
  const parsedPatient = patientIdSchema.safeParse(id);
  const parsedAssessment = assessmentIdSchema.safeParse(assessmentId);
  if (!parsedPatient.success || !parsedAssessment.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedPatient.data);
  if (!patient) notFound();
  const assessment = await getAssessmentById(parsedAssessment.data);
  if (!assessment || assessment.patientId !== patient.id) notFound();

  const backHref = `/dashboard/pacientes/${patient.id}?tab=avaliacoes`;
  const kind = ASSESSMENT_KIND_LABEL[inferKind(assessment.measurements.map((entry) => entry.code))];

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: backHref, label: patient.full_name },
          { label: `Avaliação de ${formatCalendarDate(assessment.assessmentDate)}` },
        ]}
      />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium">Avaliação de {formatCalendarDate(assessment.assessmentDate)}</h1>
            <VisibilityBadge assessment={assessment} />
          </div>
          <p className="text-sm text-muted-foreground">
            {kind} · registrada em {formatDateTime(assessment.createdAt)}
            {assessment.updatedAt !== assessment.createdAt ? ` · atualizada em ${formatDateTime(assessment.updatedAt)}` : ""}
            {assessment.publishedAt ? ` · liberada ao paciente em ${formatDateTime(assessment.publishedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>Voltar</Link>
          </Button>
          {!assessment.archivedAt ? (
            <Button asChild size="sm">
              <Link href={`/dashboard/pacientes/${patient.id}/avaliacoes/${assessment.id}/editar`}>
                <Pencil data-icon="inline-start" />
                Editar
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Medidas</CardTitle>
            </CardHeader>
            <CardContent>
              <MeasurementList measurements={assessment.measurements} />
            </CardContent>
          </Card>
          {assessment.notes || assessment.internalNotes ? (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {assessment.notes ? (
                  <p>
                    <span className="block text-xs text-muted-foreground">Para o paciente</span>
                    {assessment.notes}
                  </p>
                ) : null}
                {assessment.internalNotes ? (
                  <p className="rounded-lg bg-warning/10 px-3 py-2">
                    <span className="block text-xs text-warning-foreground">Nota interna (nunca visível ao paciente)</span>
                    {assessment.internalNotes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
        <AssessmentActions
          assessmentId={assessment.id}
          patientId={patient.id}
          visibleToPatient={assessment.visibleToPatient}
          archived={assessment.archivedAt !== null}
          canDelete={canHardDelete(assessment)}
          report={assessment.report ? { name: assessment.report.name, sizeBytes: assessment.report.sizeBytes, uploadedAt: assessment.report.uploadedAt, mime: assessment.report.mime } : null}
        />
      </div>
    </div>
  );
}
