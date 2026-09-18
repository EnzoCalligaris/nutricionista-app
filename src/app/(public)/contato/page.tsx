import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ContactForm } from "@/components/marketing/contact-form";
import { getContactInfo } from "@/data/site-settings";
import { hasAnyContactChannel, whatsappHref } from "@/domain/site-settings/contact";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com Enzo Mangili sobre o acompanhamento nutricional e o Método EM.",
  alternates: { canonical: "/contato" },
};

export default async function ContatoPage() {
  const contact = await getContactInfo();
  const showChannels = hasAnyContactChannel(contact);

  return (
    <Section size="compact">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <SectionHeading
            as="h1"
            eyebrow="Contato"
            title="Vamos conversar."
            lead="Dúvida sobre planos, formato das consultas ou se o acompanhamento faz sentido para você? Escreva, ou comece direto pela pré-consulta gratuita."
          />

          {showChannels ? (
            <dl className="mt-10 space-y-4 text-sm">
              {contact.whatsapp ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">WhatsApp</dt>
                  <dd>
                    <a href={whatsappHref(contact.whatsapp)} rel="noopener" className="underline underline-offset-4">
                      {contact.whatsapp}
                    </a>
                  </dd>
                </div>
              ) : null}
              {contact.phone ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
                  <dd>{contact.phone}</dd>
                </div>
              ) : null}
              {contact.email ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} className="underline underline-offset-4">
                      {contact.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {contact.address ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Endereço</dt>
                  <dd>{contact.address}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
              O caminho mais direto hoje é a{" "}
              <Link href="/agendar" className="underline underline-offset-4 hover:text-foreground">
                pré-consulta gratuita
              </Link>
              .
            </p>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
