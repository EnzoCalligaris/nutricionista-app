import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ExternalLink as ExternalLinkIcon,
  Globe,
  MapPin,
  Newspaper,
  Tags,
  TrendingUp,
  UserRound,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireNutritionist } from "@/lib/auth/session";
import { getSiteSettingsSnapshot } from "@/data/site-settings";
import { customizedContentFields } from "@/domain/site-settings/resolve";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

/**
 * HUB de configurações (prompt Fase 14 §1). Reaproveita as telas que já
 * existem (Agenda — Fase 6, Notificações — Fase 12, Pagamentos — Fase 13) e
 * acrescenta as da Fase 14. Cada card mostra o ESTADO real da configuração,
 * para o nutricionista saber o que ainda falta preencher — sem inventar
 * nenhum valor.
 */
export default async function ConfiguracoesPage() {
  await requireNutritionist();
  const snapshot = await getSiteSettingsSnapshot();

  const contactChannels = [snapshot.contact.phone, snapshot.contact.whatsapp, snapshot.contact.email, snapshot.contact.instagram].filter(
    Boolean,
  ).length;
  const addressConfigured = Boolean(snapshot.address.street || snapshot.address.city || snapshot.address.placeName);
  const customizedContent = customizedContentFields(snapshot.raw).length;

  const sections = [
    {
      href: "/dashboard/configuracoes/perfil",
      icon: UserRound,
      title: "Perfil profissional",
      description: "Nome, título, CRN, bio, áreas de atuação, foto e logo.",
      status: snapshot.professional.crn ? "CRN cadastrado" : "CRN pendente",
      pending: !snapshot.professional.crn,
    },
    {
      href: "/dashboard/configuracoes/contato",
      icon: MapPin,
      title: "Contato e localização",
      description: "Telefone, WhatsApp, e-mail, redes sociais e endereço do consultório.",
      status:
        contactChannels === 0
          ? "Nenhum canal configurado"
          : `${contactChannels} ${contactChannels === 1 ? "canal" : "canais"}${addressConfigured ? " · endereço ok" : " · sem endereço"}`,
      pending: contactChannels === 0,
    },
    {
      href: "/dashboard/configuracoes/atendimento",
      icon: Video,
      title: "Atendimento online",
      description: "Plataforma da consulta online, instruções e link base para o paciente.",
      status: snapshot.online.platform ? snapshot.online.platform : "Plataforma pendente",
      pending: !snapshot.online.platform,
    },
    {
      href: "/dashboard/agenda/configuracoes",
      icon: CalendarDays,
      title: "Agenda",
      description: "Disponibilidade, duração, granularidade, antecedências, horizonte e permissões.",
      status: "Configurada na Agenda",
      pending: false,
    },
    {
      href: "/dashboard/planos",
      icon: Tags,
      title: "Planos e preços",
      description: "Planos, condições de preço, condição principal, benefícios e visibilidade no site.",
      status: "Catálogo administrável",
      pending: false,
    },
    {
      href: "/dashboard/configuracoes/site",
      icon: Globe,
      title: "Site público",
      description: "Headline, subheadline, CTA, textos do Método EM e de Sobre, e SEO padrão.",
      status: customizedContent === 0 ? "Usando os textos atuais do site" : `${customizedContent} texto(s) personalizado(s)`,
      pending: false,
    },
    {
      href: "/dashboard/resultados",
      icon: TrendingUp,
      title: "Resultados",
      description: "Antes/depois, consentimento de uso de imagem, publicação e arquivamento.",
      status: "Gestão com consentimento obrigatório",
      pending: false,
    },
    {
      href: "/dashboard/blog",
      icon: Newspaper,
      title: "Blog",
      description: "Artigos do site: rascunho, publicação, arquivamento, endereço e SEO.",
      status: "CMS próprio",
      pending: false,
    },
    {
      href: "/dashboard/configuracoes/notificacoes",
      icon: Bell,
      title: "Notificações",
      description: "Canais por tipo de aviso, provedores de e-mail/WhatsApp e templates.",
      status: "Configurada na Fase 12",
      pending: false,
    },
    {
      href: "/dashboard/configuracoes/pagamentos",
      icon: CircleDollarSign,
      title: "Pagamentos",
      description: "Provedor, ambiente, métodos do checkout e webhook. Nenhum segredo é editável aqui.",
      status: "Configurada na Fase 13",
      pending: false,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que o site público e o atendimento leem sai daqui. Campo em branco não aparece no site.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Abrir site
          <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ href, icon: Icon, title, description, status, pending }) => (
          <Link key={href} href={href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 font-heading text-lg">
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    {title}
                  </CardTitle>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardDescription>{description}</CardDescription>
                <Badge variant={pending ? "outline" : "secondary"} className="mt-1 w-fit font-normal">
                  {status}
                </Badge>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
