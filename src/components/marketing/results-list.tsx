import type { PublicResult } from "@/data/results";
import type { QueryResult } from "@/data/safe-query";

/**
 * Resultados publicados com consentimento. Sem foto nesta fase (entrega
 * server-side de imagem do bucket privado é Fase 14) e sem nenhum
 * antes/depois fictício (prompt Fase 4 §24-25) — o empty state é o estado
 * esperado até Enzo publicar resultados reais pelo dashboard.
 */
export function ResultsList({ results, compact = false }: { results: QueryResult<PublicResult[]>; compact?: boolean }) {
  if (!results.ok) {
    return (
      <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Os resultados estão temporariamente indisponíveis.
      </p>
    );
  }

  if (results.data.length === 0) {
    return (
      <div
        role="status"
        className="rounded-[1.5rem] border border-dashed border-primary/30 bg-card px-6 py-12 text-center sm:px-10"
      >
        <p className="font-heading text-xl font-medium">Resultados reais, com consentimento real.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Só publicamos evoluções de pacientes com autorização de uso de imagem registrada. Os
          primeiros resultados aparecem aqui assim que forem autorizados.
        </p>
      </div>
    );
  }

  const items = compact ? results.data.slice(0, 3) : results.data;

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((result) => (
        <li key={result.id} className="rounded-[1.5rem] border border-border bg-card p-6">
          <h3 className="font-heading text-xl font-medium">{result.title}</h3>
          {result.period ? <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{result.period}</p> : null}
          {result.description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
