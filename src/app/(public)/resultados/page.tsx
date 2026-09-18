import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ResultsList } from "@/components/marketing/results-list";
import { CtaFinal } from "@/components/marketing/cta-final";
import { getPublishedResults } from "@/data/results";

export const metadata: Metadata = {
  title: "Resultados",
  description:
    "Evoluções reais de pacientes acompanhados pelo Método EM — publicadas somente com consentimento de uso de imagem registrado.",
  alternates: { canonical: "/resultados" },
};

export default async function ResultadosPage() {
  const results = await getPublishedResults();

  return (
    <>
      <Section size="compact" className="pb-6 sm:pb-8">
        <SectionHeading
          as="h1"
          eyebrow="Resultados"
          title="Evoluções acompanhadas de perto."
          lead="Aqui entram apenas resultados de pacientes que autorizaram, por escrito, o uso da própria imagem. Sem montagem, sem promessa — evolução real, no tempo de cada pessoa."
        />
      </Section>

      <Section className="pt-6 sm:pt-8">
        <ResultsList results={results} />
      </Section>

      <CtaFinal />
    </>
  );
}
