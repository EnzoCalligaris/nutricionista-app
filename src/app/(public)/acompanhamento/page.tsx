import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/section";
import { CtaFinal } from "@/components/marketing/cta-final";
import { PlansGrid } from "@/components/marketing/plans-grid";
import { getPublicPlans } from "@/data/plans";

export const metadata: Metadata = {
  title: "Como funciona o acompanhamento",
  description:
    "Do primeiro contato à evolução: pré-consulta gratuita, consulta, planejamento, check-list quinzenal e ajustes. Veja como é o acompanhamento com Enzo Mangili.",
  alternates: { canonical: "/acompanhamento" },
};

/**
 * Passo a passo do acompanhamento. Fonte: PDF p. 21 (fluxo comercial) e
 * p. 9–10 (consultas, planejamento, acompanhamento de perto). O passo
 * "boas-vindas no grupo de WhatsApp" do PDF não entra (grupo removido).
 */
const STEPS = [
  {
    title: "Pré-consulta gratuita",
    text: "Uma conversa inicial, sem custo, para entender o seu momento, seus objetivos e se o acompanhamento faz sentido para você.",
  },
  {
    title: "Onboarding e anamnese",
    text: "Você recebe as orientações de início e preenche o formulário de anamnese pré-consulta. É o que permite chegar na consulta com o histórico já mapeado.",
  },
  {
    title: "Contrato",
    text: "Com o plano escolhido, formalizamos o acompanhamento — duração, número de consultas presenciais e online, e o que está incluído.",
  },
  {
    title: "Consulta com o nutricionista",
    text: "Avaliação antropométrica e/ou bioimpedância, análise de exames laboratoriais e escuta: é aqui que a estratégia individualizada é desenhada.",
  },
  {
    title: "Planejamento alimentar",
    text: "Um plano fácil de seguir, alinhado às suas necessidades, possibilidades e objetivos, com a estrutura da dieta e materiais de apoio sempre à mão.",
  },
  {
    title: "Check-list quinzenal e ajustes",
    text: "A cada quinze dias, foto, peso e feedback. Com isso, os ajustes necessários são feitos para manter a sua evolução — e você conta com suporte de segunda a sábado.",
  },
];

export default async function AcompanhamentoPage() {
  const plans = await getPublicPlans();

  return (
    <>
      <Section size="compact" className="pb-6 sm:pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Acompanhamento"
          title="Como funciona, do primeiro contato à evolução."
          lead="Um processo com começo claro e continuidade: cada etapa prepara a próxima."
        />
      </Section>

      <Section className="pt-6 sm:pt-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-secondary">
              <Image
                src="/images/enzo/atendimento-pb.webp"
                alt="Enzo Mangili em atendimento, escrevendo em uma mesa com adipômetro e fita métrica — fotografia em preto e branco"
                fill
                sizes="(min-width: 1024px) 32vw, (min-width: 640px) 24rem, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>

          <ol className="space-y-10">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-border pt-8 first:border-t-0 first:pt-0">
                <span className="font-heading text-3xl font-medium text-primary/40 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="font-heading text-xl font-medium sm:text-2xl">{step.title}</h2>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Presencial e online"
          title="Consultas no formato do seu plano."
          lead="Os planos de acompanhamento combinam consultas presenciais e online ao longo do período. A periodicidade é definida junto com você, de acordo com a sua rotina."
          className="mb-10"
        />
        <PlansGrid plans={plans} />
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/planos">Comparar os planos</Link>
          </Button>
        </div>
      </Section>

      <CtaFinal />
    </>
  );
}
