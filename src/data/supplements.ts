import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { sortSupplements } from "@/domain/patient-content/supplements";

/**
 * Queries das recomendações de suplemento (prompt Fase 10 §62). Cliente de
 * sessão: RLS decide quem vê (nutricionista = próprios pacientes; paciente =
 * só ATIVAS e não arquivadas). O portal repete o filtro na query.
 */

export type SupplementDetail = {
  id: string;
  patientId: string;
  name: string;
  brand: string | null;
  instructions: string | null;
  doseText: string | null;
  scheduleText: string | null;
  startsOn: string | null;
  endsOn: string | null;
  notes: string | null;
  purchaseUrl: string | null;
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT = "id, patient_id, name, brand, instructions, dose_text, schedule_text, starts_on, ends_on, notes, purchase_url, active, archived_at, created_at, updated_at";

type Row = {
  id: string;
  patient_id: string;
  name: string;
  brand: string | null;
  instructions: string | null;
  dose_text: string | null;
  schedule_text: string | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  purchase_url: string | null;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function toDetail(row: Row): SupplementDetail {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    brand: row.brand,
    instructions: row.instructions,
    doseText: row.dose_text,
    scheduleText: row.schedule_text,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    notes: row.notes,
    purchaseUrl: row.purchase_url,
    active: row.active,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Histórico completo do paciente para o nutricionista (encerradas e arquivadas incluídas, §12). */
export async function listPatientSupplements(patientId: string): Promise<SupplementDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("supplement_recommendations").select(SELECT).eq("patient_id", patientId);
  if (error) throw domainErrorFromDatabase(error);
  return sortSupplements(((data ?? []) as Row[]).map(toDetail));
}

export async function getSupplementById(supplementId: string): Promise<SupplementDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("supplement_recommendations").select(SELECT).eq("id", supplementId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toDetail(data as Row) : null;
}

/** Portal (§15): só recomendações ATIVAS do próprio paciente — a RLS já filtra; a query repete. */
export async function listActiveSupplementsForPatient(patientId: string): Promise<SupplementDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplement_recommendations")
    .select(SELECT)
    .eq("patient_id", patientId)
    .eq("active", true)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as Row[]).map(toDetail);
}
