import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";

/** CTA final — convite direto, sem urgência falsa (prompt Fase 4 §31). */
export function CtaFinal() {
  return (
    <Section tone="primary">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
          Próximo passo
        </p>
        <h2 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Vamos caminhar lado a lado nessa jornada?
        </h2>
        <p className="mt-5 text-base leading-relaxed text-primary-foreground/80 sm:text-lg">
          O primeiro passo é uma pré-consulta gratuita para entender o seu momento e os seus
          objetivos. Sem complicação, do seu jeito.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="h-11 px-6 text-base">
            <Link href="/agendar">Começar acompanhamento</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-11 px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/planos">Ver planos</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
