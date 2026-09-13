import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/container";

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Método EM — início">
          <Image
            src="/brand/logo-horizontal.jpg"
            alt="Enzo Mangili — Nutricionista"
            width={160}
            height={160}
            className="h-14 w-14 object-contain"
            priority
          />
        </Link>
        <nav aria-label="Principal" className="hidden text-sm text-muted-foreground sm:block">
          Método EM
        </nav>
      </Container>
    </header>
  );
}
