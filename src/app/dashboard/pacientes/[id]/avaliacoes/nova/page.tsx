import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { createAssessmentAction } from "@/actions/assessments";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getMetricTypes } from "@/data/assessments";
import { patientIdSchema } from "@/validators/patients";
import { instantToDateISO } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";

export const metadata: Metadata = { title: "Nova avaliação" };
export const dynamic = "force-dynamic";

/** Nova avaliação (prompt Fase 9 §4): paciente do contexto da rota, reconferido por ownership. */
export default async function NovaAvaliacaoPage({ params }: PageProps<"/dashboard/pacientes/[id]/avaliacoes/nova">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const metricTypes = await getMetricTypes();
  const today = instantToDateISO(new Date(), DEFAULT_TIME_ZONE);
  const action = createAssessmentAction.bind(null, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=avaliacoes`, label: patient.full_name },
          { label: "Nova avaliação" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Nova avaliação</h1>
        <p className="text-sm text-muted-foreground">Paciente: {patient.full_name}. Nenhuma métrica é obrigatória — registre só o que foi medido.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados da avaliação</CardTitle>
          <CardDescription>Valores em pt-BR (78,5). O relatório de bioimpedância pode ser anexado depois de salvar.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentForm
            mode="create"
            action={action}
            cancelHref={`/dashboard/pacientes/${patient.id}?tab=avaliacoes`}
            metricTypes={metricTypes}
            today={today}
            initial={{ assessmentDate: today, notes: "", internalNotes: "", visibleToPatient: false, metrics: {} }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
