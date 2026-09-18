import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Monta a URL de uma página preservando os demais filtros. */
  hrefForPage: (page: number) => string;
  itemLabel: { singular: string; plural: string };
};

/** Paginação simples anterior/próxima (prompt Fase 5 §8) — server-side, por query param. */
export function Pagination({ page, pageCount, total, pageSize, hrefForPage, itemLabel }: Props) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const label = total === 1 ? itemLabel.singular : itemLabel.plural;

  const linkClass = (disabled: boolean) =>
    cn(buttonVariants({ variant: "outline", size: "sm" }), disabled && "pointer-events-none opacity-50");

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {total === 0 ? `0 ${label}` : `${first}–${last} de ${total} ${label}`}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={hrefForPage(page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={linkClass(page <= 1)}
          >
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Link>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <Link
            href={hrefForPage(page + 1)}
            aria-disabled={page >= pageCount}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={linkClass(page >= pageCount)}
          >
            Próxima
            <ChevronRight data-icon="inline-end" />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
