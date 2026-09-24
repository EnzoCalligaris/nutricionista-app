/**
 * Consentimento OPERACIONAL de uso de imagem, versão v1 (prompt Fase 14 §88).
 *
 * ⚠️ REVISÃO JURÍDICA PENDENTE — este texto NÃO é um parecer jurídico nem um
 * termo definitivo. Ele descreve, em linguagem simples, o que a plataforma
 * realmente faz com a imagem (o que é verificável no código: bucket privado,
 * entrega server-side, revogação que tira do ar na hora). Antes de produção,
 * o texto precisa de revisão por advogado — e a versão revisada entra como
 * `image_use_v2`, sem sobrescrever os consentimentos já aceitos em v1.
 *
 * A plataforma NÃO afirma conformidade jurídica plena com a LGPD (§89): o que
 * existe são controles técnicos — consentimento registrado e versionado,
 * revogação com efeito imediato, minimização (nenhum dado clínico vai ao
 * site), acesso restrito por RLS e auditoria.
 */

export const MEDIA_CONSENT_VERSION = "image_use_v1" as const;

export const MEDIA_CONSENT_TYPE = "BEFORE_AFTER_PHOTOS" as const;

export const MEDIA_CONSENT_LEGAL_REVIEW_PENDING = true as const;

export const MEDIA_CONSENT_DOCUMENT = {
  version: MEDIA_CONSENT_VERSION,
  title: "Autorização de uso de imagem — resultados antes e depois",
  summary:
    "Autorizo o uso das minhas fotos de antes e depois do acompanhamento nutricional na divulgação do trabalho do nutricionista, no formato de identificação que eu escolher, e sei que posso revogar esta autorização a qualquer momento.",
  clauses: [
    "As fotos ficam guardadas em armazenamento privado. Elas não têm endereço público: o site as entrega por uma rota do próprio servidor, apenas enquanto esta autorização estiver válida.",
    "Escolho como quero ser identificado: de forma anônima, pelo primeiro nome, pelas iniciais ou pelo nome completo. Nenhum outro dado meu é publicado — nem medidas, nem exames, nem histórico clínico.",
    "Posso revogar esta autorização quando quiser, sem precisar justificar. Assim que a revogação é registrada, o resultado sai do site imediatamente, sem depender de nenhuma ação manual.",
    "A revogação vale para o futuro. Ela não alcança material impresso ou compartilhado por terceiros antes da revogação, o que está fora do controle da plataforma.",
    "O registro desta autorização guarda apenas: quem autorizou, a finalidade, a data, a versão deste texto, o formato de identificação escolhido e, quando houver, onde a autorização foi coletada.",
  ],
  /** Onde/como o consentimento foi capturado — preenchido pelo nutricionista. */
  evidenceHint:
    "Ex.: termo assinado em papel arquivado no consultório, autorização por e-mail em 00/00/0000, formulário assinado digitalmente.",
} as const;

export type MediaConsentDocument = typeof MEDIA_CONSENT_DOCUMENT;
