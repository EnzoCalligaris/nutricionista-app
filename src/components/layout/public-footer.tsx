import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <Container className="flex flex-col gap-2 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.fullName}
        </p>
        <p>Plataforma em desenvolvimento.</p>
      </Container>
    </footer>
  );
}
