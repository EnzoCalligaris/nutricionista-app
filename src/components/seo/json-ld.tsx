/**
 * Script JSON-LD seguro: o payload é serializado com `<` escapado para não
 * fechar a tag script por conteúdo vindo do banco (títulos de post etc.).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
