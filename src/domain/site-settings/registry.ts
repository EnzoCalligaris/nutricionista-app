/**
 * REGISTRY FECHADO das chaves de `site_settings` (prompt Fase 14 §8/§56).
 *
 * Só as chaves declaradas aqui podem ser gravadas: o Server Action valida a
 * chave contra este registry antes de qualquer escrita, então nem uma
 * requisição adulterada cria chave arbitrária nem marca como pública uma
 * configuração privada (`is_public` NUNCA vem do client — é derivado aqui).
 *
 * As chaves de contato/CRN/Instagram são as MESMAS da Fase 4
 * (`contact.ts` / `SITE_SETTING_KEYS`), para o site público continuar lendo
 * o que já lia. Nenhum valor real entra neste arquivo: telefone, CRN,
 * endereço, plataforma online e afins seguem PENDENTE DE DEFINIÇÃO até Enzo
 * preencher pelo dashboard (regra inegociável nº 1).
 */

export type SettingGroupId = "professional" | "contact" | "address" | "attendance" | "home" | "seo";

export type SettingKind =
  | "text"
  | "multiline"
  | "email"
  | "phone"
  | "url"
  | "handle"
  | "boolean"
  | "integer"
  | "list"
  | "asset";

export type SettingDefinition = {
  key: string;
  group: SettingGroupId;
  label: string;
  kind: SettingKind;
  /** Limite de caracteres do texto (não se aplica a boolean/integer). */
  maxLength?: number;
  help?: string;
  placeholder?: string;
  /**
   * Visibilidade pública da linha (`site_settings.is_public`). `true`/`false`
   * são estáticos; "address" segue a flag `address.show_public` — com ela
   * desligada, o visitante anônimo não consegue nem ler o endereço (a RLS só
   * entrega `is_public = true`), em vez de a aplicação "esquecer" de exibir
   * (prompt §6).
   */
  visibility: "public" | "private" | "address";
};

/** Chaves usadas pelo site desde a Fase 4 — mantidas por compatibilidade. */
export const LEGACY_PUBLIC_KEYS = {
  phone: "contact.phone",
  whatsapp: "contact.whatsapp",
  email: "contact.email",
  address: "contact.address",
  crn: "professional.crn",
  instagram: "social.instagram",
} as const;

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  // --- Perfil profissional (prompt §2/§3) --------------------------------
  { key: "professional.name", group: "professional", label: "Nome profissional", kind: "text", maxLength: 120, visibility: "public" },
  { key: "professional.title", group: "professional", label: "Título", kind: "text", maxLength: 120, help: "Ex.: como você se apresenta profissionalmente.", visibility: "public" },
  {
    key: "professional.crn",
    group: "professional",
    label: "CRN",
    kind: "text",
    maxLength: 40,
    help: "Registro no Conselho Regional de Nutricionistas. Enquanto estiver vazio, não aparece em nenhuma página.",
    visibility: "public",
  },
  { key: "professional.bio_short", group: "professional", label: "Bio curta", kind: "multiline", maxLength: 320, help: "Uma ou duas frases, usada em prévias.", visibility: "public" },
  { key: "professional.bio_full", group: "professional", label: "Bio completa", kind: "multiline", maxLength: 4000, visibility: "public" },
  { key: "professional.specialties", group: "professional", label: "Áreas de atuação", kind: "list", maxLength: 600, help: "Uma por linha.", visibility: "public" },
  { key: "professional.experience_years", group: "professional", label: "Anos de experiência", kind: "integer", help: "Deixe vazio se preferir não informar.", visibility: "public" },
  { key: "professional.photo_path", group: "professional", label: "Foto profissional", kind: "asset", visibility: "public" },
  { key: "professional.logo_path", group: "professional", label: "Logo", kind: "asset", visibility: "public" },

  // --- Contato e canais (prompt §4) -------------------------------------
  { key: "contact.phone", group: "contact", label: "Telefone", kind: "phone", maxLength: 40, visibility: "public" },
  { key: "contact.whatsapp", group: "contact", label: "WhatsApp", kind: "phone", maxLength: 40, visibility: "public" },
  { key: "contact.email", group: "contact", label: "E-mail público", kind: "email", maxLength: 200, visibility: "public" },
  { key: "social.instagram", group: "contact", label: "Instagram", kind: "handle", maxLength: 200, help: "@usuario ou o endereço completo do perfil.", visibility: "public" },
  { key: "social.linkedin", group: "contact", label: "LinkedIn", kind: "url", maxLength: 300, visibility: "public" },

  // --- Endereço (prompt §5/§6) ------------------------------------------
  { key: "address.place_name", group: "address", label: "Nome do local", kind: "text", maxLength: 160, visibility: "address" },
  { key: "address.street", group: "address", label: "Logradouro", kind: "text", maxLength: 200, visibility: "address" },
  { key: "address.number", group: "address", label: "Número", kind: "text", maxLength: 20, visibility: "address" },
  { key: "address.complement", group: "address", label: "Complemento", kind: "text", maxLength: 120, visibility: "address" },
  { key: "address.district", group: "address", label: "Bairro", kind: "text", maxLength: 120, visibility: "address" },
  { key: "address.city", group: "address", label: "Cidade", kind: "text", maxLength: 120, visibility: "address" },
  { key: "address.state", group: "address", label: "Estado (UF)", kind: "text", maxLength: 2, visibility: "address" },
  { key: "address.postal_code", group: "address", label: "CEP", kind: "text", maxLength: 9, visibility: "address" },
  {
    key: "address.show_public",
    group: "address",
    label: "Mostrar endereço no site e nos e-mails",
    kind: "boolean",
    help: "Desligado, o endereço fica só no dashboard — o visitante anônimo não consegue lê-lo nem pela API.",
    visibility: "public",
  },

  // --- Atendimento online (prompt §7) -----------------------------------
  {
    key: "attendance.online_platform",
    group: "attendance",
    label: "Plataforma da consulta online",
    kind: "text",
    maxLength: 80,
    help: "O nome que o paciente vê. Nenhum exemplo é preenchido por padrão.",
    visibility: "public",
  },
  {
    key: "attendance.online_instructions",
    group: "attendance",
    label: "Instruções para o paciente",
    kind: "multiline",
    maxLength: 2000,
    help: "Entregue ao paciente (portal e e-mails). Não aparece no site público.",
    visibility: "private",
  },
  {
    key: "attendance.online_base_url",
    group: "attendance",
    label: "Link base da sala",
    kind: "url",
    maxLength: 500,
    help: "Só para o paciente. Não vai para o site público nem para visitante anônimo.",
    visibility: "private",
  },

  // --- Conteúdo da home (prompt §11) ------------------------------------
  { key: "home.headline", group: "home", label: "Headline", kind: "text", maxLength: 160, visibility: "public" },
  { key: "home.subheadline", group: "home", label: "Subheadline", kind: "multiline", maxLength: 600, visibility: "public" },
  { key: "home.cta_label", group: "home", label: "Texto do botão principal", kind: "text", maxLength: 60, visibility: "public" },
  { key: "home.hero_note", group: "home", label: "Nota abaixo dos botões", kind: "text", maxLength: 200, visibility: "public" },
  { key: "home.method_intro", group: "home", label: "Texto do Método EM", kind: "multiline", maxLength: 1200, visibility: "public" },
  { key: "home.mission", group: "home", label: "Missão", kind: "multiline", maxLength: 600, visibility: "public" },
  { key: "home.about_intro", group: "home", label: "Sobre — introdução", kind: "multiline", maxLength: 1200, visibility: "public" },
  { key: "home.about_philosophy", group: "home", label: "Sobre — filosofia", kind: "multiline", maxLength: 1600, visibility: "public" },

  // --- SEO (prompt §41) -------------------------------------------------
  { key: "seo.default_title", group: "seo", label: "Título padrão", kind: "text", maxLength: 70, help: "Usado quando a página não define um próprio.", visibility: "public" },
  { key: "seo.default_description", group: "seo", label: "Descrição padrão", kind: "multiline", maxLength: 180, visibility: "public" },
  { key: "seo.og_image_path", group: "seo", label: "Imagem de compartilhamento", kind: "asset", visibility: "public" },
] as const;

const BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function settingDefinition(key: string): SettingDefinition | undefined {
  return BY_KEY.get(key);
}

export function isKnownSettingKey(key: string): boolean {
  return BY_KEY.has(key);
}

export function settingsOfGroup(group: SettingGroupId): SettingDefinition[] {
  return SETTING_DEFINITIONS.filter((definition) => definition.group === group);
}

/**
 * `is_public` da linha, derivado SEMPRE no servidor. `showPublicAddress`
 * vem do valor salvo de `address.show_public` na mesma operação.
 */
export function resolveIsPublic(definition: SettingDefinition, showPublicAddress: boolean): boolean {
  if (definition.visibility === "public") return true;
  if (definition.visibility === "private") return false;
  return showPublicAddress;
}

export const SETTING_GROUP_LABELS: Record<SettingGroupId, string> = {
  professional: "Perfil profissional",
  contact: "Contato e canais",
  address: "Endereço",
  attendance: "Atendimento online",
  home: "Conteúdo da home",
  seo: "SEO",
};
