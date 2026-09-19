import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FeedbackForm } from "@/components/feedbacks/feedback-form";
import { FeedbackStatusBadge } from "@/components/feedbacks/feedback-badges";
import { FeedbackActions } from "@/components/feedbacks/feedback-actions";
import { updateFeedbackAction } from "@/actions/feedbacks";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getFeedbackById } from "@/data/feedbacks";
import { canEditFeedback, feedbackDisplayTitle } from "@/domain/patient-content/feedbacks";
import { patientIdSchema } from "@/validators/patients";
import { feedbackIdSchema } from "@/validators/patient-content";
import { formatDateTime, formatInstantDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

/**
 * Leitura/edição do feedback (prompt Fase 10 §25): ownership pela rota;
 * arquivado é só leitura (texto completo, sem formulário).
 */
export default async function EditarFeedbackPage({ params }: PageProps<"/dashboard/pacientes/[id]/feedbacks/[feedbackId]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id, feedbackId } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  const parsedFeedback = feedbackIdSchema.safeParse(feedbackId);
  if (!parsedId.success || !parsedFeedback.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const feedback = await getFeedbackById(parsedFeedback.data);
  if (!feedback || feedback.patientId !== patient.id) notFound();
  const title = feedbackDisplayTitle(feedback, formatInstantDate);
  const editable = canEditFeedback(feedback);
  const action = updateFeedbackAction.bind(null, feedback.id, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=feedbacks`, label: patient.full_name },
          { label: title },
        ]}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium break-words">{title}</h1>
            <FeedbackStatusBadge item={feedback} />
          </div>
          <p className="text-sm text-muted-foreground">
            Criado em {formatDateTime(feedback.createdAt)}
            {feedback.publishedAt ? ` · disponibilizado em ${formatDateTime(feedback.publishedAt)}` : ""}
            {feedback.updatedAt !== feedback.createdAt ? ` · atualizado em ${formatDateTime(feedback.updatedAt)}` : ""}
          </p>
        </div>
        <FeedbackActions feedbackId={feedback.id} patientId={patient.id} title={title} item={feedback} variant="buttons" hideEdit />
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{editable ? "Editar feedback" : "Feedback arquivado"}</CardTitle>
          <CardDescription>
            {editable
              ? feedback.publishedAt
                ? "Este feedback já está visível ao paciente: alterações são auditadas e aparecem imediatamente no portal."
                : "Rascunho: só você vê. Disponibilize quando estiver pronto."
              : "Só leitura — o paciente não vê mais este feedback."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editable ? (
            <FeedbackForm
              mode="edit"
              published={feedback.publishedAt !== null}
              action={action}
              cancelHref={`/dashboard/pacientes/${patient.id}?tab=feedbacks`}
              initial={{ title: feedback.title ?? "", content: feedback.content, referenceDate: feedback.referenceDate ?? "" }}
            />
          ) : (
            <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed">{feedback.content}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
