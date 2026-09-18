import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/config/site";
import { getContactInfo } from "@/data/site-settings";
import { hasAnyContactChannel, whatsappHref } from "@/domain/site-settings/contact";

export async function PublicFooter() {
  const contact = await getContactInfo();
  const showContact = hasAnyContactChannel(contact);

  return (
    <footer className="mt-auto border-t border-border bg-secondary/60">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Enzo Mangili — Nutricionista">
              <Image
                src="/brand/monogram-badge.webp"
                alt=""
                width={512}
                height={526}
                className="h-12 w-12 rounded-full object-cover"
                sizes="48px"
              />
              <span className="font-heading text-lg">{siteConfig.fullName}</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {siteConfig.name}: acompanhamento nutricional que começa antes da consulta e continua
              depois dela — planejamento individualizado, ajustes e evolução acompanhada de perto.
            </p>
            {contact.crn ? <p className="mt-3 text-xs text-muted-foreground">CRN {contact.crn}</p> : null}
          </div>

          <nav aria-label="Rodapé">
            <p className="text-sm font-medium">Navegação</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {siteConfig.footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            {showContact ? (
              <>
                <p className="text-sm font-medium">Contato</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {contact.whatsapp ? (
                    <li>
                      <a href={whatsappHref(contact.whatsapp)} className="hover:text-foreground" rel="noopener">
                        WhatsApp: {contact.whatsapp}
                      </a>
                    </li>
                  ) : null}
                  {contact.phone ? <li>Telefone: {contact.phone}</li> : null}
                  {contact.email ? (
                    <li>
                      <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                        {contact.email}
                      </a>
                    </li>
                  ) : null}
                  {contact.address ? <li>{contact.address}</li> : null}
                  {contact.instagram ? (
                    <li>
                      <a href={contact.instagram} className="hover:text-foreground" rel="noopener">
                        Instagram
                      </a>
                    </li>
                  ) : null}
                </ul>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Fale com a gente</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Use a{" "}
                  <Link href="/contato" className="underline underline-offset-4 hover:text-foreground">
                    página de contato
                  </Link>{" "}
                  ou comece pelo{" "}
                  <Link href="/agendar" className="underline underline-offset-4 hover:text-foreground">
                    agendamento
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.fullName}. Todos os direitos reservados.
          </p>
          <ul className="flex flex-wrap gap-4">
            {siteConfig.legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
