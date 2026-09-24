import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { safeQuery, type QueryResult } from "@/data/safe-query";
import { resultImageAlt } from "@/domain/results/display";
import { resultState, type ResultState } from "@/domain/results/status";
import type { NameDisplayMode } from "@/domain/results/display";
import type { Database } from "@/types/database";

type ResultRow = Database["public"]["Tables"]["before_after_results"]["Row"];

export type PublicResult = {
  id: string;
  title: string;
  description: string | null;
  period: string | null;
  /** Nome autorizado; null = anônimo. Nunca inventado (prompt Fase 14 §36). */
  displayName: string | null;
  /** Rota server-side das imagens — nunca URL assinada nem path de storage. */
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
};

/** Rota pública que entrega os bytes da imagem (bucket privado — §32/§33). */
export function resultImageUrl(resultId: string, slot: "before" | "after"): string {
  return `/api/resultados/${resultId}/${slot}`;
}

/**
 * Resultados antes/depois publicados COM consentimento válido e não
 * arquivados. A RLS `before_after_results_select_public` já exige as três
 * condições — o site não repete a checagem de consentimento porque não tem
 * (nem deve ter) acesso a `media_consents`. Revogar o consentimento tira o
 * resultado desta lista na hora, sem nenhuma edição manual (§31/§34).
 */
export const getPublishedResults = cache(async (): Promise<QueryResult<PublicResult[]>> => {
  return safeQuery("getPublishedResults", [], async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("before_after_results")
      .select("id, title, description, period, display_name, image_alt, before_path, after_path, sort_order, published_at")
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? [])
      // Publicado sem as duas fotos não é exibível (a constraint do banco já
      // impede, isto é a segunda camada).
      .filter((row) => row.before_path && row.after_path)
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        period: row.period,
        displayName: row.display_name,
        beforeUrl: resultImageUrl(row.id, "before"),
        afterUrl: resultImageUrl(row.id, "after"),
        beforeAlt: resultImageAlt("before", row.image_alt),
        afterAlt: resultImageAlt("after", row.image_alt),
      }));
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardResultConsent = {
  id: string;
  patientId: string;
  consentType: string;
  consentVersion: string;
  nameDisplayMode: NameDisplayMode;
  grantedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  evidenceReference: string | null;
};

export type DashboardResult = {
  id: string;
  title: string;
  description: string | null;
  period: string | null;
  imageAlt: string | null;
  displayName: string | null;
  sortOrder: number;
  published: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  beforePath: string | null;
  afterPath: string | null;
  patientId: string | null;
  patientName: string | null;
  consent: DashboardResultConsent | null;
  state: ResultState;
  createdAt: string;
  updatedAt: string;
};

type ResultJoinRow = ResultRow & {
  patients: { id: string; full_name: string } | null;
  media_consents: {
    id: string;
    patient_id: string;
    consent_type: string;
    consent_version: string;
    name_display_mode: string;
    granted_at: string;
    revoked_at: string | null;
    revoke_reason: string | null;
    evidence_reference: string | null;
  } | null;
};

const RESULT_SELECT =
  "*, patients(id, full_name), media_consents(id, patient_id, consent_type, consent_version, name_display_mode, granted_at, revoked_at, revoke_reason, evidence_reference)";

function toDashboardResult(row: ResultJoinRow): DashboardResult {
  const consent = row.media_consents
    ? {
        id: row.media_consents.id,
        patientId: row.media_consents.patient_id,
        consentType: row.media_consents.consent_type,
        consentVersion: row.media_consents.consent_version,
        nameDisplayMode: row.media_consents.name_display_mode as NameDisplayMode,
        grantedAt: row.media_consents.granted_at,
        revokedAt: row.media_consents.revoked_at,
        revokeReason: row.media_consents.revoke_reason,
        evidenceReference: row.media_consents.evidence_reference,
      }
    : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    period: row.period,
    imageAlt: row.image_alt,
    displayName: row.display_name,
    sortOrder: row.sort_order,
    published: row.published,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    beforePath: row.before_path,
    afterPath: row.after_path,
    patientId: row.patients?.id ?? row.patient_id,
    patientName: row.patients?.full_name ?? null,
    consent,
    state: resultState({
      published: row.published,
      archivedAt: row.archived_at,
      beforePath: row.before_path,
      afterPath: row.after_path,
      hasValidConsent: Boolean(consent && consent.revokedAt === null),
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Resultados do nutricionista autenticado. A RLS
 * `before_after_results_select_nutritionist_own` restringe às próprias
 * linhas — o filtro por dono está no banco, não só aqui (§54).
 */
export async function getDashboardResults(options?: { includeArchived?: boolean }): Promise<DashboardResult[]> {
  const supabase = await createClient();
  let query = supabase.from("before_after_results").select(RESULT_SELECT);
  if (!options?.includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ResultJoinRow[]).map(toDashboardResult);
}

export async function getDashboardResult(resultId: string): Promise<DashboardResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("before_after_results").select(RESULT_SELECT).eq("id", resultId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toDashboardResult(data as ResultJoinRow);
}

/** Consentimentos de imagem de um paciente (para escolher/registrar). */
export async function getMediaConsentsForPatient(patientId: string): Promise<DashboardResultConsent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_consents")
    .select("id, patient_id, consent_type, consent_version, name_display_mode, granted_at, revoked_at, revoke_reason, evidence_reference")
    .eq("patient_id", patientId)
    .order("granted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    consentType: row.consent_type,
    consentVersion: row.consent_version,
    nameDisplayMode: row.name_display_mode as NameDisplayMode,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    evidenceReference: row.evidence_reference,
  }));
}

export type ResultCounters = { total: number; published: number; drafts: number; archived: number; consentRevoked: number };

export function countResults(results: DashboardResult[]): ResultCounters {
  return {
    total: results.length,
    published: results.filter((result) => result.state === "PUBLISHED").length,
    drafts: results.filter((result) => result.state === "DRAFT" || result.state === "READY_TO_PUBLISH").length,
    archived: results.filter((result) => result.state === "ARCHIVED").length,
    consentRevoked: results.filter((result) => result.state === "CONSENT_REVOKED").length,
  };
}
