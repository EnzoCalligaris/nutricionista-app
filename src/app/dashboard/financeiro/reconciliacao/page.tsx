import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChargeMethodBadge, ChargeStatusBadge } from "@/components/payments/charge-badges";
import { ResolveReconciliationButton, RunReconciliationButton } from "@/components/payments/reconciliation-actions";
import { requireNutritionist } from "@/lib/auth/session";
import { listNutritionistCharges, listReconciliationItems } from "@/data/payment-charges";
import { presentChargeStatus } from "@/domain/payments/charges";
import { RECONCILIATION_KIND_HINT, RECONCILIATION_KIND_LABEL, type ReconciliationKind } from "@/domain/payments/status";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Reconciliação de pagamentos" };
export const dynamic = "force-dynamic";

function kindLabel(kind: string): string {
  return RECONCILIATION_KIND_LABEL[kind as ReconciliationKind] ?? kind;
}

function kindHint(kind: string): string {
  return RECONCILIATION_KIND_HINT[kind as ReconciliationKind] ?? "Confira no painel do provedor antes de agir.";
}

/**
 * Reconciliação (prompt Fase 13 §53–§55): só divergências REAIS — aquilo que
 * o sistema se recusou a decidir sozinho (valor/moeda divergente, parcela já
 * quitada, status desconhecido, cobrança pendente antiga, cobrança paga sem
 * pagamento registrado). Resolver aqui não movimenta dinheiro: registra a
 * decisão humana.
 */
export default async function ReconciliacaoPage() {
  const nutritionist = await requireNutritionist();
  const [items, charges] = await Promise.all([listReconciliationItems(nutritionist.id, { status: "ALL" }), listNutritionistCharges(nutritionist.id, { limit: 50 })]);
  const open = items.filter((item) => item.status === "OPEN");
  const resolved = items.filter((item) => item.status !== "OPEN").slice(0, 20);
  const now = new Date();
  const chargeById = new Map(charges.map((charge) => [charge.id, charge]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/dashboard/financeiro">
              <ArrowLeft data-icon="inline-start" />
              Financeiro
            </Link>
          </Button>
          <h1 className="font-heading text-2xl font-medium">Reconciliação</h1>
          <p className="text-sm text-muted-foreground">Divergências entre as cobranças online e o financeiro. Nada é corrigido automaticamente.</p>
        </div>
        <RunReconciliationButton />
      </div>

      <section aria-labelledby="abertas" className="space-y-3">
        <h2 id="abertas" className="font-heading text-lg font-medium">
          Em aberto {open.length > 0 ? <span className="text-muted-foreground">({open.length})</span> : null}
        </h2>
        {open.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="size-8 text-success" aria-hidden="true" />
              <p className="font-medium">Nenhuma divergência em aberto.</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Cobranças pagas, expiradas e canceladas seguem o fluxo normal. Aparecem aqui apenas os casos que precisam da sua decisão — por exemplo, valor diferente do cobrado ou parcela já quitada por
                pagamento manual.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3" aria-label="Divergências em aberto">
            {open.map((item) => {
              const charge = item.chargeId ? chargeById.get(item.chargeId) : null;
              return (
                <li key={item.id} className="rounded-xl bg-card p-4 ring-1 ring-destructive/20" data-testid="reconciliation-item" data-kind={item.kind}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{kindLabel(item.kind)}</p>
                      <p className="text-sm text-muted-foreground">{kindHint(item.kind)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.patientName ? `${item.patientName} · ` : ""}
                        {formatDateTime(item.createdAt)}
                        {charge ? ` · cobrança de ${formatBRL(charge.amountCents)}` : ""}
                      </p>
                      {typeof item.detail.reported_amount_cents === "number" && typeof item.detail.expected_amount_cents === "number" ? (
                        <p className="text-xs text-muted-foreground">
                          Cobrado: <span className="tabular-nums">{formatBRL(item.detail.expected_amount_cents)}</span> · informado pelo provedor:{" "}
                          <span className="tabular-nums">{formatBRL(item.detail.reported_amount_cents)}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {charge ? <ChargeStatusBadge status={presentChargeStatus(charge, now)} /> : null}
                      {charge ? <ChargeMethodBadge method={charge.method} /> : null}
                      <ResolveReconciliationButton itemId={item.id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="cobrancas" className="space-y-3">
        <h2 id="cobrancas" className="font-heading text-lg font-medium">
          Últimas cobranças online
        </h2>
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança online gerada até agora.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2" aria-label="Cobranças online">
            {charges.slice(0, 12).map((charge) => (
              <li key={charge.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm" data-testid="charge-row">
                <div className="min-w-0">
                  <p className="font-medium">
                    {charge.patientName ?? "—"} · <span className="tabular-nums">{formatBRL(charge.amountCents)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {charge.installmentNumber ? `Parcela ${charge.installmentNumber} · ` : ""}
                    {formatDateTime(charge.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <ChargeMethodBadge method={charge.method} />
                  <ChargeStatusBadge status={presentChargeStatus(charge, now)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 ? (
        <section aria-labelledby="resolvidas" className="space-y-2">
          <h2 id="resolvidas" className="font-heading text-lg font-medium">
            Resolvidas
          </h2>
          <ul className="grid gap-2" aria-label="Divergências resolvidas">
            {resolved.map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{kindLabel(item.kind)}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.patientName ? `${item.patientName} · ` : ""}
                  {item.status === "IGNORED" ? "Arquivada" : "Resolvida"} em {formatDateTime(item.resolvedAt)}
                  {item.resolutionNote ? ` · ${item.resolutionNote}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
