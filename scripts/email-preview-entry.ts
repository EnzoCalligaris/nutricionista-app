import { NOTIFICATION_EVENT_TYPES, TEMPLATE_KEY, type NotificationEventType } from "@/domain/notifications/events";
import { buildTemplateVariables } from "@/domain/notifications/templates";
import { renderNotificationEmail, type RenderedEmail } from "@/services/notifications/render";

/**
 * Entrada do preview local de e-mails (carregada via Vite SSR por
 * scripts/render-email-previews.mjs). Dados FICTÍCIOS e claramente de
 * exemplo — nada é enviado; só HTML em ./screenshots/fase-12/emails/.
 */
export async function renderAll(siteUrl: string): Promise<Array<RenderedEmail & { key: string; eventType: NotificationEventType }>> {
  const payload = {
    appointment_id: "00000000-0000-0000-0000-000000000000",
    starts_at: "2026-09-24T17:30:00Z",
    ends_at: "2026-09-24T18:30:00Z",
    modality: "IN_PERSON" as const,
    previous_starts_at: "2026-09-20T17:00:00Z",
    material_title: "Guia de rotulagem (exemplo)",
  };
  const out = [];
  for (const eventType of NOTIFICATION_EVENT_TYPES) {
    const vars = buildTemplateVariables({ eventType, payload, patientName: "Maria Exemplo", nutritionistName: "Enzo Mangili" });
    const rendered = await renderNotificationEmail({ eventType, vars, siteUrl, confirmUrl: `${siteUrl}/confirmar/EXEMPLO-TOKEN-NAO-USAR` });
    out.push({ key: TEMPLATE_KEY[eventType], eventType, ...rendered });
  }
  return out;
}
