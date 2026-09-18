import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Condições de uso do site e da plataforma do Método EM.",
  alternates: { canonical: "/termos" },
};

/**
 * Termos iniciais coerentes com o que a plataforma faz hoje (prompt Fase 4
 * §34). Sem CNPJ, razão social ou foro inventados. Revisão jurídica
 * específica é PENDENTE DE DEFINIÇÃO antes da produção.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "1. Sobre este site e a plataforma",
    paragraphs: [
      `O site e a plataforma do ${siteConfig.name} são mantidos por ${siteConfig.professional.name}, ${siteConfig.professional.title.toLowerCase()}, para apresentar o acompanhamento nutricional oferecido e para dar suporte a pacientes em acompanhamento por meio do portal do paciente.`,
    ],
  },
  {
    title: "2. Conteúdo informativo",
    paragraphs: [
      "Os textos do site e do blog têm caráter informativo e educativo. Eles não substituem consulta, avaliação ou orientação individualizada de um profissional de saúde, e não devem ser usados para autodiagnóstico ou automedicação.",
    ],
  },
  {
    title: "3. Planos, valores e contratação",
    paragraphs: [
      "Os formatos de acompanhamento e seus valores são apresentados no site a título de referência e podem ser confirmados ou ajustados na pré-consulta. A contratação é formalizada por contrato específico, que prevalece sobre as informações gerais do site em caso de divergência.",
      "Nenhuma consulta é considerada agendada ou confirmada apenas pelo envio de um formulário no site; a confirmação ocorre pelos canais de atendimento.",
    ],
  },
  {
    title: "4. Portal do paciente",
    paragraphs: [
      "O acesso ao portal é pessoal e intransferível. Você é responsável por manter sua senha em sigilo e por comunicar qualquer uso não autorizado da sua conta.",
      "Os conteúdos do portal — planejamento alimentar, avaliações, materiais e orientações — são elaborados para o paciente a quem se destinam e não devem ser compartilhados ou aplicados a terceiros.",
    ],
  },
  {
    title: "5. Resultados e uso de imagem",
    paragraphs: [
      "Resultados de evolução só são publicados com consentimento específico do paciente, que pode ser revogado a qualquer momento. Os resultados apresentados são individuais e não constituem promessa ou garantia de resultado para outras pessoas.",
    ],
  },
  {
    title: "6. Propriedade intelectual",
    paragraphs: [
      `Textos, marca, logotipo e materiais do ${siteConfig.name} pertencem a ${siteConfig.professional.name} e não podem ser reproduzidos sem autorização, exceto para uso pessoal e não comercial do paciente no contexto do seu acompanhamento.`,
    ],
  },
  {
    title: "7. Privacidade",
    paragraphs: [
      "O tratamento de dados pessoais é descrito na Política de Privacidade, que integra estes termos.",
    ],
  },
  {
    title: "8. Alterações",
    paragraphs: [
      "Estes termos podem ser atualizados para refletir mudanças na plataforma ou na legislação. A data da última revisão aparece no topo da página.",
    ],
  },
];

export default function TermosPage() {
  return (
    <LegalPage
      eyebrow="Termos"
      title="Termos de uso"
      updatedAt="17 de setembro de 2026"
      intro="Condições para o uso deste site e do portal do paciente do Método EM."
      sections={SECTIONS}
    />
  );
}
