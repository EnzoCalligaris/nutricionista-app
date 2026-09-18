import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PatientListFilter } from "@/domain/patients/status";

const FILTERS: { value: PatientListFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

/**
 * Busca + filtros como formulário GET e links (prompt Fase 5 §6–§7): a URL
 * é a fonte de verdade (`?q=&status=&page=`), funciona sem JS, é
 * compartilhável e o servidor faz a query — nada de filtrar no browser.
 */
export function PatientFilters({ q, status }: { q?: string; status: PatientListFilter }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form method="get" action="/dashboard/pacientes" role="search" className="flex w-full max-w-md items-center gap-2">
        <input type="hidden" name="status" value={status} />
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar paciente por nome..."
            aria-label="Buscar paciente por nome, e-mail ou telefone"
            className="pl-8"
            maxLength={80}
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <nav aria-label="Filtrar por status" className="flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
        {FILTERS.map((filter) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (filter.value !== "all") params.set("status", filter.value);
          const query = params.toString();
          const active = filter.value === status;
          return (
            <Link
              key={filter.value}
              href={query ? `/dashboard/pacientes?${query}` : "/dashboard/pacientes"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
