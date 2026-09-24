import { BeforeAfter } from "@/components/marketing/before-after";
import type { PublicResult } from "@/data/results";
import type { QueryResult } from "@/data/safe-query";

/**
 * Resultados publicados COM consentimento válido (prompt Fase 14 §34).
 *
 * As fotos são entregues por rota server-side a partir de um bucket privado;
 * revogar o consentimento tira o resultado desta lista imediatamente. O
 * empty state continua sendo o estado esperado enquanto Enzo não publicar
 * resultados reais — nenhum antes/depois fictício é exibido.
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
    // Duas colunas no máximo na página de resultados: com três, cada foto
    // ficava com ~140 px e o antes/depois — que é o conteúdo — deixava de ser
    // legível (QA visual da Fase 14). Na home, o bloco `compact` é teaser e
    // continua em três.
    <ul className={compact ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-8 sm:grid-cols-2"}>
      {items.map((result) => (
        <li
          key={result.id}
          data-testid={`result-${result.id}`}
          className="flex flex-col rounded-[1.5rem] border border-border bg-card p-5 sm:p-6"
        >
          <BeforeAfter
            beforeUrl={result.beforeUrl}
            afterUrl={result.afterUrl}
            beforeAlt={result.beforeAlt}
            afterAlt={result.afterAlt}
          />
          <h3 className="mt-5 font-heading text-xl font-medium">{result.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs uppercase tracking-wide text-muted-foreground">
            {result.period ? <span>{result.period}</span> : null}
            {result.displayName ? <span>{result.displayName}</span> : null}
          </div>
          {result.description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
