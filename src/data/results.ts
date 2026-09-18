import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { safeQuery, type QueryResult } from "@/data/safe-query";

export type PublicResult = {
  id: string;
  title: string;
  description: string | null;
  period: string | null;
};

/**
 * Resultados antes/depois publicados COM consentimento válido. A RLS
 * `before_after_results_select_public` já exige `published = true` +
 * `has_valid_media_consent()` — o site não repete a checagem de
 * consentimento porque não tem (nem deve ter) acesso a `media_consents`.
 *
 * Fotos NÃO são entregues nesta fase: o bucket `before-after` é privado
 * mesmo para resultados publicados, e a entrega ao visitante (signed URL
 * server-side) é Fase 14 (docs/DECISIONS.md, Fase 2 item 6). Aqui só os
 * metadados textuais.
 */
export const getPublishedResults = cache(async (): Promise<QueryResult<PublicResult[]>> => {
  return safeQuery("getPublishedResults", [], async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("before_after_results")
      .select("id, title, description, period, published, media_consent_id")
      .eq("published", true)
      .not("media_consent_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      period: row.period,
    }));
  });
});
