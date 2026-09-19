import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FeedbackForm } from "@/components/feedbacks/feedback-form";
import { createFeedbackAction } from "@/actions/feedbacks";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { patientIdSchema } from "@/validators/patients";

export const metadata: Metadata = { title: "Novo feedback" };
export const dynamic = "force-dynamic";

/** Novo feedback (prompt Fase 10 §20): paciente do contexto da rota, reconferido por ownership. */
export default async function NovoFeedbackPage({ params }: PageProps<"/dashboard/pacientes/[id]/feedbacks/novo">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const action = createFeedbackAction.bind(null, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=feedbacks`, label: patient.full_name },
          { label: "Novo feedback" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Novo feedback</h1>
        <p className="text-sm text-muted-foreground">Para {patient.full_name}. Guarde como rascunho para revisar depois, ou disponibilize já ao paciente.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Mensagem para o paciente</CardTitle>
          <CardDescription>Comunicação individual, sem resposta por aqui. Rascunho nunca aparece no portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackForm mode="create" published={false} action={action} cancelHref={`/dashboard/pacientes/${patient.id}?tab=feedbacks`} initial={{ title: "", content: "", referenceDate: "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
