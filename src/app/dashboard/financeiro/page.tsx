import type { Metadata } from "next";
import Link from "next/link";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashToast } from "@/components/shared/flash-toast";
import { Pagination } from "@/components/shared/pagination";
import { FinanceSummaryCards } from "@/components/finance/summary-cards";
import { TransactionFilters, financeHref } from "@/components/finance/transaction-filters";
import { TransactionsTable } from "@/components/finance/transactions-table";
import { requireNutritionist } from "@/lib/auth/session";
import { getFinancialCategories, getPeriodSummary, listTransactions } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
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

  const [summary, categories, result] = await Promise.all([
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
