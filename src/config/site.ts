import { env } from "@/lib/env";

/**
 * Configuração pública central da aplicação. Nenhum dado real de contato
 * (telefone, CRN, endereço, redes sociais) entra aqui enquanto estiver
 * PENDENTE DE DEFINIÇÃO — ver docs/DECISIONS.md. Esses dados vêm de
 * `site_settings` (src/data/site-settings.ts) quando configurados.
 *
 * Os fatos profissionais abaixo vêm literalmente do PDF de referência
 * (`references/Meu acompanhamento apresentação.pdf`, páginas 2–3) — nada
 * além do que está lá.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo" as const;

export const siteConfig = {
  name: "Método EM",
  fullName: "Enzo Mangili — Nutricionista",
  /** Centralizado: local vem do default de env.ts (http://localhost:3000), produção vem de NEXT_PUBLIC_SITE_URL. */
  url: env.NEXT_PUBLIC_SITE_URL,
  description:
    "Método EM: acompanhamento nutricional completo com Enzo Mangili — antes, durante e depois da consulta, com planejamento individualizado e evolução acompanhada de perto.",
  locale: "pt-BR",
  timeZone: DEFAULT_TIME_ZONE,
  professional: {
    name: "Enzo Mangili",
    title: "Nutricionista clínico",
    specialties: ["emagrecimento funcional", "hipertrofia", "saúde"],
    /** "2 anos mudando vidas com experiência em capacitação em emagrecimento e nutrição." — PDF p. 2 */
    experience: "2 anos de experiência em capacitação em emagrecimento e nutrição",
  },
  nav: [
    { href: "/", label: "Início" },
    { href: "/metodo-em", label: "Método EM" },
    { href: "/sobre", label: "Sobre" },
    { href: "/acompanhamento", label: "Acompanhamento" },
    { href: "/resultados", label: "Resultados" },
    { href: "/blog", label: "Blog" },
  ],
  footerNav: [
    { href: "/metodo-em", label: "Método EM" },
    { href: "/acompanhamento", label: "Acompanhamento" },
    { href: "/planos", label: "Planos" },
    { href: "/resultados", label: "Resultados" },
    { href: "/blog", label: "Blog" },
    { href: "/contato", label: "Contato" },
    { href: "/agendar", label: "Agendar" },
  ],
  legalNav: [
    { href: "/politica-de-privacidade", label: "Política de privacidade" },
    { href: "/termos", label: "Termos de uso" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
