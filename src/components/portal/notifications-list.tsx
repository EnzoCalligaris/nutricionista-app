"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PortalNotification } from "@/data/notifications";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Lista de notificações do portal (prompt Fase 12 §21/§97): título, descrição
 * curta, data, lida/não lida, link para a área do portal. Marcar como lida
 * individualmente (ao abrir o link ou pelo botão) e "marcar todas".
 * Só as próprias (RLS) — nenhum id de provider, tentativa ou erro aqui (§99).
 */
export function NotificationsList({ items }: { items: PortalNotification[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unread = items.filter((item) => !item.readAt).length;

  function markRead(id: string, then?: () => void) {
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (!result.ok) toast.error(result.error);
      if (then) then();
      else router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Bell className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Nenhuma notificação por enquanto.</p>
          <p className="max-w-sm text-sm text-muted-foreground">Avisos de consultas, lembretes, feedbacks e materiais aparecem aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread === 0 ? "Tudo lido." : `${unread} não lida(s).`}
        </p>
        {unread > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await markAllNotificationsReadAction();
                if (result.ok) toast.success("Todas marcadas como lidas.");
                else toast.error(result.error);
                router.refresh();
              })
            }
          >
            <CheckCheck data-icon="inline-start" />
            Marcar todas como lidas
          </Button>
        ) : null}
      </div>
      <ul className="grid max-w-3xl gap-2" aria-label="Notificações">
        {items.map((item) => {
          const isUnread = !item.readAt;
          return (
            <li
              key={item.id}
              data-testid="notification-item"
              data-unread={isUnread ? "true" : "false"}
              className={cn("flex min-w-0 items-start gap-3 rounded-xl p-4 ring-1 ring-foreground/10", isUnread ? "bg-card" : "bg-muted/40")}
            >
              <span className="mt-1.5 shrink-0" aria-hidden="true">
                {isUnread ? <Circle className="size-2.5 fill-primary text-primary" /> : <Circle className="size-2.5 text-transparent" />}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn("break-words", isUnread ? "font-medium" : "text-foreground/80")}>
                  {item.title}
                  {isUnread ? <span className="sr-only"> (não lida)</span> : null}
                </p>
                {item.body ? <p className="text-sm text-muted-foreground break-words">{item.body}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.link ? (
                    <Button asChild size="sm" variant="link" className="h-auto px-0">
                      <Link
                        href={item.link as "/paciente"}
                        onClick={(event) => {
                          if (!isUnread) return;
                          // Marca como lida ANTES de navegar (a navegação cancelaria a transição).
                          event.preventDefault();
                          markRead(item.id, () => router.push(item.link as "/paciente"));
                        }}
                      >
                        Abrir
                      </Link>
                    </Button>
                  ) : null}
                  {isUnread ? (
                    <Button size="sm" variant="link" className="h-auto px-0 text-muted-foreground" disabled={isPending} onClick={() => markRead(item.id)}>
                      Marcar como lida
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
