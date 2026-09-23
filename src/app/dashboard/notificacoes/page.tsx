import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RetryDeliveryButton, RunCycleButton } from "@/components/notifications/delivery-actions";
import { ChannelBadge, DeliveryStatusBadge, eventLabel } from "@/components/notifications/delivery-badges";
import { requireNutritionist } from "@/lib/auth/session";
import { countDeliveriesByStatus, listDeliveries, listScheduledEvents } from "@/data/notifications";
import { CHANNEL_LABEL, EVENT_LABEL, NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_TYPES } from "@/domain/notifications/events";
import { canRetryManually, DELIVERY_STATUS_LABEL, ERROR_CODE_LABEL, SKIP_REASON_LABEL, type ProviderErrorCode } from "@/domain/notifications/retry";
import { formatDateTime } from "@/lib/dates";
import { deliveryFiltersSchema } from "@/validators/notifications";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "PROCESSING", "SENT", "DELIVERED", "FAILED", "CANCELLED", "SKIPPED"] as const;

function errorLabel(code: string | null, http: number | null): string {
  if (!code) return "—";
  const label = (ERROR_CODE_LABEL as Record<string, string>)[code as ProviderErrorCode] ?? code;
  return http ? `${label} (HTTP ${http})` : label;
}

function detail(item: { status: string; skippedReason: string | null; lastErrorCode: string | null; lastHttpStatus: number | null; nextAttemptAt: string | null }): string {
  if (item.status === "SKIPPED") return item.skippedReason ? (SKIP_REASON_LABEL[item.skippedReason] ?? item.skippedReason) : "—";
  if (item.status === "PENDING" && item.nextAttemptAt && item.lastErrorCode) return `${errorLabel(item.lastErrorCode, item.lastHttpStatus)} · nova tentativa ${formatDateTime(item.nextAttemptAt)}`;
  if (item.status === "FAILED") return errorLabel(item.lastErrorCode, item.lastHttpStatus);
  return "—";
}

/**
 * Histórico operacional de entregas (prompt Fase 12 §80): canal, evento,
 * destinatário MASCARADO, status, tentativas, erro sanitizado, ações. Nunca
 * token, resposta do provider, mensagem clínica ou segredo.
 */
export default async function NotificacoesDashboardPage({ searchParams }: PageProps<"/dashboard/notificacoes">) {
  const nutritionist = await requireNutritionist();
  const raw = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filters = deliveryFiltersSchema.safeParse({ status: pick(raw.status), channel: pick(raw.channel), eventType: pick(raw.eventType) });
  const active = filters.success ? filters.data : { status: "ALL" as const, channel: "ALL" as const, eventType: "ALL" as const };
  const [deliveries, counts, scheduled] = await Promise.all([listDeliveries(nutritionist.id, active), countDeliveriesByStatus(nutritionist.id), listScheduledEvents(nutritionist.id, 10)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium">Notificações</h1>
          <p className="text-sm text-muted-foreground">Últimas entregas por canal, falhas e tentativas. Conteúdo das mensagens não é exibido aqui.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RunCycleButton />
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/configuracoes/notificacoes">
              <Settings data-icon="inline-start" />
              Configurações
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" data-testid="delivery-counts">
        {STATUSES.map((status) => (
          <Card key={status} className="py-3">
            <CardContent className="space-y-0.5 px-4">
              <p className="text-xs text-muted-foreground">{DELIVERY_STATUS_LABEL[status]}</p>
              <p className="font-heading text-2xl tabular-nums">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <form method="get" className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl" aria-label="Filtros">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <NativeSelect name="status" defaultValue={active.status}>
            <option value="ALL">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {DELIVERY_STATUS_LABEL[status]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Canal</span>
          <NativeSelect name="channel" defaultValue={active.channel}>
            <option value="ALL">Todos</option>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABEL[channel]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Evento</span>
          <NativeSelect name="eventType" defaultValue={active.eventType}>
            <option value="ALL">Todos</option>
            {NOTIFICATION_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" variant="outline">
            Filtrar
          </Button>
        </div>
      </form>

      {deliveries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma entrega registrada{active.status !== "ALL" || active.channel !== "ALL" || active.eventType !== "ALL" ? " com estes filtros" : ""}.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Entregas aparecem quando uma consulta é agendada, reagendada ou cancelada, um lembrete vence, ou um feedback, material ou suplemento é disponibilizado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Quando</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tent.</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((item) => (
                  <TableRow key={item.id} data-testid="delivery-row" data-status={item.status} data-channel={item.channel}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="max-w-44 truncate" title={eventLabel(item.eventType)}>{eventLabel(item.eventType)}</TableCell>
                    <TableCell className="max-w-36 truncate">
                      {item.patientId ? (
                        <Link href={`/dashboard/pacientes/${item.patientId}`} className="hover:underline">
                          {item.patientName ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={item.channel} />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{item.recipientMasked}</TableCell>
                    <TableCell>
                      <DeliveryStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.attemptCount}</TableCell>
                    <TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={detail(item)}>{detail(item)}</TableCell>
                    <TableCell className="text-right">{canRetryManually(item.status) ? <RetryDeliveryButton deliveryId={item.id} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ul className="grid gap-3 lg:hidden" aria-label="Entregas">
            {deliveries.map((item) => (
              <li key={item.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="delivery-card" data-status={item.status}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{eventLabel(item.eventType)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.patientName ?? "—"} · {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <ChannelBadge channel={item.channel} />
                    <DeliveryStatusBadge status={item.status} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Destinatário</dt>
                    <dd className="font-mono">{item.recipientMasked}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tentativas</dt>
                    <dd className="tabular-nums">{item.attemptCount}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Detalhe</dt>
                    <dd>{detail(item)}</dd>
                  </div>
                </dl>
                {canRetryManually(item.status) ? (
                  <div className="mt-3">
                    <RetryDeliveryButton deliveryId={item.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <section aria-labelledby="agendados" className="space-y-2">
        <h2 id="agendados" className="font-heading text-lg font-medium">
          Próximos eventos agendados
        </h2>
        {scheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lembrete pendente. Lembretes são agendados automaticamente 5 dias antes de cada consulta.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scheduled.map((event) => (
              <li key={event.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{eventLabel(event.eventType)}</span>
                <span className="block text-xs text-muted-foreground">Previsto para {formatDateTime(event.scheduledFor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
