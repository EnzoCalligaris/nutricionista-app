import Image from "next/image";
import { cn } from "@/lib/utils";
import { METHOD_PHASES, type Phase } from "@/content/metodo-em";

const PHASE_IMAGES: Record<Phase["key"], { src: string; alt: string } | null> = {
  antes: null,
  durante: {
    src: "/images/enzo/consulta.webp",
    alt: "Enzo Mangili durante uma consulta, escrevendo anotações com adipômetro e fita métrica sobre a mesa",
  },
  depois: {
    src: "/images/enzo/avaliacao.webp",
    alt: "Enzo Mangili segurando um adipômetro, instrumento usado na avaliação física",
  },
};

/**
 * Antes / durante / depois em layout editorial alternado (prompt Fase 4 §14:
 * "experiência visual mais interessante do que três cards genéricos").
 * `compact` é a versão usada na Home; a página /metodo-em usa a completa.
 */
export function MethodPhases({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={cn(
        "relative",
        compact ? "grid gap-12 lg:grid-cols-3 lg:gap-10" : "space-y-20 sm:space-y-28",
      )}
    >
      {METHOD_PHASES.map((phase, index) => {
        const image = PHASE_IMAGES[phase.key];
        const flip = index % 2 === 1;

        return (
          <li
            key={phase.key}
            className={cn(
              "grid items-center gap-8",
              compact && "border-t border-primary/30 pt-8",
              !compact && image && "lg:grid-cols-2 lg:gap-16",
            )}
          >
            <div className={cn(!compact && image && flip && "lg:order-2")}>
              <div className="flex items-baseline gap-4">
                <span className="font-heading text-4xl font-medium text-primary/40 tabular-nums sm:text-5xl">
                  0{index + 1}
                </span>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">{phase.eyebrow}</p>
              </div>
              <h3 className="mt-3 max-w-xl font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                {phase.title}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {phase.description}
              </p>
              <ul className={cn("mt-6 grid gap-2", !compact && "sm:grid-cols-2")}>
                {phase.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {!compact && image ? (
              <div className={cn("relative mx-auto w-full max-w-sm lg:max-w-md", flip && "lg:order-1")}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-secondary">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 100vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
