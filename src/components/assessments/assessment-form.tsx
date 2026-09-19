"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { AssessmentFormState } from "@/actions/assessments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { METRIC_GROUP_LABEL, computeBmi, groupMetricTypes, metricGroup, shortMetricName, type MetricGroup, type MetricType } from "@/domain/assessments/metrics";
import { formatDecimalPtBr, parseDecimalPtBr } from "@/domain/assessments/numbers";

const initialState: AssessmentFormState = {};

/** Campo de métrica (fora do componente pai para não remontar a cada render). */
function MetricField({
  idPrefix,
  type,
  error,
  defaultValue,
  controlled,
}: {
  idPrefix: string;
  type: MetricType;
  error?: string;
  defaultValue?: string;
  controlled?: { value: string; onChange: (value: string) => void };
}) {
  const name = `metric:${type.code}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${type.code}`}>
        {metricGroup(type.code) === "CIRCUMFERENCE" ? shortMetricName(type.name) : type.name} <span className="font-normal text-muted-foreground">({type.unit})</span>
      </Label>
      <Input
        id={`${idPrefix}-${type.code}`}
        name={name}
        inputMode="decimal"
        placeholder="—"
        className="font-mono"
        aria-invalid={error ? true : undefined}
        {...(controlled ? { value: controlled.value, onChange: (event) => controlled.onChange(event.target.value) } : { defaultValue })}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export type AssessmentFormInitial = {
  assessmentDate: string;
  notes: string;
  internalNotes: string;
  visibleToPatient: boolean;
  /** `metric:<CODE>` → texto pt-BR. */
  metrics: Record<string, string>;
};

/**
 * Formulário da avaliação (prompt Fase 9 §4–§17/§48–§49): seções Dados
 * básicos, Composição corporal (colapsável), Medidas corporais (colapsável),
 * Observações e Visibilidade. Nenhuma métrica é obrigatória; valores em
 * texto pt-BR (78 / 78,5 / 78.5) convertidos no servidor. IMC só como
 * prévia derivada — nunca gravado, nunca interpretado.
 */
export function AssessmentForm({
  action,
  mode,
  cancelHref,
  initial,
  metricTypes,
  today,
}: {
  action: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>;
  mode: "create" | "edit";
  cancelHref: string;
  initial: AssessmentFormInitial;
  metricTypes: MetricType[];
  today: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const groups = groupMetricTypes(metricTypes);
  const metricValue = (code: string) => values?.[`metric:${code}`] ?? initial.metrics[code] ?? "";

  const [weightText, setWeightText] = useState(metricValue("WEIGHT"));
  const [heightText, setHeightText] = useState(metricValue("HEIGHT"));
  const bmi = computeBmi(parseDecimalPtBr(weightText), parseDecimalPtBr(heightText));

  const hasGroupValue = (group: MetricGroup) => groups[group].some((type) => metricValue(type.code) !== "");
  const [openComposition, setOpenComposition] = useState(hasGroupValue("COMPOSITION"));
  const [openCircumference, setOpenCircumference] = useState(hasGroupValue("CIRCUMFERENCE"));

  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  const basicOthers = groups.BASIC.filter((type) => type.code !== "WEIGHT" && type.code !== "HEIGHT");
  const weightType = groups.BASIC.find((type) => type.code === "WEIGHT");
  const heightType = groups.BASIC.find((type) => type.code === "HEIGHT");

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <section aria-labelledby={`${idPrefix}-basic`} className="space-y-4">
        <h2 id={`${idPrefix}-basic`} className="font-heading text-lg font-medium">
          {METRIC_GROUP_LABEL.BASIC}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-date`}>Data da avaliação</Label>
            <Input id={`${idPrefix}-date`} name="assessmentDate" type="date" required max={today} defaultValue={values?.assessmentDate ?? initial.assessmentDate} aria-invalid={fieldErrors.assessmentDate ? true : undefined} />
            {err("assessmentDate")}
          </div>
          {weightType ? <MetricField idPrefix={idPrefix} type={weightType} error={fieldErrors["metric:WEIGHT"]} controlled={{ value: weightText, onChange: setWeightText }} /> : null}
          {heightType ? <MetricField idPrefix={idPrefix} type={heightType} error={fieldErrors["metric:HEIGHT"]} controlled={{ value: heightText, onChange: setHeightText }} /> : null}
          {basicOthers.map((type) => (
            <MetricField key={type.id} idPrefix={idPrefix} type={type} error={fieldErrors[`metric:${type.code}`]} defaultValue={metricValue(type.code)} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {bmi != null ? `IMC (derivado de peso e altura, só para referência): ${formatDecimalPtBr(bmi, 1)} kg/m².` : "IMC aparece automaticamente quando peso e altura estiverem preenchidos (não é gravado nem interpretado)."}
        </p>
      </section>

      {(["COMPOSITION", "CIRCUMFERENCE"] as const).map((group) => {
        const open = group === "COMPOSITION" ? openComposition : openCircumference;
        const setOpen = group === "COMPOSITION" ? setOpenComposition : setOpenCircumference;
        const filled = groups[group].filter((type) => metricValue(type.code) !== "").length;
        const panelId = `${idPrefix}-${group}-panel`;
        return (
          <section key={group} className="rounded-xl border border-border">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
              <span>
                <span className="font-heading text-lg font-medium">{METRIC_GROUP_LABEL[group]}</span>
                <span className="block text-xs text-muted-foreground">
                  {group === "COMPOSITION" ? "Bioimpedância: preencha só o que o equipamento fornece." : "Circunferências em cm: preencha só as que você usa."}
                  {filled > 0 ? ` · ${filled} preenchida(s)` : ""}
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
            </button>
            {/* Campos ficam sempre no DOM (hidden) para o envio incluir valores mesmo com a seção fechada. */}
            <div id={panelId} className={cn("grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-3", !open && "hidden")}>
              {groups[group].map((type) => (
                <MetricField key={type.id} idPrefix={idPrefix} type={type} error={fieldErrors[`metric:${type.code}`]} defaultValue={metricValue(type.code)} />
              ))}
            </div>
          </section>
        );
      })}

      <section aria-labelledby={`${idPrefix}-notes-h`} className="space-y-4">
        <h2 id={`${idPrefix}-notes-h`} className="font-heading text-lg font-medium">
          Observações
        </h2>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-notes`}>Observação para o paciente (opcional)</Label>
          <Textarea id={`${idPrefix}-notes`} name="notes" rows={3} maxLength={2000} defaultValue={values?.notes ?? initial.notes} placeholder="Aparece no portal quando a avaliação estiver visível." />
          {err("notes")}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-internal`}>Nota interna (nunca visível ao paciente)</Label>
          <Textarea id={`${idPrefix}-internal`} name="internalNotes" rows={3} maxLength={2000} defaultValue={values?.internalNotes ?? initial.internalNotes} />
          {err("internalNotes")}
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-vis-h`} className="space-y-2">
        <h2 id={`${idPrefix}-vis-h`} className="font-heading text-lg font-medium">
          Visibilidade
        </h2>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" name="visibleToPatient" className="mt-0.5 size-4 accent-primary" defaultChecked={values ? values.visibleToPatient === "on" : initial.visibleToPatient} />
          <span>
            <span className="font-medium">Visível para o paciente</span>
            <span className="block text-xs text-muted-foreground">Desmarcado, a avaliação fica só com você. Você pode liberar depois.</span>
          </span>
        </label>
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : mode === "create" ? "Salvar avaliação" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
