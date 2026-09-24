import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

export default function AppointmentConfirmedEmail({ vars, siteUrl, portalUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout preview={`Consulta confirmada para ${vars.appointmentDateTime ?? ""}`} heading="Consulta confirmada" siteUrl={siteUrl} cta={{ label: "Ver minhas consultas", href: portalUrl }}>
      <Paragraph>Olá, {vars.patientFirstName}. Sua consulta está confirmada.</Paragraph>
      <Details>
        <DetailRow label="Data" value={vars.appointmentDateTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
        {vars.address ? <DetailRow label="Endereço" value={vars.address} /> : null}
        {vars.onlinePlatform ? <DetailRow label="Plataforma" value={vars.onlinePlatform} /> : null}
        {vars.onlineInstructions ? <DetailRow label="Como acessar" value={vars.onlineInstructions} /> : null}
      </Details>
    </EmailLayout>
  );
}
