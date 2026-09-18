import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";

type SectionProps = React.ComponentProps<"section"> & {
  tone?: "default" | "muted" | "primary";
  size?: "default" | "compact";
};

/** Faixa horizontal do site com respiro vertical consistente. */
export function Section({ className, tone = "default", size = "default", children, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        size === "compact" ? "py-14 sm:py-20" : "py-20 sm:py-28",
        tone === "muted" && "bg-secondary/60",
        tone === "primary" && "bg-primary text-primary-foreground",
        className,
      )}
      {...props}
    >
      <Container>{children}</Container>
    </section>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
  inverted?: boolean;
};

/** Eyebrow + título + parágrafo de apoio — hierarquia editorial padrão. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  as: Heading = "h2",
  className,
  inverted = false,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "mb-4 text-xs font-medium uppercase tracking-[0.2em]",
            inverted ? "text-primary-foreground/70" : "text-primary",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading
        className={cn(
          "font-heading font-medium tracking-tight text-balance",
          Heading === "h1" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl",
        )}
      >
        {title}
      </Heading>
      {lead ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            inverted ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
