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
} as const;

export type SiteSettingsMap = Record<string, unknown>;

export type ContactInfo = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  crn?: string;
  instagram?: string;
};

function readString(settings: SiteSettingsMap, key: string): string | undefined {
  const value = settings[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveContactInfo(settings: SiteSettingsMap): ContactInfo {
  const info: ContactInfo = {};
  const phone = readString(settings, SITE_SETTING_KEYS.phone);
  const whatsapp = readString(settings, SITE_SETTING_KEYS.whatsapp);
  const email = readString(settings, SITE_SETTING_KEYS.email);
  const address = readString(settings, SITE_SETTING_KEYS.address);
  const crn = readString(settings, SITE_SETTING_KEYS.crn);
  const instagram = readString(settings, SITE_SETTING_KEYS.instagram);

  if (phone) info.phone = phone;
  if (whatsapp) info.whatsapp = whatsapp;
  if (email) info.email = email;
  if (address) info.address = address;
  if (crn) info.crn = crn;
  if (instagram) info.instagram = instagram;
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
