/**
 * Resolução PURA das configurações: mapa `site_settings` → objetos tipados
 * que as páginas consomem. Regras (prompt Fase 14 §12/§93):
 *
 * - campo vazio/ausente NÃO aparece publicamente — nada é inventado;
 * - conteúdo editorial cai no fallback versionado (`SITE_CONTENT_FALLBACK`)
 *   até o nutricionista salvar; depois disso o banco é a fonte;
 * - o site nunca quebra por configuração incompleta: tudo é opcional.
 */

import { SITE_CONTENT_FALLBACK, type SiteContent } from "@/content/site-content";

export type SiteSettingsMap = Record<string, unknown>;

export function readSettingString(settings: SiteSettingsMap, key: string): string | undefined {
  const value = settings[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readSettingBoolean(settings: SiteSettingsMap, key: string): boolean {
  return settings[key] === true;
}

export function readSettingInteger(settings: SiteSettingsMap, key: string): number | undefined {
  const value = settings[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.trunc(value);
  return rounded >= 0 ? rounded : undefined;
}

export function readSettingList(settings: SiteSettingsMap, key: string): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  });
}

// ---------------------------------------------------------------------------
// Perfil profissional
// ---------------------------------------------------------------------------

export type ProfessionalProfile = {
  name?: string;
  title?: string;
  crn?: string;
  bioShort?: string;
  bioFull?: string;
  specialties: string[];
  experienceYears?: number;
  photoPath?: string;
  logoPath?: string;
};

export function resolveProfessionalProfile(settings: SiteSettingsMap): ProfessionalProfile {
  return {
    name: readSettingString(settings, "professional.name"),
    title: readSettingString(settings, "professional.title"),
    crn: readSettingString(settings, "professional.crn"),
    bioShort: readSettingString(settings, "professional.bio_short"),
    bioFull: readSettingString(settings, "professional.bio_full"),
    specialties: readSettingList(settings, "professional.specialties"),
    experienceYears: readSettingInteger(settings, "professional.experience_years"),
    photoPath: readSettingString(settings, "professional.photo_path"),
    logoPath: readSettingString(settings, "professional.logo_path"),
  };
}

// ---------------------------------------------------------------------------
// Endereço
// ---------------------------------------------------------------------------

export type PostalAddress = {
  placeName?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  showPublic: boolean;
};

export function resolveAddress(settings: SiteSettingsMap): PostalAddress {
  return {
    placeName: readSettingString(settings, "address.place_name"),
    street: readSettingString(settings, "address.street"),
    number: readSettingString(settings, "address.number"),
    complement: readSettingString(settings, "address.complement"),
    district: readSettingString(settings, "address.district"),
    city: readSettingString(settings, "address.city"),
    state: readSettingString(settings, "address.state"),
    postalCode: readSettingString(settings, "address.postal_code"),
    showPublic: readSettingBoolean(settings, "address.show_public"),
  };
}

export function hasAddress(address: PostalAddress): boolean {
  return Boolean(address.street || address.city || address.placeName);
}

/**
 * Endereço em uma linha. Só monta o que existe — nunca preenche cidade,
 * estado ou CEP que não foram informados.
 */
export function formatAddressLine(address: PostalAddress): string | undefined {
  if (!hasAddress(address)) return undefined;
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const streetWithComplement = [street, address.complement].filter(Boolean).join(" — ");
  const cityState = [address.city, address.state].filter(Boolean).join("/");
  const tail = [address.district, cityState, address.postalCode].filter(Boolean).join(" · ");
  return [address.placeName, streetWithComplement, tail].filter(Boolean).join(" · ") || undefined;
}

/**
 * Endereço exibível ao público: só quando configurado E autorizado (§6).
 * Quando `show_public` está desligado, as linhas de endereço nem chegam ao
 * visitante (RLS), então na prática isto é a segunda camada.
 */
export function publicAddressLine(address: PostalAddress): string | undefined {
  if (!address.showPublic) return undefined;
  return formatAddressLine(address);
}

// ---------------------------------------------------------------------------
// Atendimento online
// ---------------------------------------------------------------------------

export type OnlineAttendance = {
  /** Público: só o nome da plataforma. */
  platform?: string;
  /** Entregue ao paciente (portal/e-mail), nunca ao visitante anônimo. */
  instructions?: string;
  baseUrl?: string;
};

export function resolveOnlineAttendance(settings: SiteSettingsMap): OnlineAttendance {
  return {
    platform: readSettingString(settings, "attendance.online_platform"),
    instructions: readSettingString(settings, "attendance.online_instructions"),
    baseUrl: readSettingString(settings, "attendance.online_base_url"),
  };
}

// ---------------------------------------------------------------------------
// Conteúdo editorial da home (com fallback versionado — §12)
// ---------------------------------------------------------------------------

const CONTENT_KEYS: Record<keyof SiteContent, string> = {
  headline: "home.headline",
  subheadline: "home.subheadline",
  ctaLabel: "home.cta_label",
  heroNote: "home.hero_note",
  methodIntro: "home.method_intro",
  mission: "home.mission",
  aboutIntro: "home.about_intro",
  aboutPhilosophy: "home.about_philosophy",
};

export function resolveSiteContent(settings: SiteSettingsMap): SiteContent {
  const content = {} as SiteContent;
  for (const field of Object.keys(CONTENT_KEYS) as (keyof SiteContent)[]) {
    content[field] = readSettingString(settings, CONTENT_KEYS[field]) ?? SITE_CONTENT_FALLBACK[field];
  }
  return content;
}

/** Quais textos da home já foram personalizados no banco (para a UI mostrar). */
export function customizedContentFields(settings: SiteSettingsMap): (keyof SiteContent)[] {
  return (Object.keys(CONTENT_KEYS) as (keyof SiteContent)[]).filter((field) =>
    readSettingString(settings, CONTENT_KEYS[field]) !== undefined,
  );
}

export function siteContentKey(field: keyof SiteContent): string {
  return CONTENT_KEYS[field];
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export type SeoDefaults = { title?: string; description?: string; ogImagePath?: string };

export function resolveSeoDefaults(settings: SiteSettingsMap): SeoDefaults {
  return {
    title: readSettingString(settings, "seo.default_title"),
    description: readSettingString(settings, "seo.default_description"),
    ogImagePath: readSettingString(settings, "seo.og_image_path"),
  };
}
