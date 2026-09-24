import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { safeQuery, type QueryResult } from "@/data/safe-query";
import { resolveContactInfo, type ContactInfo } from "@/domain/site-settings/contact";
import {
  resolveAddress,
  resolveOnlineAttendance,
  resolveProfessionalProfile,
  resolveSeoDefaults,
  resolveSiteContent,
  type OnlineAttendance,
  type PostalAddress,
  type ProfessionalProfile,
  type SeoDefaults,
  type SiteSettingsMap,
} from "@/domain/site-settings/resolve";
import type { SiteContent } from "@/content/site-content";

/**
 * Todas as configurações marcadas como públicas, como mapa chave → valor.
 * Lido com o cliente ANÔNIMO: o que a RLS não libera para `anon`
 * (`is_public = false`, como as instruções da consulta online e o endereço
 * quando `address.show_public` está desligado) simplesmente não chega aqui.
 */
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

/** Perfil profissional público (campo vazio não aparece — prompt Fase 14 §2). */
export const getProfessionalProfile = cache(async (): Promise<ProfessionalProfile> => {
  const settings = await getPublicSiteSettings();
  return resolveProfessionalProfile(settings.data);
});

/** Endereço exibível ao público — só existe aqui se `show_public` estiver ligado. */
export const getPublicAddress = cache(async (): Promise<PostalAddress> => {
  const settings = await getPublicSiteSettings();
  return resolveAddress(settings.data);
});

/** Conteúdo editorial da home, com fallback versionado (prompt Fase 14 §12). */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const settings = await getPublicSiteSettings();
  return resolveSiteContent(settings.data);
});

/** Defaults de SEO configurados (prompt Fase 14 §41). */
export const getSeoDefaults = cache(async (): Promise<SeoDefaults> => {
  const settings = await getPublicSiteSettings();
  return resolveSeoDefaults(settings.data);
});

/** Plataforma da consulta online — parte pública (só o nome). */
export const getPublicOnlineAttendance = cache(async (): Promise<OnlineAttendance> => {
  const settings = await getPublicSiteSettings();
  const resolved = resolveOnlineAttendance(settings.data);
  // Redundante com a RLS, mas explícito: instruções e link nunca são públicos.
  return { platform: resolved.platform };
});

// ---------------------------------------------------------------------------
// Dashboard / server-side autenticado
// ---------------------------------------------------------------------------

/**
 * TODAS as configurações (públicas e privadas) com o cliente de sessão do
 * nutricionista (policy `site_settings_select_nutritionist_all`).
 */
export async function getAllSiteSettings(): Promise<SiteSettingsMap> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export type SiteSettingsSnapshot = {
  raw: SiteSettingsMap;
  professional: ProfessionalProfile;
  contact: ContactInfo;
  address: PostalAddress;
  online: OnlineAttendance;
  content: SiteContent;
  seo: SeoDefaults;
};

export async function getSiteSettingsSnapshot(): Promise<SiteSettingsSnapshot> {
  const raw = await getAllSiteSettings();
  return {
    raw,
    professional: resolveProfessionalProfile(raw),
    contact: resolveContactInfo(raw),
    address: resolveAddress(raw),
    online: resolveOnlineAttendance(raw),
    content: resolveSiteContent(raw),
    seo: resolveSeoDefaults(raw),
  };
}

/**
 * Instruções/link da consulta online para o PACIENTE (portal e e-mails).
 * Não passa pelo cliente anônimo de propósito: essas chaves têm
 * `is_public = false`.
 */
export async function getOnlineAttendanceForPatient(): Promise<OnlineAttendance> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["attendance.online_platform", "attendance.online_instructions", "attendance.online_base_url"]);
  if (error) throw new Error(error.message);
  return resolveOnlineAttendance(Object.fromEntries((data ?? []).map((row) => [row.key, row.value])));
}

/**
 * URL pública de um asset institucional, resolvida com o cliente ANÔNIMO — o
 * bucket `site-assets` é público de propósito (§45/§46) e o site não precisa
 * de sessão para montar a URL.
 */
export function publicSiteAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createPublicClient();
  return supabase.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
}
