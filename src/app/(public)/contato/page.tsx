import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ContactForm } from "@/components/marketing/contact-form";
import { getContactInfo, getPublicAddress, getPublicOnlineAttendance } from "@/data/site-settings";
import { hasAnyContactChannel, whatsappHref } from "@/domain/site-settings/contact";
import { formatPhoneForDisplay, instagramHandle, telHref } from "@/domain/site-settings/format";
import { publicAddressLine } from "@/domain/site-settings/resolve";
import { ExternalLink } from "@/components/shared/external-link";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com Enzo Mangili sobre o acompanhamento nutricional e o Método EM.",
  alternates: { canonical: "/contato" },
};

export default async function ContatoPage() {
  const [contact, address, online] = await Promise.all([
    getContactInfo(),
    getPublicAddress(),
    getPublicOnlineAttendance(),
  ]);
  // O endereço só aparece quando configurado E autorizado (§6). Com a flag
  // desligada as chaves nem chegam ao visitante anônimo (RLS).
  const addressLine = publicAddressLine(address);
  const showChannels = hasAnyContactChannel(contact) || Boolean(addressLine) || Boolean(online.platform);

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
                      {formatPhoneForDisplay(contact.whatsapp)}
                    </a>
                  </dd>
                </div>
              ) : null}
              {contact.phone ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
                  <dd>
                    <a href={telHref(contact.phone)} className="underline underline-offset-4">
                      {formatPhoneForDisplay(contact.phone)}
                    </a>
                  </dd>
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
              {contact.instagram ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Instagram</dt>
                  <dd>
                    <ExternalLink href={contact.instagram} className="underline underline-offset-4">
                      {instagramHandle(contact.instagram) ?? "Perfil no Instagram"}
                    </ExternalLink>
                  </dd>
                </div>
              ) : null}
              {contact.linkedin ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn</dt>
                  <dd>
                    <ExternalLink href={contact.linkedin} className="underline underline-offset-4">
                      Perfil no LinkedIn
                    </ExternalLink>
                  </dd>
                </div>
              ) : null}
              {addressLine ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Atendimento presencial</dt>
                  <dd>{addressLine}</dd>
                </div>
              ) : null}
              {online.platform ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Atendimento online</dt>
                  <dd>Por {online.platform}</dd>
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
