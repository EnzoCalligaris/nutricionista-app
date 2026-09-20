import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";

/**
 * Consentimentos do paciente (prompt Fase 11 §19–§22). Cliente de sessão:
 * o paciente lê/registra/revoga só os próprios; o nutricionista lê os dos
 * seus pacientes. A versão do texto faz parte da chave (§21).
 */

export type PatientConsent = { id: string; patientId: string; consentType: string; consentVersion: string; acceptedAt: string; revokedAt: string | null };

type Row = { id: string; patient_id: string; consent_type: string; consent_version: string; accepted_at: string; revoked_at: string | null };

const SELECT = "id, patient_id, consent_type, consent_version, accepted_at, revoked_at";

function toConsent(row: Row): PatientConsent {
  return { id: row.id, patientId: row.patient_id, consentType: row.consent_type, consentVersion: row.consent_version, acceptedAt: row.accepted_at, revokedAt: row.revoked_at };
}

/** Consentimento ATIVO (não revogado) do tipo/versão, ou null. */
export async function getActiveConsent(patientId: string, consentType: string, consentVersion: string): Promise<PatientConsent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .select(SELECT)
    .eq("patient_id", patientId)
    .eq("consent_type", consentType)
    .eq("consent_version", consentVersion)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toConsent(data as Row) : null;
}

/** Histórico (aceites e revogações) do tipo, mais recente primeiro. */
export async function listConsents(patientId: string, consentType: string): Promise<PatientConsent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_consents").select(SELECT).eq("patient_id", patientId).eq("consent_type", consentType).order("accepted_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as Row[]).map(toConsent);
}
