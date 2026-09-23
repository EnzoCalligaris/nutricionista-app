import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { canArchiveFeedback, canDeleteFeedback, canEditFeedback, canPublishFeedback } from "@/domain/patient-content/feedbacks";
import { getFeedbackById, type FeedbackDetail } from "@/data/feedbacks";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import type { FeedbackInput } from "@/validators/patient-content";

/**
 * Casos de uso dos feedbacks (prompt Fase 10 §64): comunicação individual do
 * nutricionista para o paciente, sem chat. Ownership reconferido no servidor
 * além da RLS; auditoria só com ids/status — nunca a mensagem (§55).
 */

async function requireOwnedFeedback(nutritionistId: string, feedbackId: string): Promise<FeedbackDetail> {
  const feedback = await getFeedbackById(feedbackId);
  if (!feedback) throw new DomainError("FEEDBACK_NOT_FOUND");
  await requireOwnedPatient(nutritionistId, feedback.patientId);
  return feedback;
}

export async function createFeedback(nutritionistId: string, patientId: string, input: FeedbackInput): Promise<{ feedbackId: string; published: boolean }> {
  await requireOwnedPatient(nutritionistId, patientId);
  const supabase = await createClient();
  const publishedAt = input.publish ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("feedback_messages")
    .insert({
      patient_id: patientId,
      author_id: nutritionistId,
      title: input.title ?? null,
      content: input.content,
      reference_date: input.referenceDate ?? null,
      published_at: publishedAt,
    })
    .select("id")
    .single();
  if (error || !data) throw domainErrorFromDatabase(error);
  await recordAudit({
    actorId: nutritionistId,
    action: "FEEDBACK_CREATED",
    entityType: "feedback_message",
    entityId: data.id,
    metadata: { patient_id: patientId, has_title: input.title != null, published: input.publish, content_length: input.content.length },
  });
  if (input.publish) {
    await recordAudit({ actorId: nutritionistId, action: "FEEDBACK_PUBLISHED", entityType: "feedback_message", entityId: data.id, metadata: { patient_id: patientId } });
  }
  return { feedbackId: data.id, published: input.publish };
}

/**
 * Edição (§25): rascunho livre; já disponibilizado ainda editável (com
 * `updated_at` + auditoria, sem versionamento); arquivado não. Se o
 * formulário pedir "disponibilizar" num rascunho, publica junto.
 */
export async function updateFeedback(nutritionistId: string, feedbackId: string, input: FeedbackInput): Promise<{ patientId: string; publishedNow: boolean }> {
  const feedback = await requireOwnedFeedback(nutritionistId, feedbackId);
  if (!canEditFeedback(feedback)) throw new DomainError("FEEDBACK_ARCHIVED");
  const publishNow = input.publish && canPublishFeedback(feedback);
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback_messages")
    .update({
      title: input.title ?? null,
      content: input.content,
      reference_date: input.referenceDate ?? null,
      ...(publishNow ? { published_at: new Date().toISOString() } : {}),
    })
    .eq("id", feedbackId);
  if (error) throw domainErrorFromDatabase(error);
  const changed = (["title", "content", "referenceDate"] as const).filter((key) => (feedback[key] ?? null) !== (input[key] ?? null));
  await recordAudit({
    actorId: nutritionistId,
    action: "FEEDBACK_UPDATED",
    entityType: "feedback_message",
    entityId: feedbackId,
    metadata: { patient_id: feedback.patientId, changed_fields: changed, was_published: feedback.publishedAt !== null },
  });
  if (publishNow) {
    await recordAudit({ actorId: nutritionistId, action: "FEEDBACK_PUBLISHED", entityType: "feedback_message", entityId: feedbackId, metadata: { patient_id: feedback.patientId } });
  }
  return { patientId: feedback.patientId, publishedNow: publishNow };
}

/** "Disponibilizar ao paciente" (§24): grava `published_at`; definitivo (o banco recusa voltar a rascunho). */
export async function publishFeedback(nutritionistId: string, feedbackId: string): Promise<{ patientId: string }> {
  const feedback = await requireOwnedFeedback(nutritionistId, feedbackId);
  if (!canPublishFeedback(feedback)) throw new DomainError(feedback.archivedAt ? "FEEDBACK_ARCHIVED" : "INVALID_STATUS_TRANSITION");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_messages").update({ published_at: new Date().toISOString() }).eq("id", feedbackId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "FEEDBACK_PUBLISHED", entityType: "feedback_message", entityId: feedbackId, metadata: { patient_id: feedback.patientId } });
  return { patientId: feedback.patientId };
}

/** Arquivar (§26): paciente deixa de ver; conteúdo preservado. */
export async function archiveFeedback(nutritionistId: string, feedbackId: string): Promise<{ patientId: string }> {
  const feedback = await requireOwnedFeedback(nutritionistId, feedbackId);
  if (!canArchiveFeedback(feedback)) throw new DomainError("FEEDBACK_ARCHIVED");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_messages").update({ archived_at: new Date().toISOString(), archived_by: nutritionistId }).eq("id", feedbackId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "FEEDBACK_ARCHIVED", entityType: "feedback_message", entityId: feedbackId, metadata: { patient_id: feedback.patientId, was_published: feedback.publishedAt !== null } });
  return { patientId: feedback.patientId };
}

/** Exclusão física só de rascunho nunca exibido (§26); o banco também recusa. */
export async function deleteFeedback(nutritionistId: string, feedbackId: string): Promise<{ patientId: string }> {
  const feedback = await requireOwnedFeedback(nutritionistId, feedbackId);
  if (!canDeleteFeedback(feedback)) throw new DomainError("FEEDBACK_NOT_DELETABLE");
  const supabase = await createClient();
  const { error } = await supabase.from("feedback_messages").delete().eq("id", feedbackId);
  if (error) throw domainErrorFromDatabase(error);
  await recordAudit({ actorId: nutritionistId, action: "FEEDBACK_DELETED", entityType: "feedback_message", entityId: feedbackId, metadata: { patient_id: feedback.patientId } });
  return { patientId: feedback.patientId };
}
