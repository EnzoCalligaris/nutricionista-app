import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";
import type { SiteContent } from "@/content/site-content";

/**
 * Hero da home. Os textos vêm da configuração (Fase 14 §9/§11); a foto vem da
 * configuração quando existir, senão continua a foto real da Fase 4 em
 * `public/images/enzo/` — nada de placeholder inventado.
 */
export function Hero({ content, title, photoUrl }: { content: SiteContent; title?: string; photoUrl?: string | null }) {
  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-28">
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            {siteConfig.name} · {title ?? siteConfig.professional.title}
          </p>
          <h1 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {content.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {content.subheadline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-6 text-base">
              <Link href="/agendar">{content.ctaLabel}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
              <Link href="/metodo-em">Conhecer o Método EM</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{content.heroNote}</p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:ml-auto lg:max-w-[26rem]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] bg-secondary">
            <Image
              src={photoUrl ?? "/images/enzo/hero.webp"}
              alt="Enzo Mangili, nutricionista, sorrindo em ambiente claro"
              fill
              priority
              sizes="(min-width: 1024px) 26rem, (min-width: 640px) 24rem, 100vw"
              className="object-cover object-top"
              unoptimized={Boolean(photoUrl)}
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute -bottom-6 -left-6 hidden h-32 w-32 rounded-full border border-primary/20 lg:block"
          />
        </div>
      </Container>
    </section>
  );
}
