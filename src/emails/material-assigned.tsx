import { EmailLayout, Paragraph } from "@/emails/components/layout";
import type { GenericEmailProps } from "@/emails/types";

/** Sem anexo (§73): o arquivo/link fica no portal, entregue por sessão autenticada. */
export default function MaterialAssignedEmail({ vars, siteUrl, portalUrl }: GenericEmailProps) {
  const suffix = vars.materialTitle ? `: "${vars.materialTitle}"` : "";
  return (
    <EmailLayout preview="Novo material disponível no portal" heading="Novo material disponível" siteUrl={siteUrl} cta={{ label: "Abrir no portal", href: portalUrl }}>
      <Paragraph>
        Olá, {vars.patientFirstName}. {vars.nutritionistName} disponibilizou um novo material{suffix}.
      </Paragraph>
      <Paragraph>Acesse o portal para ver.</Paragraph>
    </EmailLayout>
  );
}
