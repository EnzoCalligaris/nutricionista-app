import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentStatusBadge, ModalityBadge } from "@/components/scheduling/badges";
import { MonthlyRevenueChart, ReceivedVsForecastChart } from "@/components/finance/charts";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { requireNutritionist } from "@/lib/auth/session";
import { getMonthlySeries, getPeriodSummary, getReceivablesForecast } from "@/data/financial";
import { listAppointmentsInRange } from "@/data/appointments";
import { getPatientMetrics } from "@/data/patients";
import { getSchedulingSettings } from "@/data/scheduling";
import { monthBoundsISO } from "@/lib/calendar";
import { addDaysISO, dayBounds, instantToDateISO } from "@/lib/timezone";
import { formatBRL } from "@/lib/money";
import { formatMonthYear, formatTimeRange } from "@/lib/dates";

export const metadata: Metadata = { title: "Visão geral" };
export const dynamic = "force-dynamic";

/**
 * Home do dashboard (prompt Fase 7 §42–§49): cards reais — faturamento do
 * mês (receita confirmada), consultas de hoje, pacientes ativos e previsão
 * de rendimento (parcelas em aberto de contratos ativos) — gráficos e a
 * previsão por contrato. Tudo no fuso do nutricionista.
 */
export default async function DashboardOverviewPage() {
  const nutritionist = await requireNutritionist();
  const settings = await getSchedulingSettings(nutritionist.id);
  const timeZone = settings.timeZone;
  const now = new Date();
  const today = instantToDateISO(now, timeZone);
  const month = monthBoundsISO(today);
  const dayStart = dayBounds(today, timeZone).start.toISOString();
  const dayEnd = dayBounds(addDaysISO(today, 1), timeZone).start.toISOString();

  const [monthSummary, appointments, metrics, receivables, series, outlook] = await Promise.all([
    getPeriodSummary(month.start, month.end, timeZone),
    listAppointmentsInRange(nutritionist.id, dayStart, dayEnd),
    getPatientMetrics(nutritionist.id, now),
    getReceivablesForecast(nutritionist.id, today),
    getMonthlySeries(6, timeZone),
    getMonthlySeries(3, timeZone, 3),
  ]);

  const todayAppointments = appointments
    .filter((appointment) => appointment.status !== "CANCELLED" && appointment.status !== "RESCHEDULED")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const forecastTotal = receivables.reduce((sum, row) => sum + row.forecastCents, 0);
  const openReceivables = receivables.filter((row) => row.contractStatus === "ACTIVE" && row.pendingCents > 0).slice(0, 8);

  const cards = [
    {
      title: "Faturamento do mês",
      icon: Wallet,
      value: formatBRL(monthSummary.incomeCents),
      hint: `Receita confirmada em ${formatMonthYear(month.start)}`,
      href: "/dashboard/financeiro",
    },
    {
      title: "Consultas de hoje",
      icon: CalendarCheck,
      value: String(todayAppointments.length),
      hint: todayAppointments.length === 0 ? "Nenhuma consulta agendada" : `${todayAppointments.filter((item) => item.status === "COMPLETED").length} realizada(s)`,
      href: `/dashboard/agenda?view=day&date=${today}`,
    },
    {
      title: "Pacientes ativos",
      icon: Users,
      value: String(metrics.activePatients),
      hint: `${metrics.totalPatients} no total`,
      href: "/dashboard/pacientes",
    },
    {
      title: "Previsão de rendimento",
      icon: TrendingUp,
      value: formatBRL(forecastTotal),
      hint: "Parcelas em aberto de contratos ativos",
      href: "/dashboard/financeiro/previsao",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">Resumo do consultório em {formatMonthYear(month.start)}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map(({ title, icon: Icon, value, hint, href }) => (
          <Card key={title} size="sm">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardDescription>{title}</CardDescription>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-mono text-2xl tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
              <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Ver detalhes
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Receita x despesa</CardTitle>
            <CardDescription>Lançamentos confirmados nos últimos 6 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart series={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Recebido x previsto</CardTitle>
            <CardDescription>Pagamentos confirmados x parcelas com vencimento no mês — 3 meses passados e 3 futuros.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReceivedVsForecastChart series={outlook} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Consultas de hoje</CardTitle>
            <CardDescription>{todayAppointments.length === 0 ? "Agenda livre." : `${todayAppointments.length} consulta(s).`}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/dashboard/agenda" className="font-medium underline underline-offset-4">Abrir agenda</Link>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {todayAppointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/dashboard/agenda/${appointment.id}`} className="block truncate font-medium hover:underline">
                        {appointment.patientName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatTimeRange(appointment.startsAt, appointment.endsAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ModalityBadge modality={appointment.modality} />
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-medium">Previsão de recebimentos</h2>
              <p className="text-sm text-muted-foreground">Contratos ativos com parcelas em aberto.</p>
            </div>
            <Link href="/dashboard/financeiro/previsao" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <ReceivablesTable rows={openReceivables} compact />
        </div>
      </div>
    </div>
  );
}
