import type { TemplateVariables } from "@/domain/notifications/templates";

export type GenericEmailProps = {
  vars: TemplateVariables;
  /** NEXT_PUBLIC_SITE_URL (config central) — nunca localhost hardcoded. */
  siteUrl: string;
  /** URL absoluta do CTA no portal (sessão autenticada; nunca id de recurso como autorização). */
  portalUrl: string;
};

export type AppointmentEmailProps = GenericEmailProps & {
  /** Link tokenizado de confirmação (só lembrete/solicitação) — gerado na hora do envio, nunca persistido em variáveis. */
  confirmUrl?: string | null;
};
