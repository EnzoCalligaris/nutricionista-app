import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { PERIOD_LABEL, type Period, type PeriodPreset } from "@/domain/finance/period";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/definitions";
import type { FinancialCategory } from "@/data/financial";
import type { TransactionListQuery } from "@/validators/finance";

const PRESETS: PeriodPreset[] = ["this_month", "last_month", "last_3_months", "last_6_months", "this_year"];

export function financeHref(query: Partial<TransactionListQuery> & { page?: number }, base = "/dashboard/financeiro"): string {
  const params = new URLSearchParams();
  if (query.periodo && query.periodo !== "this_month") params.set("periodo", query.periodo);
  if (query.periodo === "custom") {
    if (query.de) params.set("de", query.de);
    if (query.ate) params.set("ate", query.ate);
  }
  if (query.tipo && query.tipo !== "all") params.set("tipo", query.tipo);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.categoria) params.set("categoria", query.categoria);
  if (query.metodo && query.metodo !== "all") params.set("metodo", query.metodo);
  if (query.q) params.set("q", query.q);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Filtros do financeiro (prompt Fase 7 §4/§13–§14): período por links
 * rápidos + formulário GET (personalizado, tipo, status, categoria, método,
 * busca). URL é a fonte de verdade; funciona sem JS.
 */
export function TransactionFilters({ query, period, categories }: { query: TransactionListQuery; period: Period; categories: FinancialCategory[] }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Período" className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-[3px] sm:w-fit">
        {PRESETS.map((preset) => {
          const active = period.preset === preset;
          return (
            <Link
              key={preset}
              href={financeHref({ ...query, periodo: preset, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[preset]}
            </Link>
          );
        })}
        <span
          aria-current={period.preset === "custom" ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium",
            period.preset === "custom" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Personalizado
        </span>
      </nav>

      <form method="get" action="/dashboard/financeiro" className="grid grid-cols-2 gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 lg:grid-cols-6">
        <input type="hidden" name="periodo" value="custom" />
        <div className="space-y-1">
          <Label htmlFor="f-de" className="text-xs">De</Label>
          <Input id="f-de" name="de" type="date" defaultValue={period.from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-ate" className="text-xs">Até</Label>
          <Input id="f-ate" name="ate" type="date" defaultValue={period.to} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-tipo" className="text-xs">Tipo</Label>
          <NativeSelect id="f-tipo" name="tipo" defaultValue={query.tipo}>
            <option value="all">Todos</option>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-status" className="text-xs">Status</Label>
          <NativeSelect id="f-status" name="status" defaultValue={query.status}>
            <option value="all">Todos</option>
            <option value="PAID">Pago</option>
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Atrasado</option>
            <option value="CANCELLED">Cancelado</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-categoria" className="text-xs">Categoria</Label>
          <NativeSelect id="f-categoria" name="categoria" defaultValue={query.categoria ?? ""}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-metodo" className="text-xs">Método</Label>
          <NativeSelect id="f-metodo" name="metodo" defaultValue={query.metodo}>
            <option value="all">Todos</option>
            {(Object.keys(PAYMENT_METHOD_LABEL) as (keyof typeof PAYMENT_METHOD_LABEL)[]).map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="col-span-2 space-y-1 lg:col-span-4">
          <Label htmlFor="f-q" className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="f-q" name="q" type="search" placeholder="Descrição ou paciente" defaultValue={query.q ?? ""} className="pl-8" maxLength={80} />
          </div>
        </div>
        <div className="col-span-2 flex items-end gap-2 lg:col-span-2">
          <Button type="submit" variant="outline" className="flex-1">
            Filtrar
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/financeiro">Limpar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
