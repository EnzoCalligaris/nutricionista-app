import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { safeQuery, type QueryResult } from "@/data/safe-query";
import { resolveContactInfo, type ContactInfo, type SiteSettingsMap } from "@/domain/site-settings/contact";

/** Todas as configurações marcadas como públicas, como mapa chave → valor. */
export const getPublicSiteSettings = cache(async (): Promise<QueryResult<SiteSettingsMap>> => {
  return safeQuery("getPublicSiteSettings", {}, async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("site_settings").select("key, value").eq("is_public", true);
    if (error) throw new Error(error.message);

    return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  });
});

/**
 * Dados de contato/identidade configurados. Vazio enquanto Enzo não
 * fornecer telefone/CRN/endereço — o site então simplesmente não renderiza
 * essas informações (prompt Fase 4 §7).
 */
export const getContactInfo = cache(async (): Promise<ContactInfo> => {
  const settings = await getPublicSiteSettings();
  return resolveContactInfo(settings.data);
});
