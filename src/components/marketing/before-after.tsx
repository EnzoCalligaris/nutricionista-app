import Image from "next/image";

/**
 * Antes/depois lado a lado com rótulos (prompt Fase 14 §84): sem slider,
 * porque comparação de duas fotos não precisa de interação — e um slider
 * seria um controle a mais para teclado e leitor de tela. No mobile empilha.
 *
 * As imagens vêm da ROTA server-side (`/api/resultados/<id>/<slot>`), nunca
 * de URL assinada nem de path de storage: o bucket é privado e a rota confere
 * publicação + consentimento a cada requisição (§32/§33).
 */
export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeAlt,
  afterAlt,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
}) {
  const frames = [
    { label: "Antes", url: beforeUrl, alt: beforeAlt },
    { label: "Depois", url: afterUrl, alt: afterAlt },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {frames.map((frame) => (
        <figure key={frame.label} className="m-0">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-secondary">
            <Image
              src={frame.url}
              alt={frame.alt}
              fill
              sizes="(min-width: 1024px) 18rem, (min-width: 640px) 14rem, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
          <figcaption className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {frame.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
