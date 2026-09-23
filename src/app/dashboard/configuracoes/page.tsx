import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, CircleDollarSign, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Hub de configurações. Agenda (Fase 6) e Notificações (Fase 12) já existem;
 * dados do profissional e integrações de pagamento continuam para a Fase 14
 * (docs/PROJECT_SPEC.md §6).
 */
export default function ConfiguracoesPage() {
  const sections = [
    { href: "/dashboard/agenda/configuracoes", icon: CalendarDays, title: "Agenda", description: "Duração, antecedências, agendamento online e fuso horário." },
    { href: "/dashboard/configuracoes/notificacoes", icon: Bell, title: "Notificações", description: "Canais por tipo de aviso, provedores de e-mail/WhatsApp e templates." },
    { href: "/dashboard/configuracoes/pagamentos", icon: CircleDollarSign, title: "Pagamentos", description: "Provedor de pagamento, ambiente, métodos do checkout e webhook." },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajustes da agenda, das notificações e dos pagamentos online. Dados do profissional e textos do site chegam na Fase 14.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 font-heading text-lg">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                    {title}
                  </CardTitle>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Card className="border-dashed sm:col-span-2">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Settings className="size-4" aria-hidden="true" />
            Dados do profissional e textos do site — Fase 14.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
