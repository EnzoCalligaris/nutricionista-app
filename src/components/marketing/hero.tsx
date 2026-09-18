import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-28">
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            {siteConfig.name} · {siteConfig.professional.title}
          </p>
          <h1 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Nutrição que vai além de receber uma dieta.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O Método EM é um acompanhamento nutricional completo: começa antes da consulta, define
            um planejamento feito para a sua rotina e continua depois — com ajustes e evolução
            acompanhados de perto pelo Enzo Mangili.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-6 text-base">
              <Link href="/agendar">Começar acompanhamento</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
              <Link href="/metodo-em">Conhecer o Método EM</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Emagrecimento funcional, hipertrofia e saúde — sem comprometer a sua rotina social.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:ml-auto lg:max-w-[26rem]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] bg-secondary">
            <Image
              src="/images/enzo/hero.webp"
              alt="Enzo Mangili, nutricionista, sorrindo em ambiente claro"
              fill
              priority
              sizes="(min-width: 1024px) 26rem, (min-width: 640px) 24rem, 100vw"
              className="object-cover object-top"
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
