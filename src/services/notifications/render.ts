import { createElement } from "react";
import { render } from "@react-email/render";
import type { NotificationEventType } from "@/domain/notifications/events";
import { emailSubject, type TemplateVariables } from "@/domain/notifications/templates";
import { EMAIL_TEMPLATES } from "@/emails";

/**
 * Renderiza o template React Email do evento em HTML + texto (prompt Fase 12
 * §32/§35). Sem "server-only" de propósito: o script de preview local
 * (`scripts/render-email-previews.mjs`) e os testes usam a mesma função.
 * Links absolutos vêm de `siteUrl` (config central); o `confirmUrl` é
 * injetado pelo worker na hora do envio e nunca persistido.
 */
export type RenderedEmail = { subject: string; html: string; text: string };

export async function renderNotificationEmail(input: {
  eventType: NotificationEventType;
  vars: TemplateVariables;
  siteUrl: string;
  confirmUrl?: string | null;
}): Promise<RenderedEmail> {
  const Template = EMAIL_TEMPLATES[input.eventType];
  const base = input.siteUrl.replace(/\/+$/, "");
  const element = createElement(Template, { vars: input.vars, siteUrl: base, portalUrl: `${base}${input.vars.portalPath}`, confirmUrl: input.confirmUrl ?? null });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: emailSubject(input.eventType, input.vars), html, text };
}
