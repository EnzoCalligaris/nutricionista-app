import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/section";
import { MethodPhases } from "@/components/marketing/method-phases";
import { Pillars } from "@/components/marketing/pillars";
import { CtaFinal } from "@/components/marketing/cta-final";
import { BENEFITS, MISSION } from "@/content/metodo-em";

export const metadata: Metadata = {
  title: { absolute: "Método EM — antes, durante e depois da consulta" },
  description:
    "O Método EM é a metodologia de acompanhamento nutricional de Enzo Mangili: pré-consulta, consulta, ajustes e evolução — antes, durante e depois de cada encontro.",
  alternates: { canonical: "/metodo-em" },
};

export default function MetodoEmPage() {
  return (
    <>
      <Section size="compact" className="pb-8 sm:pb-10">
        <SectionHeading
          as="h1"
          eyebrow="Método EM"
          title="Além de contar calorias."
          lead={MISSION}
        />
      </Section>

      <Section className="pt-6 sm:pt-8">
        <MethodPhases />
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Pilares"
          title="Quatro pilares, um acompanhamento."
          lead="É a combinação deles que faz o plano funcionar na vida real."
          className="mb-12"
        />
        <Pillars />
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <SectionHeading
            eyebrow="O que muda"
            title="Um planejamento que respeita a sua rotina."
            lead="Com flexibilidade e praticidade, os resultados vêm de um plano que se adapta ao seu estilo de vida — não o contrário."
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:pt-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="border-l-2 border-primary/40 pl-4 text-base leading-relaxed text-foreground/90">
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/acompanhamento">Como é o acompanhamento</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/planos">Ver planos</Link>
          </Button>
        </div>
      </Section>

      <CtaFinal />
    </>
  );
}
