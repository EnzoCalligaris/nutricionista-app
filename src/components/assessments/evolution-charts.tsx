"use client";

import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { chartableMetrics, seriesForMetric, type AssessmentSummary } from "@/domain/assessments/evolution";
import { metricGroup } from "@/domain/assessments/metrics";
import { formatDecimalPtBr, formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate, formatDayMonth } from "@/lib/dates";

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: { date: string; value: number } }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{formatCalendarDate(point.date)}</p>
      <p className="font-mono tabular-nums">{formatMetric(point.value, unit)}</p>
    </div>
  );
}

/**
 * Um gráfico de linha por métrica (prompt Fase 9 §36–§42): eixo X = datas,
 * eixo Y na unidade, tooltip data + valor, avaliação sem a métrica não
 * entra (nunca zero). `role=img` + tabela equivalente `sr-only` (§90).
 */
export function MetricLineChart({ assessments, code, name, unit, color = "var(--chart-1)" }: { assessments: AssessmentSummary[]; code: string; name: string; unit: string; color?: string }) {
  const points = seriesForMetric(assessments, code);
  if (points.length < 2) return null;
  const data = points.map((point) => ({ ...point, label: formatDayMonth(point.date) }));
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, unit === "%" ? 1 : 0.5);
  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label={`${name} ao longo do tempo, ${points.length} avaliações`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} domain={[Math.floor(min - pad), Math.ceil(max + pad)]} tickFormatter={(value: number) => formatDecimalPtBr(value, 1)} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--border)" }} />
            <Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{name} por data</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">{name}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.assessmentId}>
                <td>{formatCalendarDate(point.date)}</td>
                <td>{formatMetric(point.value, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

const PRIMARY = ["WEIGHT", "BODY_FAT_PCT", "MUSCLE_MASS", "LEAN_MASS"];
const COLORS: Record<string, string> = { WEIGHT: "var(--chart-1)", BODY_FAT_PCT: "var(--chart-3)", MUSCLE_MASS: "var(--chart-2)", LEAN_MASS: "var(--chart-2)" };

/**
 * Conjunto de gráficos: peso, gordura, massa muscular/magra (quando há ≥ 2
 * pontos) e um seletor para as demais métricas (medidas). Nunca renderiza
 * gráfico vazio.
 */
export function EvolutionCharts({ assessments }: { assessments: AssessmentSummary[] }) {
  const selectId = useId();
  const chartable = chartableMetrics(assessments);
  const primary = PRIMARY.map((code) => chartable.find((metric) => metric.code === code)).filter((metric) => metric !== undefined);
  // Demais métricas: circunferências primeiro (cintura, quadril…), depois o resto por nome.
  const others = chartable
    .filter((metric) => !PRIMARY.includes(metric.code))
    .sort((a, b) => Number(metricGroup(b.code) === "CIRCUMFERENCE") - Number(metricGroup(a.code) === "CIRCUMFERENCE") || a.name.localeCompare(b.name, "pt-BR"));
  const [selected, setSelected] = useState(others[0]?.code ?? "");
  const selectedMetric = others.find((metric) => metric.code === selected) ?? others[0];

  if (chartable.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Os gráficos aparecem a partir da segunda avaliação com a mesma métrica.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {primary.map((metric) => (
        <section key={metric.code} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-label={metric.name}>
          <h3 className="font-heading text-base font-medium">{metric.name}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{metric.points} avaliações · {metric.unit === "%" ? "percentual" : metric.unit}</p>
          <MetricLineChart assessments={assessments} code={metric.code} name={metric.name} unit={metric.unit} color={COLORS[metric.code]} />
        </section>
      ))}
      {selectedMetric ? (
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-label="Outras métricas">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-heading text-base font-medium">{selectedMetric.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedMetric.points} avaliações · {selectedMetric.unit}</p>
            </div>
            {others.length > 1 ? (
              <div className="min-w-44 space-y-1">
                <Label htmlFor={selectId} className="text-xs">
                  Métrica
                </Label>
                <NativeSelect id={selectId} value={selectedMetric.code} onChange={(event) => setSelected(event.target.value)}>
                  {others.map((metric) => (
                    <option key={metric.code} value={metric.code}>
                      {metric.name}
                      {metricGroup(metric.code) === "CIRCUMFERENCE" ? " (cm)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>
          <MetricLineChart key={selectedMetric.code} assessments={assessments} code={selectedMetric.code} name={selectedMetric.name} unit={selectedMetric.unit} color="var(--chart-4)" />
        </section>
      ) : null}
    </div>
  );
}
