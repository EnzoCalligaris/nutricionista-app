import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/marketing/section";
import { CtaFinal } from "@/components/marketing/cta-final";
import { siteConfig } from "@/config/site";
import { getContactInfo, getProfessionalProfile, getSiteContent, publicSiteAssetUrl } from "@/data/site-settings";
import { ABOUT } from "@/content/metodo-em";

export const metadata: Metadata = {
  title: "Sobre Enzo Mangili",
  description:
    "Enzo Mangili é nutricionista clínico, com foco em emagrecimento funcional, hipertrofia e saúde. Conheça a filosofia por trás do Método EM.",
  alternates: { canonical: "/sobre" },
};

export default async function SobrePage() {
  const [contact, professional, content] = await Promise.all([
    getContactInfo(),
    getProfessionalProfile(),
    getSiteContent(),
  ]);
  const photoUrl = publicSiteAssetUrl(professional.photoPath);
  const name = professional.name ?? siteConfig.professional.name;

  return (
    <>
      <Section size="compact">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-secondary lg:max-w-none">
              <Image
                src={photoUrl ?? "/images/enzo/sobre.webp"}
                alt="Enzo Mangili sentado em uma poltrona clara, sorrindo"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 24rem, 100vw"
                className="object-cover object-top"
                unoptimized={Boolean(photoUrl)}
              />
            </div>
          </div>

          <div>
            <SectionHeading
              as="h1"
              eyebrow="Sobre"
              title={`Prazer, ${name}.`}
              lead="Quem está do outro lado do acompanhamento — e por que ele funciona do jeito que funciona."
            />
            {/* CRN e anos de experiência só aparecem quando configurados (§2/§3). */}
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {contact.crn ? <p>CRN {contact.crn}</p> : null}
              {professional.experienceYears ? (
                <p>
                  {professional.experienceYears} {professional.experienceYears === 1 ? "ano" : "anos"} de experiência
                </p>
              ) : null}
              {professional.specialties.length > 0 ? <p>{professional.specialties.join(" · ")}</p> : null}
            </div>

            <div className="mt-10 space-y-6 text-base leading-relaxed text-foreground/90 sm:text-lg">
              <p>{content.aboutIntro}</p>
              {professional.bioFull ? <p>{professional.bioFull}</p> : null}
              <h2 className="pt-4 font-heading text-2xl font-medium">Como eu trabalho</h2>
              <p>{content.aboutPhilosophy}</p>
              <p>
                Na prática, isso vira um acompanhamento em etapas: uma pré-consulta gratuita para
                entender o seu momento, um planejamento alimentar individualizado e ajustes
                quinzenais a partir do que você me conta — foto, peso e como está sendo a semana.
              </p>
              <h2 className="pt-4 font-heading text-2xl font-medium">O que me move</h2>
              <p>{ABOUT.closing}</p>
              <p className="font-heading text-xl">Conte comigo, Enzo.</p>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/agendar">Começar acompanhamento</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/metodo-em">Conhecer o Método EM</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <CtaFinal />
    </>
  );
}
