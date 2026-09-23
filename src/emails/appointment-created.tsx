import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

export default function AppointmentCreatedEmail({ vars, siteUrl, portalUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout preview={`Consulta agendada para ${vars.appointmentDateTime ?? ""}`} heading="Consulta agendada" siteUrl={siteUrl} cta={{ label: "Ver minhas consultas", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. Sua consulta com {vars.nutritionistName} foi agendada.</Paragraph>
      <Details>
        <DetailRow label="Data" value={vars.appointmentDate ?? "—"} />
        <DetailRow label="Horário" value={vars.appointmentTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
        {vars.address ? <DetailRow label="Endereço" value={vars.address} /> : null}
      </Details>
      <Paragraph>Se precisar remarcar, faça isso pelo portal com antecedência.</Paragraph>
    </EmailLayout>
  );
}
