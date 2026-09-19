"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import type { SchedulingFormState } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { TimeSlotField } from "@/components/scheduling/time-slot-field";

const initialState: SchedulingFormState = {};

/** Formulário de reagendamento do nutricionista (prompt Fase 6 §25). */
export function RescheduleForm({
  action,
  cancelHref,
  appointmentId,
  initialDate,
  initialModality,
}: {
  action: (prev: SchedulingFormState, formData: FormData) => Promise<SchedulingFormState>;
  cancelHref: string;
  appointmentId: string;
  initialDate: string;
  initialModality: "IN_PERSON" | "ONLINE";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <TimeSlotField
        initialDate={state.values?.date ?? initialDate}
        initialTime={state.values?.time ?? ""}
        initialOverride={state.values?.allowOutsideAvailability === "on"}
        ignoreAppointmentId={appointmentId}
        errors={{ date: fieldErrors.date, time: fieldErrors.time }}
      />
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor={`${idPrefix}-modality`}>Tipo</Label>
        <NativeSelect id={`${idPrefix}-modality`} name="modality" defaultValue={state.values?.modality ?? initialModality}>
          <option value="IN_PERSON">Presencial</option>
          <option value="ONLINE">Online</option>
        </NativeSelect>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Voltar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Reagendando..." : "Confirmar reagendamento"}
        </Button>
      </div>
    </form>
  );
}
