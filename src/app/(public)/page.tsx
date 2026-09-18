import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Hero } from "@/components/marketing/hero";
import { Section, SectionHeading } from "@/components/marketing/section";
import { MethodPhases } from "@/components/marketing/method-phases";
import { Pillars } from "@/components/marketing/pillars";
import { AboutPreview } from "@/components/marketing/about-preview";
import { PlansGrid } from "@/components/marketing/plans-grid";
import { ResultsList } from "@/components/marketing/results-list";
import { CtaFinal } from "@/components/marketing/cta-final";
import { PostCard } from "@/components/blog/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { getPublicPlans } from "@/data/plans";
import { getPublishedPosts } from "@/data/blog";
import { getPublishedResults } from "@/data/results";
import { MISSION } from "@/content/metodo-em";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — ${siteConfig.fullName}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [plans, posts, results] = await Promise.all([
    getPublicPlans(),
    getPublishedPosts(3),
    getPublishedResults(),
  ]);

  // Só dados realmente disponíveis (prompt Fase 4 §36): sem address,
  // telephone, priceRange, rating ou reviews inventados.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${siteConfig.url}/#enzo`,
        name: siteConfig.professional.name,
        jobTitle: siteConfig.professional.title,
        url: siteConfig.url,
        image: `${siteConfig.url}/images/enzo/hero.webp`,
      },
      {
        "@type": "WebSite",
        name: siteConfig.name,
        url: siteConfig.url,
        inLanguage: "pt-BR",
        description: siteConfig.description,
        author: { "@id": `${siteConfig.url}/#enzo` },
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Hero />

      <Section tone="muted" size="compact">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <SectionHeading
            eyebrow="O que é o Método EM"
            title="Uma metodologia de acompanhamento, não uma dieta."
          />
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg lg:pt-2">
            <p>
              EM são as iniciais de Enzo Mangili — e também o jeito de trabalhar: antes, durante e
              depois da consulta. Em vez de entregar um cardápio e esperar o retorno, o
              acompanhamento se organiza em pré-consulta, consulta, ajustes e evolução.
            </p>
            <p>{MISSION}</p>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Como funciona"
          title="Antes, durante e depois."
          lead="Cada etapa tem um papel — e nenhuma delas é uma visita isolada."
          className="mb-14"
        />
        <MethodPhases compact />
        <div className="mt-12">
          <Button asChild variant="outline">
            <Link href="/metodo-em">Ver o método em detalhe</Link>
          </Button>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Pilares"
          title="O que sustenta o acompanhamento."
          className="mb-12"
        />
        <Pillars />
      </Section>

      <Section>
        <AboutPreview />
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Resultados"
          title="Evoluções acompanhadas de perto."
          lead="Cada resultado publicado aqui tem consentimento de imagem registrado."
          className="mb-10"
        />
        <ResultsList results={results} compact />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Planos"
          title="Um formato para cada momento."
          lead="Consulta avulsa para começar, ou acompanhamento contínuo de três ou seis meses."
          className="mb-10"
        />
        <PlansGrid plans={plans} />
      </Section>

      {posts.ok && posts.data.length > 0 ? (
        <Section tone="muted">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Blog" title="Conteúdos recentes." />
            <Button asChild variant="ghost">
              <Link href="/blog">Ver todos</Link>
            </Button>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.data.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </Section>
      ) : null}

      <CtaFinal />
    </>
  );
}
