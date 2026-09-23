import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

export default function AppointmentCancelledEmail({ vars, siteUrl, portalUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout preview={`Consulta de ${vars.appointmentDateTime ?? ""} cancelada`} heading="Consulta cancelada" siteUrl={siteUrl} cta={{ label: "Agendar nova consulta", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. A consulta abaixo foi cancelada.</Paragraph>
      <Details>
        <DetailRow label="Data" value={vars.appointmentDateTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
      </Details>
      <Paragraph>Quando quiser, agende um novo horário pelo portal.</Paragraph>
    </EmailLayout>
  );
}
