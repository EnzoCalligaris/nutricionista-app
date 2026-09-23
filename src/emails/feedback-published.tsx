import { EmailLayout, Paragraph } from "@/emails/components/layout";
import type { GenericEmailProps } from "@/emails/types";

/** Sem conteúdo clínico no e-mail (§34/§71): só o aviso e o CTA para o portal. */
export default function FeedbackPublishedEmail({ vars, siteUrl, portalUrl }: GenericEmailProps) {
  return (
    <EmailLayout preview="Você recebeu um novo feedback" heading="Novo feedback disponível" siteUrl={siteUrl} cta={{ label: "Ler no portal", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. {vars.nutritionistName} deixou um novo feedback para você.</Paragraph>
      <Paragraph>Acesse o portal para ler.</Paragraph>
    </EmailLayout>
  );
}
