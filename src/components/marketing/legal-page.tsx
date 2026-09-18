import { Container } from "@/components/shared/container";

export type LegalSection = { title: string; paragraphs: string[]; items?: string[] };

/** Layout comum das páginas legais — texto corrido, sem placeholders visíveis. */
export function LegalPage({
  eyebrow,
  title,
  updatedAt,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <Container className="max-w-3xl py-14 sm:py-20">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
      <p className="mt-8 text-base leading-relaxed text-foreground/90 sm:text-lg">{intro}</p>

      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-2xl font-medium">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-relaxed text-foreground/90">
                {paragraph}
              </p>
            ))}
            {section.items ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base leading-relaxed text-foreground/90">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </Container>
  );
}
