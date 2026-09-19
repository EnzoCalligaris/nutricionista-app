import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { sortFeedbacks } from "@/domain/patient-content/feedbacks";

/**
 * Queries dos feedbacks (prompt Fase 10 §62). Cliente de sessão: RLS decide
 * quem vê (nutricionista = próprios pacientes; paciente = só disponibilizados
 * e não arquivados). O portal repete o filtro na query.
 */

export type FeedbackDetail = {
  id: string;
  patientId: string;
  authorId: string;
  title: string | null;
  content: string;
  referenceDate: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT = "id, patient_id, author_id, title, content, reference_date, published_at, archived_at, read_at, created_at, updated_at";

type Row = {
  id: string;
  patient_id: string;
  author_id: string;
  title: string | null;
  content: string;
  reference_date: string | null;
  published_at: string | null;
  archived_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

function toDetail(row: Row): FeedbackDetail {
  return {
    id: row.id,
    patientId: row.patient_id,
    authorId: row.author_id,
    title: row.title,
    content: row.content,
    referenceDate: row.reference_date,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Histórico completo do paciente para o nutricionista (rascunhos e arquivados incluídos), mais recente primeiro (§27). */
export async function listPatientFeedbacks(patientId: string): Promise<FeedbackDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback_messages").select(SELECT).eq("patient_id", patientId);
  if (error) throw domainErrorFromDatabase(error);
  return sortFeedbacks(((data ?? []) as Row[]).map(toDetail));
}

export async function getFeedbackById(feedbackId: string): Promise<FeedbackDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback_messages").select(SELECT).eq("id", feedbackId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as Row) : null;
}

/** Portal (§28): só feedbacks disponibilizados e não arquivados do próprio paciente, mais recente primeiro. */
export async function listVisibleFeedbacksForPatient(patientId: string): Promise<FeedbackDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_messages")
    .select(SELECT)
    .eq("patient_id", patientId)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("published_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as Row[]).map(toDetail);
}
