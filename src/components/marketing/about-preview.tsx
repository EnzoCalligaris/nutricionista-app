import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { SiteContent } from "@/content/site-content";

/** Prévia de "Sobre" na home — textos e nome vindos da configuração (§9/§11). */
export function AboutPreview({ content, name }: { content: SiteContent; name?: string }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <div className="relative mx-auto w-full max-w-sm">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-secondary">
          <Image
            src="/images/enzo/sobre.webp"
            alt="Enzo Mangili sentado em uma poltrona clara, sorrindo"
            fill
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 24rem, 100vw"
            className="object-cover object-top"
          />
        </div>
      </div>
      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">Quem acompanha você</p>
        <h2 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Prazer, {name ?? siteConfig.professional.name}.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{content.aboutIntro}</p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{content.aboutPhilosophy}</p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/sobre">Conhecer o Enzo</Link>
        </Button>
      </div>
    </div>
  );
}
