import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { AvailabilityEditor } from "@/components/scheduling/availability-editor";
import { BlockedTimesList } from "@/components/scheduling/blocked-times-list";
import { SchedulingSettingsForm } from "@/components/scheduling/scheduling-settings-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getAvailabilityRules, getSchedulingSettings, getUpcomingBlockedTimes } from "@/data/scheduling";

export const metadata: Metadata = { title: "Configurações da agenda" };
export const dynamic = "force-dynamic";

/** Disponibilidade semanal + configuração + bloqueios (prompt Fase 6 §6/§8/§56). */
export default async function AgendaConfiguracoesPage() {
  const nutritionist = await requireNutritionist();
  const [settings, rules, blocks] = await Promise.all([
    getSchedulingSettings(nutritionist.id),
    getAvailabilityRules(nutritionist.id),
    getUpcomingBlockedTimes(nutritionist.id, new Date().toISOString()),
  ]);

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs items={[{ href: "/dashboard/agenda", label: "Agenda" }, { label: "Configurações" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Configurações da agenda</h1>
        <p className="text-sm text-muted-foreground">
          Horários de atendimento por dia da semana, duração das consultas e regras do agendamento online.
        </p>
      </div>

      <section aria-labelledby="disponibilidade" className="space-y-3">
        <div>
          <h2 id="disponibilidade" className="font-heading text-lg font-medium">
            Disponibilidade semanal
          </h2>
          <p className="text-sm text-muted-foreground">
            Os horários reais de atendimento ainda não foram definidos — configure aqui os seus. Os pacientes só
            veem horários dentro destes intervalos.
          </p>
        </div>
        <AvailabilityEditor initialRules={rules.map(({ weekday, start_time, end_time, modality, active }) => ({ weekday, start_time, end_time, modality, active }))} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consultas e agendamento online</CardTitle>
            <CardDescription>
              {settings.configured
                ? "Valores salvos por você."
                : "Ainda não configurado — os valores abaixo são padrões técnicos de desenvolvimento, não os reais."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchedulingSettingsForm settings={settings} />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Bloqueios futuros</CardTitle>
            <CardDescription>Férias, compromissos e outras exceções à disponibilidade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <BlockedTimesList blocks={blocks} />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/agenda/bloqueios/novo">
                <Plus data-icon="inline-start" />
                Novo bloqueio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
