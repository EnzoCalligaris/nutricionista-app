import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

export default function AppointmentRescheduledEmail({ vars, siteUrl, portalUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout preview={`Consulta reagendada para ${vars.appointmentDateTime ?? ""}`} heading="Consulta reagendada" siteUrl={siteUrl} cta={{ label: "Ver minhas consultas", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. Sua consulta com {vars.nutritionistName} foi reagendada.</Paragraph>
      <Details>
        {vars.previousDateTime ? <DetailRow label="Antes" value={vars.previousDateTime} /> : null}
        <DetailRow label="Novo horário" value={vars.appointmentDateTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
        {vars.address ? <DetailRow label="Endereço" value={vars.address} /> : null}
        {vars.onlinePlatform ? <DetailRow label="Plataforma" value={vars.onlinePlatform} /> : null}
        {vars.onlineInstructions ? <DetailRow label="Como acessar" value={vars.onlineInstructions} /> : null}
      </Details>
    </EmailLayout>
  );
}
