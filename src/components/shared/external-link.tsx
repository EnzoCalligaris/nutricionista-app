import type { ComponentProps, ReactNode } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINK_REL, externalUrlHost } from "@/domain/patient-content/urls";

/**
 * Link externo (prompt Fase 10 §16/§70/§96): sempre nova aba com
 * `noopener noreferrer`, ícone + host visíveis para o destino ser
 * identificável, e o `href` NUNCA é montado aqui — só recebe uma URL que já
 * passou pelo validador central no servidor.
 */
export function ExternalLink({ href, children, showHost = true, className, ...props }: { href: string; children: ReactNode; showHost?: boolean } & Omit<ComponentProps<"a">, "href" | "rel" | "target">) {
  const host = externalUrlHost(href);
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_LINK_REL}
      className={cn("inline-flex min-w-0 max-w-full items-center gap-1 underline underline-offset-4", className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      {showHost && host ? <span className="shrink-0 text-xs text-muted-foreground">({host})</span> : null}
      <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}
