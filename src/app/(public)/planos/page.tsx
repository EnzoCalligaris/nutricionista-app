import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/section";
import { PlansGrid } from "@/components/marketing/plans-grid";
import { CtaFinal } from "@/components/marketing/cta-final";
import { getPublicPlans } from "@/data/plans";

export const metadata: Metadata = {
  title: "Planos",
  description:
    "Consulta avulsa, plano trimestral e plano semestral: formatos de acompanhamento nutricional com Enzo Mangili, com consultas presenciais e online.",
  alternates: { canonical: "/planos" },
};

export default async function PlanosPage() {
  const plans = await getPublicPlans();

  return (
    <>
      <Section size="compact" className="pb-6 sm:pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Planos"
          title="Um formato para cada momento."
          lead="Comece por uma consulta avulsa ou escolha um acompanhamento contínuo, com consultas presenciais e online ao longo de três ou seis meses."
        />
      </Section>

      <Section className="pt-6 sm:pt-8">
        <PlansGrid plans={plans} />
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Valores e condições podem ser confirmados na pré-consulta gratuita. O pagamento online
          será disponibilizado em breve — por enquanto, o próximo passo é{" "}
          <Link href="/agendar" className="underline underline-offset-4 hover:text-foreground">
            agendar a pré-consulta
          </Link>
          .
        </p>
      </Section>

      <CtaFinal />
    </>
  );
}
