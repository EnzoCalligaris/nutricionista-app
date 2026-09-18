import { PILLARS } from "@/content/metodo-em";

/**
 * Quatro pilares em grade editorial com régua fina — sem ícone genérico e
 * sem card fechado (prompt Fase 4: "excesso de cards" é anti-padrão).
 */
export function Pillars() {
  return (
    <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map((pillar, index) => (
        <li key={pillar.key} className="border-t border-primary/30 pt-6">
          <span className="font-heading text-sm text-primary/70 tabular-nums">0{index + 1}</span>
          <h3 className="mt-3 font-heading text-xl font-medium">{pillar.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pillar.description}</p>
        </li>
      ))}
    </ol>
  );
}
