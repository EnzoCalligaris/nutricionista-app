import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { siteConfig } from "@/config/site";
import { getContactInfo } from "@/data/site-settings";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como os dados pessoais são tratados na plataforma do Método EM.",
  alternates: { canonical: "/politica-de-privacidade" },
  robots: { index: true, follow: true },
};

/**
 * Estrutura inicial (prompt Fase 4 §33): controlador, dados, finalidades,
 * direitos e contato. Nada de CNPJ, razão social ou endereço jurídico
 * inventados — quando o canal de contato não está configurado, o texto
 * aponta para a página de contato. Revisão jurídica específica continua
 * PENDENTE DE DEFINIÇÃO (docs/DECISIONS.md) antes da produção (Fase 16).
 */
export default async function PrivacidadePage() {
  const contact = await getContactInfo();
  const contactChannel = contact.email
    ? `pelo e-mail ${contact.email}`
    : "pelos canais indicados na página de contato deste site";

  const sections: LegalSection[] = [
    {
      title: "1. Quem é o responsável pelo tratamento",
      paragraphs: [
        `Os dados pessoais tratados nesta plataforma são de responsabilidade de ${siteConfig.professional.name}, ${siteConfig.professional.title.toLowerCase()}, na condição de controlador, conforme a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).`,
      ],
    },
    {
      title: "2. Quais dados são tratados",
      paragraphs: ["Dependendo de como você usa a plataforma, podem ser tratados:"],
      items: [
        "Dados de identificação e contato (nome, e-mail, telefone) informados por você no cadastro, no agendamento ou no formulário de contato.",
        "Dados de conta e acesso (e-mail de login, registros de sessão) necessários para o portal do paciente.",
        "Dados de saúde fornecidos no acompanhamento nutricional: anamnese, avaliações antropométricas e de bioimpedância, exames laboratoriais, planejamento alimentar, feedbacks e fotos de refeições — tratados como dados pessoais sensíveis.",
        "Fotos de evolução (antes e depois), somente com consentimento específico e separado para uso de imagem.",
      ],
    },
    {
      title: "3. Para que os dados são usados",
      paragraphs: ["Os dados são tratados para as seguintes finalidades:"],
      items: [
        "Prestar o acompanhamento nutricional contratado, incluindo consultas, planejamento alimentar, avaliações e ajustes.",
        "Operar o portal do paciente e o agendamento de consultas.",
        "Enviar comunicações relacionadas ao acompanhamento (lembretes de consulta, feedbacks, materiais).",
        "Cumprir obrigações legais e regulatórias aplicáveis à atividade do nutricionista.",
        "Publicar resultados de evolução no site, exclusivamente quando houver consentimento de imagem registrado e não revogado.",
      ],
    },
    {
      title: "4. Base legal",
      paragraphs: [
        "O tratamento de dados de saúde ocorre para a tutela da saúde, em procedimento realizado por profissional de saúde, e para a execução do acompanhamento contratado. O uso de imagem em resultados publicados depende de consentimento específico, que pode ser revogado a qualquer momento — a revogação retira o resultado do site.",
      ],
    },
    {
      title: "5. Armazenamento e segurança",
      paragraphs: [
        "Fotos, documentos e dados clínicos ficam em armazenamento privado, com acesso restrito ao próprio paciente e ao nutricionista responsável, mediante autenticação. A plataforma aplica controle de acesso por papel e políticas de segurança no banco de dados para impedir que um paciente acesse dados de outro.",
        "O prazo de retenção de dados de pacientes inativos está sendo definido e será informado nesta política antes da operação em produção.",
      ],
    },
    {
      title: "6. Seus direitos",
      paragraphs: ["Você pode, a qualquer momento, solicitar:"],
      items: [
        "Confirmação da existência de tratamento e acesso aos seus dados.",
        "Correção de dados incompletos, inexatos ou desatualizados.",
        "Revogação do consentimento de uso de imagem.",
        "Informações sobre o compartilhamento dos seus dados.",
        "Eliminação dos dados tratados com base em consentimento, observadas as obrigações legais de guarda de registros.",
      ],
    },
    {
      title: "7. Como falar sobre privacidade",
      paragraphs: [
        `Pedidos relacionados aos seus dados podem ser feitos ${contactChannel}. Esta política pode ser atualizada; a data da última revisão aparece no topo da página.`,
      ],
    },
  ];

  return (
    <LegalPage
      eyebrow="Privacidade"
      title="Política de privacidade"
      updatedAt="17 de setembro de 2026"
      intro="Esta página explica, de forma direta, quais dados pessoais a plataforma do Método EM trata, para quê, e quais são os seus direitos."
      sections={sections}
    />
  );
}
