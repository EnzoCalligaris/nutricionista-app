/**
 * Configuração pública central da aplicação. Nenhum dado real de contato
 * (telefone, CRN, endereço) entra aqui enquanto estiver PENDENTE DE DEFINIÇÃO —
 * ver docs/DECISIONS.md.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo" as const;

export const siteConfig = {
  name: "Método EM",
  fullName: "Enzo Mangili — Nutricionista",
  description:
    "Metodologia de acompanhamento nutricional de Enzo Mangili: pré-consulta, consulta, pós-consulta e evolução contínua do paciente.",
  locale: "pt-BR",
  timeZone: DEFAULT_TIME_ZONE,
} as const;

export type SiteConfig = typeof siteConfig;
