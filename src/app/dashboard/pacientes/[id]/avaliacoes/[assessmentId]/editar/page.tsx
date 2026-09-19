import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { updateAssessmentAction } from "@/actions/assessments";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getAssessmentById, getMetricTypes } from "@/data/assessments";
import { toInputValue } from "@/domain/assessments/numbers";
import { patientIdSchema } from "@/validators/patients";
import { assessmentIdSchema } from "@/validators/assessments";
import { instantToDateISO } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Editar avaliação" };
export const dynamic = "force-dynamic";

/** Edição administrativa controlada (prompt Fase 9 §28): arquivada não edita; tudo auditado. */
export default async function EditarAvaliacaoPage({ params }: PageProps<"/dashboard/pacientes/[id]/avaliacoes/[assessmentId]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id, assessmentId } = await params;
  const parsedPatient = patientIdSchema.safeParse(id);
  const parsedAssessment = assessmentIdSchema.safeParse(assessmentId);
  if (!parsedPatient.success || !parsedAssessment.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedPatient.data);
  if (!patient) notFound();
  const assessment = await getAssessmentById(parsedAssessment.data);
  if (!assessment || assessment.patientId !== patient.id) notFound();
  if (assessment.archivedAt) redirect(`/dashboard/pacientes/${patient.id}/avaliacoes/${assessment.id}`);

  const metricTypes = await getMetricTypes();
  const today = instantToDateISO(new Date(), DEFAULT_TIME_ZONE);
  const action = updateAssessmentAction.bind(null, assessment.id, patient.id);
  const metrics = Object.fromEntries(assessment.measurements.map((entry) => [entry.code, toInputValue(entry.value)]));

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=avaliacoes`, label: patient.full_name },
          { href: `/dashboard/pacientes/${patient.id}/avaliacoes/${assessment.id}`, label: `Avaliação de ${formatCalendarDate(assessment.assessmentDate)}` },
          { label: "Editar" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Editar avaliação</h1>
        <p className="text-sm text-muted-foreground">Correções ficam registradas na auditoria. Campos apagados removem a medida.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados da avaliação</CardTitle>
          <CardDescription>{patient.full_name}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentForm
            mode="edit"
            action={action}
            cancelHref={`/dashboard/pacientes/${patient.id}/avaliacoes/${assessment.id}`}
            metricTypes={metricTypes}
            today={today}
            initial={{ assessmentDate: assessment.assessmentDate, notes: assessment.notes ?? "", internalNotes: assessment.internalNotes ?? "", visibleToPatient: assessment.visibleToPatient, metrics }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
