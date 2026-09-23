import { EmailLayout, Paragraph } from "@/emails/components/layout";
import type { GenericEmailProps } from "@/emails/types";

/** Nunca nome, dose ou orientação no e-mail (§73). */
export default function SupplementRecommendationCreatedEmail({ vars, siteUrl, portalUrl }: GenericEmailProps) {
  return (
    <EmailLayout preview="Nova recomendação disponível no portal" heading="Nova recomendação disponível" siteUrl={siteUrl} cta={{ label: "Ver no portal", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. {vars.nutritionistName} registrou uma nova recomendação de suplemento para você.</Paragraph>
      <Paragraph>Os detalhes ficam no portal, na área Suplementos.</Paragraph>
    </EmailLayout>
  );
}
