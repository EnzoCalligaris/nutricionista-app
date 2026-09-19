"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { getSlotsForDateAction } from "@/actions/scheduling";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Slot } from "@/domain/scheduling/slots";

type Props = {
  initialDate: string;
  initialTime?: string;
  initialOverride?: boolean;
  ignoreAppointmentId?: string;
  errors?: { date?: string; time?: string };
  /** Quando true, o campo de override não aparece (ex.: fluxo do paciente). */
  allowOverride?: boolean;
};

/**
 * Data + horário para o dashboard (prompt Fase 6 §19/§51). Por padrão o
 * horário vem dos slots livres calculados no servidor (mesma regra do
 * portal); com "Permitir fora da disponibilidade" marcado, o nutricionista
 * digita um horário livre — o banco ainda recusa sobreposição e passado.
 * Envia `date`, `time` e `allowOutsideAvailability` no FormData.
 */
export function TimeSlotField({
  initialDate,
  initialTime = "",
  initialOverride = false,
  ignoreAppointmentId,
  errors,
  allowOverride = true,
}: Props) {
  const idPrefix = useId();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [override, setOverride] = useState(initialOverride);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await getSlotsForDateAction(date, { ignoreAppointmentId });
      if (cancelled) return;
      if (result.ok) {
        setSlots(result.slots);
        setLoadError(null);
      } else {
        setSlots([]);
        setLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, ignoreAppointmentId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-date`}>Data</Label>
          <Input
            id={`${idPrefix}-date`}
            name="date"
            type="date"
            required
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              if (!override) setTime("");
            }}
            aria-invalid={errors?.date ? true : undefined}
            aria-describedby={errors?.date ? `${idPrefix}-date-error` : undefined}
          />
          {errors?.date ? (
            <p id={`${idPrefix}-date-error`} className="text-xs text-destructive">
              {errors.date}
            </p>
          ) : null}
        </div>

        {override ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-time`}>Horário</Label>
            <Input
              id={`${idPrefix}-time`}
              name="time"
              type="time"
              step={300}
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-invalid={errors?.time ? true : undefined}
              aria-describedby={errors?.time ? `${idPrefix}-time-error` : `${idPrefix}-time-hint`}
            />
            {errors?.time ? (
              <p id={`${idPrefix}-time-error`} className="text-xs text-destructive">
                {errors.time}
              </p>
            ) : (
              <p id={`${idPrefix}-time-hint`} className="text-xs text-muted-foreground">
                Fora da disponibilidade: o banco ainda recusa horário passado ou sobreposto.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {!override ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Horário</legend>
          <input type="hidden" name="time" value={time} />
          {isPending && slots === null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Carregando horários...
            </p>
          ) : loadError ? (
            <p className="text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : slots && slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há horários disponíveis nesta data.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Horários disponíveis" aria-busy={isPending}>
              {(slots ?? []).map((slot) => {
                const selected = slot.label === time;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${slot.label} em ${date}`}
                    onClick={() => setTime(slot.label)}
                    className={cn(
                      "h-9 min-w-16 rounded-lg border px-3 text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/60 hover:bg-muted",
                    )}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
          {errors?.time ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.time}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {allowOverride ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox
            id={`${idPrefix}-override`}
            name="allowOutsideAvailability"
            checked={override}
            onCheckedChange={(value) => {
              setOverride(value === true);
              setTime("");
            }}
          />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-override`}>Permitir fora da disponibilidade</Label>
            <p className="text-xs text-muted-foreground">
              Override administrativo: ignora horários de atendimento e bloqueios ao escolher o horário. Não
              ignora conflito com outra consulta.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
