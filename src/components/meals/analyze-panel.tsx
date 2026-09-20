"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { requestMealAnalysisAction } from "@/actions/food-analysis";
import { Button } from "@/components/ui/button";

/**
 * Etapa 2 — análise (prompt Fase 11 §24–§28/§64–§66): um botão que
 * desabilita durante o processamento (o servidor é idempotente de qualquer
 * forma), estado "Analisando sua refeição..." com aria-live e sem
 * porcentagem inventada; falha mantém a foto e oferece "Tentar novamente".
 * Se a análise já está em andamento (outra aba), a página se atualiza sozinha.
 */
export function AnalyzePanel({ analysisId, state, failureMessage, available }: { analysisId: string; state: "UPLOADED" | "PROCESSING" | "FAILED"; failureMessage: string | null; available: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(failureMessage);
  const busy = isPending || state === "PROCESSING";

  useEffect(() => {
    if (state !== "PROCESSING" || isPending) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [state, isPending, router]);

  function analyze() {
    setError(null);
    startTransition(async () => {
      const result = await requestMealAnalysisAction(analysisId);
      if (result.ok && result.status === "ANALYZED") {
        toast.success("Análise concluída. Revise antes de confirmar.");
        router.refresh();
      } else if (result.ok) {
        setError("Não foi possível analisar esta foto agora. Tente novamente.");
        router.refresh();
      } else {
        setError(result.error);
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="analise-h" className="space-y-3 rounded-xl border border-border p-4">
      <h2 id="analise-h" className="font-heading text-lg font-medium">
        Análise por IA
      </h2>
      {!available ? (
        <p className="text-sm text-muted-foreground">A análise por IA não está disponível no momento. A foto ficou guardada; tente mais tarde.</p>
      ) : busy ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3 text-sm" role="status" aria-live="polite">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium">Analisando sua refeição...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns instantes. Você pode aguardar nesta tela.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">A IA vai identificar os alimentos visíveis e estimar porções, calorias e macronutrientes. Depois você revisa e confirma.</p>
          )}
          <Button type="button" size="lg" onClick={analyze} disabled={busy} className="w-full sm:w-auto">
            {state === "FAILED" || error ? <RefreshCw data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            {state === "FAILED" || error ? "Tentar novamente" : "Analisar refeição"}
          </Button>
        </div>
      )}
    </section>
  );
}
