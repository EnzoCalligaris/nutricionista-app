"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichContent } from "@/components/blog/rich-content";
import { parseRichText } from "@/domain/blog/rich-text";

/**
 * Editor do conteúdo do post (prompt Fase 14 §40).
 *
 * O conteúdo NUNCA é HTML: o que a pessoa escreve é convertido em documento
 * JSON com uma lista fechada de nós (parágrafo, título, lista, citação,
 * negrito, itálico, link) — e a pré-visualização usa o MESMO renderizador do
 * site público, que passa texto como children React e nunca usa
 * `dangerouslySetInnerHTML`. Um trecho que não casa com a sintaxe vira texto
 * comum, então não há como injetar marcação.
 */
export function RichTextEditor({ name, defaultValue, error }: { name: string; defaultValue: string; error?: string }) {
  const [value, setValue] = useState(defaultValue);
  const fieldId = useId();
  const doc = parseRichText(value);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>Conteúdo</Label>
        <Textarea
          id={fieldId}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={16}
          // O Textarea do design system dimensiona pelo conteúdo; num editor
          // de artigo isso deixava a área minúscula (QA visual da Fase 14).
          className="min-h-72 font-mono text-sm"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${fieldId}-syntax`}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <details className="rounded-lg border border-border p-3" id={`${fieldId}-syntax`}>
        <summary className="cursor-pointer text-sm font-medium">Como formatar</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>
            <code>## Título</code> — subtítulo (<code>###</code> e <code>####</code> para níveis menores)
          </li>
          <li>
            <code>- item</code> — lista; <code>1. item</code> — lista numerada
          </li>
          <li>
            <code>&gt; texto</code> — citação
          </li>
          <li>
            <code>**negrito**</code> · <code>*itálico*</code> · <code>[texto](https://exemplo.com)</code>
          </li>
          <li>Linha vazia separa parágrafos. HTML não é aceito — aparece como texto.</li>
        </ul>
      </details>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
        <div className="prose-em rounded-xl border border-border bg-card p-4">
          {doc.content.length === 0 ? (
            <p className="text-sm text-muted-foreground">Escreva algo acima para ver a pré-visualização.</p>
          ) : (
            <RichContent content={doc} />
          )}
        </div>
      </div>
    </div>
  );
}
