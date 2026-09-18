/**
 * Conteúdo editorial do site público — Fase 4. TODA afirmação aqui tem
 * origem em `references/Meu acompanhamento apresentação.pdf` (páginas
 * indicadas) ou em decisão explícita do projeto (docs/PROJECT_SPEC.md,
 * docs/DECISIONS.md). Nada de CRN, telefone, endereço, número de pacientes,
 * taxa de sucesso, depoimento ou promessa de emagrecimento — o que não
 * existe no material simplesmente não aparece.
 *
 * Reescrito em copy natural (prompt Fase 4 §4: "não copie grandes blocos
 * literalmente"), preservando o significado original.
 */

export type Phase = {
  key: "antes" | "durante" | "depois";
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
};

/**
 * Antes / durante / depois — o eixo do Método EM (docs/PROJECT_SPEC.md §1).
 * Fontes: PDF p. 21 (fluxo: pré-consulta gratuita → onboarding → anamnese →
 * contrato → consulta), p. 9 (consultas, planejamento), p. 10 (aplicativo,
 * acompanhamento de perto), p. 12/23/25 (avaliação antropométrica /
 * bioimpedância, exames, check-list quinzenal, suporte).
 *
 * O passo "boas-vindas no grupo de WhatsApp" do PDF NÃO entra: dependia do
 * grupo exclusivo, removido da oferta (docs/DECISIONS.md).
 */
export const METHOD_PHASES: Phase[] = [
  {
    key: "antes",
    eyebrow: "Antes da consulta",
    title: "O acompanhamento começa antes de você sentar na cadeira",
    description:
      "Uma pré-consulta gratuita para entender seu momento, seguida de onboarding e do formulário de anamnese. Quando a consulta acontece, o Enzo já conhece sua rotina, seu histórico e seus objetivos.",
    items: ["Pré-consulta gratuita", "Onboarding", "Formulário de anamnese pré-consulta", "Assinatura do contrato"],
  },
  {
    key: "durante",
    eyebrow: "Na consulta",
    title: "Avaliação, escuta e uma estratégia desenhada para você",
    description:
      "Consulta presencial ou online para explorar juntos as suas dificuldades, avaliar onde você está e definir um planejamento alimentar fácil de seguir, alinhado às suas necessidades, possibilidades e objetivos.",
    items: [
      "Consulta com o nutricionista",
      "Avaliação antropométrica e/ou bioimpedância",
      "Análise de exames laboratoriais",
      "Planejamento alimentar individualizado",
    ],
  },
  {
    key: "depois",
    eyebrow: "Depois da consulta",
    title: "Acompanhamento de perto, ajustes e evolução",
    description:
      "A cada quinze dias você envia foto, peso e feedback por um check-list. É a partir disso que o plano é ajustado sempre que necessário — para a evolução ser constante, e não depender de força de vontade.",
    items: [
      "Check-list quinzenal com foto, peso e feedback",
      "Ajustes no planejamento sempre que necessário",
      "Suporte de segunda a sábado (08h–18h)",
      "Lista de compras e materiais complementares",
    ],
  },
];

export type Pillar = {
  key: string;
  title: string;
  description: string;
};

/**
 * Pilares atuais. O PDF (p. 8) listava seis; "Grupo exclusivo com a
 * equipe" foi removido da oferta e "Comunidade VIP" está PENDENTE DE
 * DEFINIÇÃO — nenhum dos dois é publicado (docs/DECISIONS.md, Fase 4).
 * Ficam os quatro que seguem válidos (docs/PROJECT_SPEC.md §2). O
 * "aplicativo de dietas" do PDF corresponde ao módulo de cardápio da
 * própria plataforma, não a um app de terceiro.
 */
export const PILLARS: Pillar[] = [
  {
    key: "consultas",
    title: "Consultas",
    description:
      "Presenciais ou online, para explorar juntos as suas dificuldades e manter a evolução constante — não uma visita isolada.",
  },
  {
    key: "planejamento",
    title: "Planejamento nutricional",
    description:
      "Plano alimentar fácil de seguir, individualizado e alinhado às suas necessidades e objetivos. Muda sempre que precisar mudar.",
  },
  {
    key: "plataforma",
    title: "Seu plano sempre à mão",
    description:
      "A estrutura da sua dieta e os materiais de apoio ficam acessíveis na plataforma, para facilitar boas escolhas no dia a dia.",
  },
  {
    key: "acompanhamento",
    title: "Acompanhamento de perto",
    description:
      "Check-list quinzenal com foto, peso e feedback. É assim que os ajustes acontecem no tempo certo.",
  },
];

/** PDF p. 4 — benefícios do acompanhamento, reescritos sem promessa de resultado. */
export const BENEFITS: string[] = [
  "Mais qualidade de vida e longevidade",
  "Perda de gordura e/ou ganho de massa muscular, conforme o seu objetivo",
  "Mais confiança e autoestima ao longo do processo",
  "Prevenção de doenças crônicas",
  "Um planejamento totalmente individualizado, com acompanhamento integral",
];

/** PDF p. 3 — a proposta em uma frase. */
export const MISSION =
  "Fazer com que você alcance os seus objetivos de forma descomplicada, mantendo sua saúde física e mental, sem comprometer sua rotina social.";

/** PDF p. 2 e 22 — em primeira pessoa, para a página Sobre. */
export const ABOUT = {
  intro:
    "Sou nutricionista clínico, com foco em emagrecimento funcional, hipertrofia e saúde. Nos últimos dois anos venho me dedicando à capacitação em emagrecimento e nutrição — e a acompanhar pessoas de perto.",
  philosophy:
    "Gosto de uma nutrição descomplicada, alinhada com a sua individualidade e os seus objetivos. Vamos juntos além de contar calorias: o que busco é um planejamento que se adapte à sua rotina e ao seu estilo de vida, com flexibilidade e praticidade — e resultados reais, sem complicação e do seu jeito.",
  closing:
    "Quero te ajudar a transformar não só o seu corpo, mas também a sua saúde física e mental, com equilíbrio e leveza. É um caminho que a gente percorre lado a lado.",
};
