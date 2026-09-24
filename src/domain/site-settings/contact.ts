/**
 * Chaves públicas conhecidas de `site_settings` e resolução dos dados de
 * contato/identidade profissional a partir delas. NENHUM valor default é
 * fornecido aqui: telefone, WhatsApp, e-mail, endereço, CRN e redes sociais
 * continuam PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md) — o site só renderiza
 * o que estiver configurado no banco (prompt Fase 4 §7/§29/§32).
 *
 * Convenção de chaves (a tela de Configurações da Fase 14 passa a gravar
 * exatamente estas): valor sempre um JSON string.
 */
export const SITE_SETTING_KEYS = {
  phone: "contact.phone",
  whatsapp: "contact.whatsapp",
  email: "contact.email",
  address: "contact.address",
  crn: "professional.crn",
  instagram: "social.instagram",
  linkedin: "social.linkedin",
} as const;

export type SiteSettingsMap = Record<string, unknown>;

export type ContactInfo = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  crn?: string;
  instagram?: string;
  linkedin?: string;
};

function readString(settings: SiteSettingsMap, key: string): string | undefined {
  const value = settings[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Endereço em uma linha a partir dos campos ESTRUTURADOS da Fase 14
 * (`address.*`). Só monta o que existe. No site público essas chaves só
 * chegam quando `address.show_public` está ligado — com a flag desligada a
 * RLS não as entrega para `anon`, então aqui o resultado é `undefined` sem
 * nenhuma checagem extra.
 */
function composeStructuredAddress(settings: SiteSettingsMap): string | undefined {
  const placeName = readString(settings, "address.place_name");
  const street = readString(settings, "address.street");
  const number = readString(settings, "address.number");
  const complement = readString(settings, "address.complement");
  const district = readString(settings, "address.district");
  const city = readString(settings, "address.city");
  const state = readString(settings, "address.state");
  const postalCode = readString(settings, "address.postal_code");

  if (!street && !city && !placeName) return undefined;

  const line = [street, number].filter(Boolean).join(", ");
  const withComplement = [line, complement].filter(Boolean).join(" — ");
  const cityState = [city, state].filter(Boolean).join("/");
  const tail = [district, cityState, postalCode].filter(Boolean).join(" · ");
  return [placeName, withComplement, tail].filter(Boolean).join(" · ") || undefined;
}

export function resolveContactInfo(settings: SiteSettingsMap): ContactInfo {
  const info: ContactInfo = {};
  const phone = readString(settings, SITE_SETTING_KEYS.phone);
  const whatsapp = readString(settings, SITE_SETTING_KEYS.whatsapp);
  const email = readString(settings, SITE_SETTING_KEYS.email);
  // A chave legada `contact.address` (Fase 4, endereço em texto livre) ainda
  // é respeitada quando existir; caso contrário monta a partir dos campos
  // estruturados da Fase 14.
  const address = readString(settings, SITE_SETTING_KEYS.address) ?? composeStructuredAddress(settings);
  const crn = readString(settings, SITE_SETTING_KEYS.crn);
  const instagram = readString(settings, SITE_SETTING_KEYS.instagram);
  const linkedin = readString(settings, SITE_SETTING_KEYS.linkedin);

  if (phone) info.phone = phone;
  if (whatsapp) info.whatsapp = whatsapp;
  if (email) info.email = email;
  if (address) info.address = address;
  if (crn) info.crn = crn;
  if (instagram) info.instagram = instagram;
  if (linkedin) info.linkedin = linkedin;
  return info;
}

export function hasAnyContactChannel(info: ContactInfo): boolean {
  return Boolean(info.phone || info.whatsapp || info.email || info.address);
}

/** Link clicável de WhatsApp a partir de um número com ou sem formatação. */
export function whatsappHref(number: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}
