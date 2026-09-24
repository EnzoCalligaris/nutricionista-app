/**
 * FALLBACK VERSIONADO do conteúdo público configurável (prompt Fase 14 §12).
 *
 * Enquanto a chave correspondente não existir em `site_settings`, o site
 * renderiza exatamente o texto abaixo — que é, palavra por palavra, a copy
 * aprovada na Fase 4 (prompt §92: "preservar exatamente o conteúdo atual...
 * não reescrever copy sem pedido"). Depois que o nutricionista salvar pelo
 * dashboard, o BANCO passa a ser a fonte e este arquivo só serve de rede de
 * segurança se a chave for apagada.
 *
 * `SITE_CONTENT_FALLBACK_VERSION` muda somente quando a copy de fallback
 * mudar — serve para rastrear qual texto um ambiente está exibindo.
 */

export const SITE_CONTENT_FALLBACK_VERSION = "fase-4-v1" as const;

export const SITE_CONTENT_FALLBACK = {
  /** Hero da home — `src/components/marketing/hero.tsx` (Fase 4). */
  headline: "Nutrição que vai além de receber uma dieta.",
  subheadline:
    "O Método EM é um acompanhamento nutricional completo: começa antes da consulta, define um planejamento feito para a sua rotina e continua depois — com ajustes e evolução acompanhados de perto pelo Enzo Mangili.",
  ctaLabel: "Começar acompanhamento",
  heroNote: "Emagrecimento funcional, hipertrofia e saúde — sem comprometer a sua rotina social.",

  /** Bloco "O que é o Método EM" da home — `src/app/(public)/page.tsx`. */
  methodIntro:
    "EM são as iniciais de Enzo Mangili — e também o jeito de trabalhar: antes, durante e depois da consulta. Em vez de entregar um cardápio e esperar o retorno, o acompanhamento se organiza em pré-consulta, consulta, ajustes e evolução.",
  /** `MISSION` de `src/content/metodo-em.ts` (PDF p. 2). */
  mission:
    "Fazer com que você alcance os seus objetivos de forma descomplicada, mantendo sua saúde física e mental, sem comprometer sua rotina social.",

  /** `ABOUT` de `src/content/metodo-em.ts` (PDF p. 2 e 22). */
  aboutIntro:
    "Sou nutricionista clínico, com foco em emagrecimento funcional, hipertrofia e saúde. Nos últimos dois anos venho me dedicando à capacitação em emagrecimento e nutrição — e a acompanhar pessoas de perto.",
  aboutPhilosophy:
    "Gosto de uma nutrição descomplicada, alinhada com a sua individualidade e os seus objetivos. Vamos juntos além de contar calorias: o que busco é um planejamento que se adapte à sua rotina e ao seu estilo de vida, com flexibilidade e praticidade — e resultados reais, sem complicação e do seu jeito.",
} as const;

export type SiteContent = { -readonly [K in keyof typeof SITE_CONTENT_FALLBACK]: string };
