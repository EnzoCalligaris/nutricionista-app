import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";
import { MobileNav } from "@/components/layout/mobile-nav";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Enzo Mangili — Nutricionista, página inicial">
          <Image
            src="/brand/logo-horizontal.webp"
            alt="Enzo Mangili — Nutricionista"
            width={848}
            height={265}
            className="h-11 w-auto sm:h-12"
            priority
            sizes="(min-width: 640px) 154px, 141px"
          />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm text-muted-foreground">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/agendar">Começar acompanhamento</Link>
          </Button>
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
