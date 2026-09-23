import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashToast } from "@/components/shared/flash-toast";
import { Pagination } from "@/components/shared/pagination";
import { FinanceSummaryCards } from "@/components/finance/summary-cards";
import { TransactionFilters, financeHref } from "@/components/finance/transaction-filters";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { requireNutritionist } from "@/lib/auth/session";
import { getFinancialCategories, getPeriodSummary, listTransactions } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
import { countOpenReconciliationItems, listNutritionistCharges } from "@/data/payment-charges";
import { presentChargeStatus } from "@/domain/payments/charges";
import { ChargeMethodBadge, ChargeStatusBadge } from "@/components/payments/charge-badges";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { resolvePeriod } from "@/domain/finance/period";
import { transactionListQuerySchema } from "@/validators/finance";
import { instantToDateISO } from "@/lib/timezone";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Financeiro do nutricionista (prompt Fase 7 §3–§14). URL é a fonte de
 * verdade (período, filtros, página); tudo server-rendered com queries
 * escopadas ao nutricionista e ao período. Datas civis no fuso do
 * nutricionista (§67).
 */
export default async function FinanceiroPage({ searchParams }: PageProps<"/dashboard/financeiro">) {
  const nutritionist = await requireNutritionist();
  const raw = await searchParams;
  const query = transactionListQuerySchema.parse({
    periodo: firstParam(raw.periodo),
    de: firstParam(raw.de),
    ate: firstParam(raw.ate),
    tipo: firstParam(raw.tipo),
    status: firstParam(raw.status),
    categoria: firstParam(raw.categoria),
    metodo: firstParam(raw.metodo),
    q: firstParam(raw.q),
    page: firstParam(raw.page),
    pageSize: firstParam(raw.pageSize),
  });

  const settings = await getSchedulingSettings(nutritionist.id);
  const timeZone = settings.timeZone;
  const today = instantToDateISO(new Date(), timeZone);
  const period = resolvePeriod(query.periodo, today, { from: query.de, to: query.ate });

  const [summary, categories, result, charges, openReconciliation] = await Promise.all([
    getPeriodSummary(period.from, period.to, timeZone),
    getFinancialCategories(),
    listTransactions(
      nutritionist.id,
      {
        from: period.from,
        to: period.to,
        type: query.tipo,
        status: query.status,
        categoryId: query.categoria,
        method: query.metodo,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      },
      today,
    ),
    listNutritionistCharges(nutritionist.id, { limit: 8 }),
    countOpenReconciliationItems(nutritionist.id),
  ]);

  const hasFilters = query.tipo !== "all" || query.status !== "all" || Boolean(query.categoria) || query.metodo !== "all" || Boolean(query.q);
  const periodLabel = `${formatCalendarDate(period.from)} – ${formatCalendarDate(period.to)}`;

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Receitas, despesas e recebimentos — {periodLabel}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={openReconciliation > 0 ? "destructive" : "outline"} size="sm">
            <Link href="/dashboard/financeiro/reconciliacao">
              {openReconciliation > 0 ? <CircleAlert data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
              {openReconciliation > 0 ? `Reconciliação (${openReconciliation})` : "Reconciliação"}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/financeiro/previsao">
              <TrendingUp data-icon="inline-start" />
              Previsão de recebimentos
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/financeiro/novo">
              <Plus data-icon="inline-start" />
              Novo lançamento
            </Link>
          </Button>
        </div>
      </div>

      <FinanceSummaryCards summary={summary} periodLabel={periodLabel} />

      {charges.length > 0 ? (
        <section aria-labelledby="cobrancas-online" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="cobrancas-online" className="font-heading text-lg font-medium">
              Cobranças online
            </h2>
            <p className="text-xs text-muted-foreground">Cobrança pendente não é receita: só entra no financeiro quando o pagamento é confirmado.</p>
          </div>
          <ul className="grid gap-2 lg:grid-cols-2" aria-label="Cobranças online recentes">
            {charges.map((charge) => (
              <li key={charge.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm" data-testid="finance-charge-row">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {charge.patientName ?? "—"} · <span className="tabular-nums">{formatBRL(charge.amountCents)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {charge.installmentNumber ? `Parcela ${charge.installmentNumber} · ` : ""}
                    {charge.paidAt ? `Pago em ${formatDateTime(charge.paidAt)}` : formatDateTime(charge.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <ChargeMethodBadge method={charge.method} />
                  <ChargeStatusBadge status={presentChargeStatus(charge, new Date())} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="lancamentos-heading" className="space-y-4">
        <h2 id="lancamentos-heading" className="font-heading text-lg font-medium">
          Lançamentos
        </h2>
        <TransactionFilters query={query} period={period} categories={categories} />
        <TransactionsTable items={result.items} hasFilters={hasFilters} />
        <Pagination
          page={query.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={query.pageSize}
          hrefForPage={(page) => financeHref({ ...query, page })}
          itemLabel={{ singular: "lançamento", plural: "lançamentos" }}
        />
      </section>
    </div>
  );
}
