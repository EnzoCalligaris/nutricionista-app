import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { GenericEmailProps } from "@/emails/types";

/** Confirmação de pagamento (Fase 13 §70) — não é recibo fiscal. */
export default function PaymentConfirmedEmail({ vars, siteUrl, portalUrl }: GenericEmailProps) {
  return (
    <EmailLayout preview="Pagamento confirmado" heading="Pagamento confirmado" siteUrl={siteUrl} cta={{ label: "Ver meus pagamentos", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. Recebemos seu pagamento.</Paragraph>
      <Details>
        <DetailRow label="Valor" value={vars.paymentAmount ?? "—"} />
        <DetailRow label="Forma" value={vars.paymentMethod ?? "—"} />
      </Details>
      <Paragraph>Você pode acompanhar suas parcelas e pagamentos no portal. Este aviso não é um recibo fiscal.</Paragraph>
    </EmailLayout>
  );
}
