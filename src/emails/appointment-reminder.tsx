import { DetailRow, Details, EmailLayout, Paragraph } from "@/emails/components/layout";
import type { AppointmentEmailProps } from "@/emails/types";

/** Lembrete ~5 dias antes (§42/§48): Confirmar presença (link tokenizado) + Reagendar (portal autenticado). */
export default function AppointmentReminderEmail({ vars, siteUrl, portalUrl, confirmUrl }: AppointmentEmailProps) {
  return (
    <EmailLayout
      preview={`Lembrete: sua consulta é em ${vars.appointmentDateTime ?? "breve"}`}
      heading="Lembrete de consulta"
      siteUrl={siteUrl}
      cta={confirmUrl ? { label: "Confirmar presença", href: confirmUrl } : { label: "Ver minhas consultas", href: portalUrl }}
      secondaryCta={{ label: "Preciso reagendar", href: portalUrl }}
    >
      <Paragraph>Olá, {vars.patientFirstName}. Sua consulta com {vars.nutritionistName} está chegando.</Paragraph>
      <Details>
        <DetailRow label="Data" value={vars.appointmentDate ?? "—"} />
        <DetailRow label="Horário" value={vars.appointmentTime ?? "—"} />
        <DetailRow label="Modalidade" value={vars.modality ?? "—"} />
        {vars.address ? <DetailRow label="Endereço" value={vars.address} /> : null}
        {vars.onlinePlatform ? <DetailRow label="Plataforma" value={vars.onlinePlatform} /> : null}
        {vars.onlineInstructions ? <DetailRow label="Como acessar" value={vars.onlineInstructions} /> : null}
      </Details>
      <Paragraph>Confirme sua presença para mantermos o horário reservado. Se não puder comparecer, reagende pelo portal.</Paragraph>
    </EmailLayout>
  );
}
