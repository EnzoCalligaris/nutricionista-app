import Link from "next/link";
import { ImageOff } from "lucide-react";
import { MealStatusBadge } from "@/components/meals/meal-shared";
import { formatKcal } from "@/domain/food-analysis/estimates";
import { analysisUiStatus } from "@/domain/food-analysis/status";
import type { FoodAnalysisDetail } from "@/data/food-analyses";
import { formatDateTime } from "@/lib/dates";

/**
 * Item do histórico (prompt Fase 11 §38): miniatura (entregue por route
 * handler com URL assinada), data/hora, total estimado confirmado (ou da
 * IA, marcado como "a revisar") e status. Mobile-first.
 */
export function MealCard({ item, href, photoHref }: { item: FoodAnalysisDetail; href: string; photoHref: string }) {
  const status = analysisUiStatus(item);
  const result = item.confirmed ?? item.original;
  return (
    <li className="min-w-0">
      <Link href={href} className="flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {status === "ARCHIVED" ? (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-5" aria-hidden="true" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração via route handler
            <img src={photoHref} alt="" className="size-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-sm font-medium">{formatDateTime(item.mealAt)}</p>
            <MealStatusBadge item={item} />
          </div>
          {result ? (
            <p className="text-sm">
              <span className="font-heading text-base font-medium tabular-nums">{formatKcal(result.totals.calories)}</span>
              <span className="text-muted-foreground"> · {result.items.length} {result.items.length === 1 ? "item" : "itens"}</span>
              {status === "REVIEW_REQUIRED" ? <span className="text-xs text-muted-foreground"> · estimativa a revisar</span> : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{status === "FAILED" ? "A análise falhou — toque para tentar de novo." : status === "PROCESSING" ? "Analisando..." : "Foto enviada — toque para analisar."}</p>
          )}
          {result && result.items.length > 0 ? <p className="truncate text-xs text-muted-foreground">{result.items.map((entry) => entry.name).join(", ")}</p> : null}
        </div>
      </Link>
    </li>
  );
}
