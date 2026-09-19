"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { createBlockedTimeAction, type SchedulingFormState } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: SchedulingFormState = {};

const REASONS = ["Férias", "Compromisso", "Indisponível", "Outro"] as const;

/**
 * Novo bloqueio (prompt Fase 6 §9): horário, intervalo, dia inteiro ou
 * vários dias. Motivo livre (sem enum rígido) a partir de sugestões. Um
 * bloqueio nunca cobre consulta ativa — o banco recusa (trigger, §50).
 */
export function BlockedTimeForm({ initialDate, cancelHref }: { initialDate: string; cancelHref: string }) {
  const [state, formAction, isPending] = useActionState(createBlockedTimeAction, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const [allDay, setAllDay] = useState(values?.allDay === "on");
  const [reasonChoice, setReasonChoice] = useState<string>(
    values?.reason && !REASONS.includes(values.reason as (typeof REASONS)[number]) ? "Outro" : (values?.reason ?? "Compromisso"),
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-start`}>Data inicial</Label>
          <Input id={`${idPrefix}-start`} name="startDate" type="date" required defaultValue={values?.startDate ?? initialDate} aria-invalid={fieldErrors.startDate ? true : undefined} />
          {fieldErrors.startDate ? <p className="text-xs text-destructive">{fieldErrors.startDate}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-end`}>Data final</Label>
          <Input id={`${idPrefix}-end`} name="endDate" type="date" defaultValue={values?.endDate ?? initialDate} aria-invalid={fieldErrors.endDate ? true : undefined} aria-describedby={`${idPrefix}-end-hint`} />
          {fieldErrors.endDate ? (
            <p className="text-xs text-destructive">{fieldErrors.endDate}</p>
          ) : (
            <p id={`${idPrefix}-end-hint`} className="text-xs text-muted-foreground">Igual à inicial para um único dia; posterior para vários dias.</p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Checkbox id={`${idPrefix}-allday`} name="allDay" checked={allDay} onCheckedChange={(value) => setAllDay(value === true)} />
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-allday`}>Dia inteiro</Label>
          <p className="text-xs text-muted-foreground">Bloqueia das 00:00 da data inicial até o fim da data final.</p>
        </div>
      </div>

      {!allDay ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-stime`}>Horário inicial</Label>
            <Input id={`${idPrefix}-stime`} name="startTime" type="time" step={300} defaultValue={values?.startTime ?? ""} aria-invalid={fieldErrors.startTime ? true : undefined} />
            {fieldErrors.startTime ? <p className="text-xs text-destructive">{fieldErrors.startTime}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-etime`}>Horário final</Label>
            <Input id={`${idPrefix}-etime`} name="endTime" type="time" step={300} defaultValue={values?.endTime ?? ""} aria-invalid={fieldErrors.endTime ? true : undefined} />
            {fieldErrors.endTime ? <p className="text-xs text-destructive">{fieldErrors.endTime}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-reason-choice`}>Motivo</Label>
          <NativeSelect id={`${idPrefix}-reason-choice`} value={reasonChoice} onChange={(event) => setReasonChoice(event.target.value)}>
            {REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-reason`}>Descrição</Label>
          <Input
            id={`${idPrefix}-reason`}
            name="reason"
            type="text"
            maxLength={200}
            defaultValue={values?.reason ?? (reasonChoice === "Outro" ? "" : reasonChoice)}
            key={reasonChoice}
            placeholder="Opcional"
          />
        </div>
      </div>

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
          {isPending ? "Salvando..." : "Criar bloqueio"}
        </Button>
      </div>
    </form>
  );
}
