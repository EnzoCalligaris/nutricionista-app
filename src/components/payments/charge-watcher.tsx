"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelChargeAction } from "@/actions/payments";
import { Button } from "@/components/ui/button";

/**
 * Acompanhamento da cobrança (prompt Fase 13 §29–§30/§63/§131).
 *
 * A tela NUNCA declara "pago" por conta própria: ela só recarrega os dados
 * do servidor de tempos em tempos e mostra o que o banco diz — e o banco só
 * muda quando o webhook assinado (ou a consulta server-side) confirma.
 * O estado é anunciado por `aria-live`.
 */
export function ChargeWatcher({ chargeId, status, canSimulate }: { chargeId: string; status: string; /** Ferramentas de simulação (só em desenvolvimento com provider fake — §69). */ canSimulate: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checking, setChecking] = useState(false);
  const waiting = status === "PENDING" || status === "CREATED";

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  async function simulate(next: "PAID" | "FAILED" | "EXPIRED") {
    setChecking(true);
    try {
      const response = await fetch("/api/dev/payments/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chargeId, status: next }),
      });
      if (!response.ok) throw new Error(String(response.status));
      toast.success(next === "PAID" ? "Pagamento de teste aprovado." : next === "FAILED" ? "Pagamento de teste recusado." : "Cobrança de teste expirada.");
      router.refresh();
    } catch {
      toast.error("Não foi possível simular o evento.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm" aria-live="polite" data-testid="charge-status-line">
        {waiting ? (
          <>
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            Estamos confirmando seu pagamento. Esta página atualiza sozinha.
          </>
        ) : status === "PAID" ? (
          <>
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Pagamento confirmado.
          </>
        ) : (
          <>
            <XCircle className="size-4 text-muted-foreground" aria-hidden="true" />
            Esta cobrança não está mais ativa.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(() => router.refresh())}>
          Atualizar agora
        </Button>
        {waiting ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelChargeAction(chargeId);
                if (result.ok) {
                  toast.success("Cobrança cancelada.");
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            <Ban data-icon="inline-start" />
            Cancelar cobrança
          </Button>
        ) : null}
      </div>

      {canSimulate && waiting ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3" data-testid="simulation-panel">
          <p className="text-xs font-medium text-muted-foreground">Ambiente de demonstração — simular o retorno do provedor</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={checking} onClick={() => simulate("PAID")} data-testid="simulate-paid">
              <CreditCard data-icon="inline-start" />
              Aprovar pagamento de teste
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={checking} onClick={() => simulate("FAILED")} data-testid="simulate-failed">
              Simular recusa
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={checking} onClick={() => simulate("EXPIRED")} data-testid="simulate-expired">
              Simular expiração
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Nenhum dado de cartão é pedido: o evento é assinado e entregue ao webhook, como o provedor real faria.</p>
        </div>
      ) : null}
    </div>
  );
}
