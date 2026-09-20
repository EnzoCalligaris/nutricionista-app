import { AlertTriangle, Archive, CheckCircle2, Clock, Info, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ESTIMATE_DISCLAIMER, formatGrams, formatKcal, type Totals } from "@/domain/food-analysis/estimates";
import { ANALYSIS_STATUS_LABEL, analysisUiStatus, type AnalysisLike, type AnalysisUiStatus } from "@/domain/food-analysis/status";

/** Status da refeição com ícone + texto (nunca só cor). */
export function MealStatusBadge({ item }: { item: AnalysisLike }) {
  const status = analysisUiStatus(item);
  const styles: Record<AnalysisUiStatus, { className: string; Icon: typeof Clock }> = {
    UPLOADED: { className: "bg-muted text-muted-foreground", Icon: Clock },
    PROCESSING: { className: "bg-primary/10 text-primary", Icon: Loader2 },
    REVIEW_REQUIRED: { className: "bg-warning/15 text-warning-foreground", Icon: AlertTriangle },
    CONFIRMED: { className: "bg-success/10 text-success", Icon: CheckCircle2 },
    FAILED: { className: "bg-destructive/10 text-destructive", Icon: XCircle },
    ARCHIVED: { className: "bg-muted text-muted-foreground", Icon: Archive },
  };
  const { className, Icon } = styles[status];
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent", className)}>
      <Icon className={cn("size-3", status === "PROCESSING" && "animate-spin")} aria-hidden="true" />
      {ANALYSIS_STATUS_LABEL[status]}
    </Badge>
  );
}

/**
 * Aviso obrigatório de estimativa (prompt Fase 11 §1), sempre visível perto
 * dos valores; quando o provider é simulado (fake), diz isso com todas as
 * letras (§3).
 */
export function EstimateDisclaimer({ simulated = false, className }: { simulated?: boolean; className?: string }) {
  return (
    <div role="note" className={cn("flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm", className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p>{ESTIMATE_DISCLAIMER}</p>
        {simulated ? <p className="text-xs text-muted-foreground">Ambiente de demonstração: a estimativa é simulada — a análise por IA real ainda não está configurada.</p> : null}
      </div>
    </div>
  );
}

/** Totais estimados (§36–§37): kcal inteiro, macros 1 casa, sem depender de cor. */
export function TotalsSummary({ totals, label, className }: { totals: Totals; label?: string; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4", className)} aria-label={label ?? "Totais estimados"}>
      <div>
        <dt className="text-xs text-muted-foreground">Calorias (est.)</dt>
        <dd className="font-heading text-lg font-medium tabular-nums">{formatKcal(totals.calories)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Proteína (est.)</dt>
        <dd className="font-medium tabular-nums">{formatGrams(totals.proteinG)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Carboidratos (est.)</dt>
        <dd className="font-medium tabular-nums">{formatGrams(totals.carbsG)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Gorduras (est.)</dt>
        <dd className="font-medium tabular-nums">{formatGrams(totals.fatG)}</dd>
      </div>
    </dl>
  );
}

/** Indicador de etapas do fluxo (§63): 1. Foto · 2. Análise · 3. Revisão — discreto. */
export function MealSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Foto", "Análise", "Revisão"];
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Etapas">
      {steps.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        const state = number < current ? "done" : number === current ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[11px] font-medium",
                state === "done" && "border-success bg-success text-success-foreground",
                state === "current" && "border-primary bg-primary text-primary-foreground",
                state === "todo" && "border-border text-muted-foreground",
              )}
            >
              {state === "done" ? "✓" : number}
            </span>
            <span className={cn(state === "todo" ? "text-muted-foreground" : "font-medium")}>{label}</span>
            {index < steps.length - 1 ? <span className="h-px w-4 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
