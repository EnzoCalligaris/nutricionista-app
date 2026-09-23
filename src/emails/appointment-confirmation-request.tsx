import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

export default function AppointmentConfirmationRequestEmail({ vars, siteUrl, portalUrl, confirmUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout
      preview={`Confirme sua consulta de ${vars.appointmentDateTime ?? ""}`}
      heading="Confirme sua consulta"
      siteUrl={siteUrl}
      cta={confirmUrl ? { label: "Confirmar presença", href: confirmUrl } : { label: "Ver minhas consultas", href: portalUrl }}
      secondaryCta={{ label: "Preciso reagendar", href: portalUrl }}
    >
      <Paragraph>Olá, {vars.patientFirstName}. {vars.nutritionistName} pede a confirmação da sua presença na consulta abaixo.</Paragraph>
      <Details>
        <DetailRow label="Data" value={vars.appointmentDateTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
        {vars.address ? <DetailRow label="Endereço" value={vars.address} /> : null}
      </Details>
    </EmailLayout>
  );
}
