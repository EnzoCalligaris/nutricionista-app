"use client";

import { useActionState, useId } from "react";
import { saveSchedulingSettingsAction, type SchedulingFormState } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchedulingSettings } from "@/data/scheduling";

const initialState: SchedulingFormState = {};

/** Configuração da agenda (prompt Fase 6 §8/§13/§56): duração, granularidade, antecedências, horizonte e permissões do paciente. */
export function SchedulingSettingsForm({ settings }: { settings: SchedulingSettings }) {
  const [state, formAction, isPending] = useActionState(saveSchedulingSettingsAction, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};

  const field = (name: string, label: string, props: React.ComponentProps<typeof Input>, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-${name}`}>{label}</Label>
      <Input id={`${idPrefix}-${name}`} name={name} aria-invalid={fieldErrors[name] ? true : undefined} aria-describedby={`${idPrefix}-${name}-hint`} {...props} />
      {fieldErrors[name] ? (
        <p className="text-xs text-destructive">{fieldErrors[name]}</p>
      ) : hint ? (
        <p id={`${idPrefix}-${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );

  const optional = (value: number | null) => (value == null ? "" : String(value));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "defaultDurationMinutes",
          "Duração padrão da consulta (min)",
          { type: "number", min: 10, max: 480, step: 5, required: true, defaultValue: values?.defaultDurationMinutes ?? String(settings.defaultDurationMinutes) },
          "Usada nos slots do portal e como sugestão no dashboard.",
        )}
        {field(
          "slotGranularityMinutes",
          "Início dos horários a cada (min)",
          { type: "number", min: 5, max: 240, step: 5, required: true, defaultValue: values?.slotGranularityMinutes ?? String(settings.slotGranularityMinutes) },
          "Granularidade independente da duração (ex.: consulta de 60 min começando a cada 30).",
        )}
        {field(
          "minBookingNoticeHours",
          "Antecedência mínima para agendar (h)",
          { type: "number", min: 0, max: 720, defaultValue: values?.minBookingNoticeHours ?? optional(settings.minBookingNoticeHours), placeholder: "sem regra" },
          "Vale para o paciente. Vazio = sem regra (PENDENTE DE DEFINIÇÃO).",
        )}
        {field(
          "minCancellationNoticeHours",
          "Antecedência mínima para cancelar/reagendar (h)",
          { type: "number", min: 0, max: 720, defaultValue: values?.minCancellationNoticeHours ?? optional(settings.minCancellationNoticeHours), placeholder: "sem regra" },
          "Vale para o paciente. Vazio = sem regra (PENDENTE DE DEFINIÇÃO).",
        )}
        {field(
          "maxBookingHorizonDays",
          "Horizonte máximo de agendamento (dias)",
          { type: "number", min: 1, max: 365, defaultValue: values?.maxBookingHorizonDays ?? optional(settings.maxBookingHorizonDays), placeholder: "sem limite" },
          "Até quantos dias no futuro o paciente pode agendar. Vazio = sem limite.",
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox id={`${idPrefix}-canBook`} name="patientCanBook" defaultChecked={values ? values.patientCanBook === "on" : settings.patientCanBook} />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-canBook`}>Paciente pode agendar pelo portal</Label>
            <p className="text-xs text-muted-foreground">Desligado, o portal só mostra as consultas e pede contato.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox
            id={`${idPrefix}-canChoose`}
            name="patientCanChooseModality"
            defaultChecked={values ? values.patientCanChooseModality === "on" : settings.patientCanChooseModality}
          />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-canChoose`}>Paciente escolhe presencial/online</Label>
            <p className="text-xs text-muted-foreground">Desligado, o paciente agenda como presencial e você ajusta.</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Fuso da agenda: {settings.timeZone}.</p>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
