import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink as ExternalLinkIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { ResultStateBadge } from "@/components/results/result-state-badge";
import { requireNutritionist } from "@/lib/auth/session";
import { countResults, getDashboardResults } from "@/data/results";

export const metadata: Metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

/**
 * Lista de resultados antes/depois (prompt Fase 14 §27/§63). Mostra o estado
 * real de cada um, incluindo o caso crítico "publicado mas com consentimento
 * revogado" — que está fora do ar no site e precisa ficar visível aqui.
 */
export default async function DashboardResultadosPage({ searchParams }: { searchParams: Promise<{ arquivados?: string }> }) {
  await requireNutritionist();
  const { arquivados } = await searchParams;
  const includeArchived = arquivados === "1";
  const results = await getDashboardResults({ includeArchived });
  const counters = countResults(results);

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Resultados</h1>
          <p className="text-sm text-muted-foreground">
            Antes/depois do site público. Nenhum resultado é publicado sem consentimento de uso de imagem válido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/resultados"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ver no site
            <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
          <Button asChild>
            <Link href="/dashboard/resultados/novo">
              <Plus className="size-4" aria-hidden="true" />
              Novo resultado
            </Link>
          </Button>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Publicados", value: counters.published },
          { label: "Rascunhos", value: counters.drafts },
          { label: "Sem consentimento válido", value: counters.consentRevoked },
          { label: "Arquivados", value: counters.archived },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</dt>
              <dd className="mt-1 font-heading text-2xl tabular-nums">{card.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={includeArchived ? "/dashboard/resultados" : "/dashboard/resultados?arquivados=1"}
          className="text-sm text-primary hover:underline"
        >
          {includeArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
        </Link>
      </div>

      {results.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-12 text-center" role="status">
            <p className="font-heading text-lg">Nenhum resultado cadastrado.</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Crie um resultado, envie as fotos de antes e depois, registre o consentimento do paciente e só então
              publique.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/resultados/novo">Criar o primeiro resultado</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {results.map((result) => (
            <li key={result.id}>
              <Link href={`/dashboard/resultados/${result.id}`} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Card className="h-full transition-colors group-hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-heading text-lg">{result.title}</CardTitle>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <CardDescription>
                      {[result.period, result.patientName ?? "sem paciente vinculado"].filter(Boolean).join(" · ")}
                    </CardDescription>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ResultStateBadge state={result.state} />
                      {result.displayName ? (
                        <span className="text-xs text-muted-foreground">exibe &ldquo;{result.displayName}&rdquo;</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">anônimo</span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
