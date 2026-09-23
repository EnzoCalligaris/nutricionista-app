import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCircle2, CircleAlert, FlaskConical } from "lucide-react";
import { updateNutritionistNotificationPreferencesAction } from "@/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { requireNutritionist } from "@/lib/auth/session";
import { getNutritionistPreferenceMatrix } from "@/data/notifications";
import { CHANNEL_LABEL, EVENT_LABEL, TEMPLATE_KEY } from "@/domain/notifications/events";
import { REMINDER_DAYS_BEFORE } from "@/domain/notifications/reminder";
import { getProviderConfigStatus, getWhatsAppTemplateMap } from "@/services/notifications";

export const metadata: Metadata = { title: "Configurações de notificações" };
export const dynamic = "force-dynamic";

/**
 * Configurações de notificações (prompt Fase 12 §75): canais por evento,
 * chaves de template, status dos providers ("Configurado" / "Não
 * configurado" / "Simulado" — nunca o valor de uma chave; nada de editar
 * API key aqui). Os defaults são técnicos, não preferências reais do Enzo.
 */
export default async function ConfiguracoesNotificacoesPage() {
  const nutritionist = await requireNutritionist();
  const [matrix, statuses] = await Promise.all([getNutritionistPreferenceMatrix(nutritionist.id), Promise.resolve(getProviderConfigStatus())]);
  const templateMap = getWhatsAppTemplateMap();

  return (
    <div className="space-y-6">
      <FlashToast />
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/configuracoes" className="hover:underline">
            Configurações
          </Link>{" "}
          / Notificações
        </p>
        <h1 className="font-heading text-2xl font-medium">Notificações</h1>
        <p className="text-sm text-muted-foreground">Canais por tipo de aviso, provedores e templates. O aviso no portal do paciente é sempre entregue.</p>
      </div>

      <section aria-labelledby="providers" className="space-y-3">
        <h2 id="providers" className="font-heading text-lg font-medium">
          Provedores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <Card key={status.channel} data-testid={`provider-${status.channel.toLowerCase()}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="font-heading text-lg">{CHANNEL_LABEL[status.channel]}</CardTitle>
                  {status.configured ? (
                    status.simulated ? (
                      <Badge variant="outline" className="border-transparent bg-warning/15 text-warning-foreground">
                        <FlaskConical data-icon="inline-start" />
                        Simulado (fake)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                        <CheckCircle2 data-icon="inline-start" />
                        Configurado
                      </Badge>
                    )
                  ) : (
                    <Badge variant="destructive">
                      <CircleAlert data-icon="inline-start" />
                      Não configurado
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Provedor: <span className="font-mono">{status.provider}</span>
                  {status.from ? (
                    <>
                      {" "}
                      · remetente <span className="font-mono">{status.from}</span>
                    </>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {status.channel === "EMAIL"
                  ? status.simulated
                    ? "Nenhum e-mail real é enviado: as entregas são simuladas e registradas no histórico. Para envio real, configure EMAIL_PROVIDER=resend, RESEND_API_KEY e EMAIL_FROM no servidor."
                    : status.configured
                      ? "E-mails transacionais via Resend (React Email)."
                      : (status.problem ?? "Configuração incompleta no servidor.")
                  : status.simulated
                    ? "Nenhuma mensagem real é enviada. O provedor oficial (WhatsApp Business Platform / BSP) ainda não foi definido — quando for, entra como adapter com credenciais só no servidor. Automação de WhatsApp Web nunca é usada."
                    : status.configured
                      ? "WhatsApp Business Platform (oficial)."
                      : (status.problem ?? "Configuração incompleta no servidor.")}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Chaves e segredos são configurados apenas nas variáveis de ambiente do servidor — nunca por esta tela.</p>
      </section>

      <section aria-labelledby="canais" className="space-y-3">
        <h2 id="canais" className="font-heading text-lg font-medium">
          Canais por tipo de aviso
        </h2>
        <p className="text-sm text-muted-foreground">
          Lembretes saem {REMINDER_DAYS_BEFORE} dias antes da consulta (horário de Brasília). O paciente também pode desligar e-mail/WhatsApp para si no portal.
        </p>
        <form action={updateNutritionistNotificationPreferencesAction}>
          <Card className="overflow-x-auto py-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium sm:px-4">Evento</th>
                  <th className="hidden px-4 py-2 font-medium lg:table-cell">Template</th>
                  <th className="hidden px-4 py-2 text-center font-medium md:table-cell">Portal</th>
                  <th className="px-2 py-2 text-center font-medium sm:px-4">E-mail</th>
                  <th className="px-2 py-2 text-center font-medium sm:px-4">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.eventType} className="border-b border-border last:border-0" data-testid={`pref-${row.eventType}`}>
                    <td className="px-3 py-2.5 font-medium sm:px-4">
                      {EVENT_LABEL[row.eventType]}
                      <span className="block font-mono text-[11px] font-normal break-all text-muted-foreground lg:hidden">{TEMPLATE_KEY[row.eventType]}</span>
                    </td>
                    <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                      {TEMPLATE_KEY[row.eventType]}
                      {templateMap[TEMPLATE_KEY[row.eventType]] ? <span className="block">WA: {templateMap[TEMPLATE_KEY[row.eventType]]}</span> : null}
                    </td>
                    <td className="hidden px-4 py-2.5 text-center text-xs text-muted-foreground md:table-cell">sempre</td>
                    <td className="px-2 py-2.5 text-center sm:px-4">
                      <input type="checkbox" name={`${row.eventType}:EMAIL`} defaultChecked={row.channels.EMAIL} aria-label={`${EVENT_LABEL[row.eventType]} por e-mail`} className="size-4 accent-primary" />
                    </td>
                    <td className="px-2 py-2.5 text-center sm:px-4">
                      <input type="checkbox" name={`${row.eventType}:WHATSAPP`} defaultChecked={row.channels.WHATSAPP} aria-label={`${EVENT_LABEL[row.eventType]} por WhatsApp`} className="size-4 accent-primary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm">
              Salvar canais
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/notificacoes">
                <Bell data-icon="inline-start" />
                Ver histórico de entregas
              </Link>
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
