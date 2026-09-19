"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";
import type { MonthlyPoint } from "@/data/financial";

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthLabel(monthStart: string): string {
  const month = Number(monthStart.slice(5, 7)) - 1;
  return `${MONTH_SHORT[month]}/${monthStart.slice(2, 4)}`;
}

function toReais(cents: number): number {
  return Math.round(cents) / 100;
}

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function axisTick(value: number): string {
  if (value >= 1000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: <span className="font-mono tabular-nums">{formatBRL(Math.round(entry.value * 100))}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Gráficos do financeiro (prompt Fase 7 §46–§49): receita x despesa por mês
 * e recebido x previsto. Cada gráfico traz uma tabela equivalente (sr-only)
 * para leitores de tela (§77). Só dados reais; sem comparação percentual
 * inventada.
 */
export function MonthlyRevenueChart({ series }: { series: MonthlyPoint[] }) {
  const data = series.map((point) => ({
    month: monthLabel(point.monthStart),
    Receita: toReais(point.incomeCents),
    Despesa: toReais(point.expenseCents),
  }));
  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label="Receita e despesa mensais dos últimos meses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={64} tickFormatter={axisTick} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Receita" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesa" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Receita e despesa por mês</caption>
          <thead>
            <tr><th scope="col">Mês</th><th scope="col">Receita</th><th scope="col">Despesa</th></tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.monthStart}>
                <td>{monthLabel(point.monthStart)}</td>
                <td>{formatBRL(point.incomeCents)}</td>
                <td>{formatBRL(point.expenseCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Recebido (pagamentos confirmados) x previsto (parcelas com vencimento no mês). */
export function ReceivedVsForecastChart({ series }: { series: MonthlyPoint[] }) {
  const data = series.map((point) => ({
    month: monthLabel(point.monthStart),
    Recebido: toReais(point.receivedCents),
    Previsto: toReais(point.dueCents),
  }));
  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label="Recebido e previsto por mês">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={64} tickFormatter={axisTick} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Recebido" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Previsto" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Recebido e previsto por mês</caption>
          <thead>
            <tr><th scope="col">Mês</th><th scope="col">Recebido</th><th scope="col">Previsto</th></tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.monthStart}>
                <td>{monthLabel(point.monthStart)}</td>
                <td>{formatBRL(point.receivedCents)}</td>
                <td>{formatBRL(point.dueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
