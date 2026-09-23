import type { Metadata } from "next";
import { updatePatientNotificationPreferencesAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { NotificationsList } from "@/components/portal/notifications-list";
import { requirePatient } from "@/lib/auth/session";
import { getPatientNotificationPreference, listPortalNotifications } from "@/data/notifications";
import { getPatientBookingContext } from "@/services/scheduling";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

/**
 * Notificações do portal (prompt Fase 12 §21/§97): lista in-app do próprio
 * paciente + preferências de canal externo (e-mail/WhatsApp). O in-app é
 * sempre entregue; as preferências não são opt-in de marketing (não existe
 * marketing) — só avisos operacionais do acompanhamento.
 */
export default async function NotificacoesPage() {
  const profile = await requirePatient();
  const [items, context] = await Promise.all([listPortalNotifications(profile.id), getPatientBookingContext(profile.id)]);
  const preference = context ? await getPatientNotificationPreference(context.patientId) : null;

  return (
    <div className="space-y-6">
      <FlashToast />
      <div>
        <h1 className="font-heading text-2xl font-medium">Notificações</h1>
        <p className="text-sm text-muted-foreground">Avisos sobre consultas, lembretes, feedbacks, materiais e recomendações.</p>
      </div>

      <NotificationsList items={items} />

      {preference ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Como você quer ser avisado</CardTitle>
            <CardDescription>Os avisos sempre aparecem aqui no portal. Escolha se também quer recebê-los por e-mail e WhatsApp (quando houver contato cadastrado).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePatientNotificationPreferencesAction} className="space-y-4">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="emailEnabled" defaultChecked={preference.emailEnabled} className="mt-0.5 size-4 accent-primary" />
                <span>
                  <span className="font-medium">E-mail</span>
                  <span className="block text-muted-foreground">Consultas, lembretes e novidades do acompanhamento por e-mail.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="whatsappEnabled" defaultChecked={preference.whatsappEnabled} className="mt-0.5 size-4 accent-primary" />
                <span>
                  <span className="font-medium">WhatsApp</span>
                  <span className="block text-muted-foreground">Avisos de consulta e lembretes pelo WhatsApp (canal oficial).</span>
                </span>
              </label>
              <Button type="submit" size="sm">
                Salvar preferências
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
