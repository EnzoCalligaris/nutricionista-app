import { METRIC_GROUP_LABEL, computeBmi, groupMetricTypes, shortMetricName, type MetricGroup } from "@/domain/assessments/metrics";
import { findValue, type MeasurementValue } from "@/domain/assessments/evolution";
import { formatDecimalPtBr, formatMetric } from "@/domain/assessments/numbers";

/**
 * Medidas de uma avaliação agrupadas (portal e dashboard). IMC derivado só
 * quando peso + altura existem na mesma avaliação — valor, sem faixa.
 */
export function MeasurementList({ measurements, showBmi = true }: { measurements: MeasurementValue[]; showBmi?: boolean }) {
  if (measurements.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma medida registrada.</p>;
  const groups = groupMetricTypes(measurements);
  const bmi = showBmi ? computeBmi(findValue({ measurements }, "WEIGHT"), findValue({ measurements }, "HEIGHT")) : null;
  return (
    <div className="space-y-4">
      {(Object.keys(groups) as MetricGroup[])
        .filter((group) => groups[group].length > 0)
        .map((group) => (
          <section key={group} aria-labelledby={`mg-${group}`}>
            <h3 id={`mg-${group}`} className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {METRIC_GROUP_LABEL[group]}
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {groups[group].map((entry) => (
                <div key={entry.code} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{group === "CIRCUMFERENCE" ? shortMetricName(entry.name) : entry.name}</dt>
                  <dd className="font-mono text-sm font-medium tabular-nums">{formatMetric(entry.value, entry.unit)}</dd>
                </div>
              ))}
              {group === "BASIC" && bmi != null ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">IMC (derivado)</dt>
                  <dd className="font-mono text-sm font-medium tabular-nums">{formatDecimalPtBr(bmi, 1)} kg/m²</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ))}
    </div>
  );
}
