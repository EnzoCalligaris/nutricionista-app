import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { BlockedTimeForm } from "@/components/scheduling/blocked-time-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getSchedulingSettings } from "@/data/scheduling";
import { isValidISODate } from "@/lib/calendar";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Novo bloqueio" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NovoBloqueioPage({ searchParams }: PageProps<"/dashboard/agenda/bloqueios/novo">) {
  const nutritionist = await requireNutritionist();
  const params = await searchParams;
  const settings = await getSchedulingSettings(nutritionist.id);
  const today = instantToDateISO(new Date(), settings.timeZone);
  const rawDate = firstParam(params.date);
  const initialDate = rawDate && isValidISODate(rawDate) ? rawDate : today;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: `/dashboard/agenda?view=day&date=${initialDate}`, label: "Agenda" }, { label: "Novo bloqueio" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Novo bloqueio</h1>
        <p className="text-sm text-muted-foreground">Férias, compromissos ou qualquer período em que você não atende.</p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Período bloqueado</CardTitle>
          <CardDescription>Um bloqueio não pode cobrir uma consulta agendada ou confirmada — cancele ou reagende antes.</CardDescription>
        </CardHeader>
        <CardContent>
          <BlockedTimeForm initialDate={initialDate} cancelHref={`/dashboard/agenda?view=day&date=${initialDate}`} />
        </CardContent>
      </Card>
    </div>
  );
}
