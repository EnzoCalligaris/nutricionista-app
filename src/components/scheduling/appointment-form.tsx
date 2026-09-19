"use client";

import { useActionState, useId, useState, useTransition } from "react";
import Link from "next/link";
import { getPatientContractOptionsAction, type SchedulingFormState } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PatientPicker } from "@/components/scheduling/patient-picker";
import { TimeSlotField } from "@/components/scheduling/time-slot-field";
import type { ContractOption } from "@/data/appointments";
import { formatCalendarDate } from "@/lib/dates";

type Common = {
  action: (prev: SchedulingFormState, formData: FormData) => Promise<SchedulingFormState>;
  cancelHref: string;
  defaultDurationMinutes: number;
  initialDate: string;
};

type Props = Common &
  (
    | { mode: "create"; initialPatient?: { id: string; name: string } | null; initialContracts?: ContractOption[] }
    | {
        mode: "edit";
        appointmentId: string;
        initial: { date: string; time: string; durationMinutes: number; modality: "IN_PERSON" | "ONLINE"; amount: string };
      }
  );

const initialState: SchedulingFormState = {};

/**
 * Formulário de consulta do nutricionista (prompt Fase 6 §19–§24). Página
 * dedicada; Server Action + useActionState. Contrato só aparece quando o
 * paciente selecionado tem contrato ativo (§21–§22) — nunca vinculado
 * automaticamente quando há mais de um.
 */
export function AppointmentForm(props: Props) {
  const [state, formAction, isPending] = useActionState(props.action, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};

  const [contracts, setContracts] = useState<ContractOption[]>(props.mode === "create" ? (props.initialContracts ?? []) : []);
  const [, startTransition] = useTransition();

  // Contratos do paciente carregados no evento de seleção (não em efeito).
  function handlePatientChange(patientId: string | null) {
    if (!patientId) {
      setContracts([]);
      return;
    }
    startTransition(async () => {
      setContracts(await getPatientContractOptionsAction(patientId));
    });
  }

  const initialDuration =
    values?.durationMinutes ?? (props.mode === "edit" ? String(props.initial.durationMinutes) : String(props.defaultDurationMinutes));
  const initialModality = values?.modality ?? (props.mode === "edit" ? props.initial.modality : "IN_PERSON");
  const initialAmount = values?.amount ?? (props.mode === "edit" ? props.initial.amount : "");

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {props.mode === "create" ? (
        <PatientPicker
          initial={values?.patientId && values.patientName ? { id: values.patientId, name: values.patientName } : (props.initialPatient ?? null)}
          error={fieldErrors.patientId}
          onSelect={(patient) => handlePatientChange(patient?.id ?? null)}
        />
      ) : null}

      <TimeSlotField
        initialDate={values?.date ?? (props.mode === "edit" ? props.initial.date : props.initialDate)}
        initialTime={values?.time ?? (props.mode === "edit" ? props.initial.time : "")}
        initialOverride={values?.allowOutsideAvailability === "on" || props.mode === "edit"}
        ignoreAppointmentId={props.mode === "edit" ? props.appointmentId : undefined}
        errors={{ date: fieldErrors.date, time: fieldErrors.time }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-duration`}>Duração (min)</Label>
          <Input
            id={`${idPrefix}-duration`}
            name="durationMinutes"
            type="number"
            min={10}
            max={480}
            step={5}
            required
            defaultValue={initialDuration}
            aria-invalid={fieldErrors.durationMinutes ? true : undefined}
          />
          {fieldErrors.durationMinutes ? <p className="text-xs text-destructive">{fieldErrors.durationMinutes}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-modality`}>Tipo</Label>
          <NativeSelect id={`${idPrefix}-modality`} name="modality" defaultValue={initialModality} required>
            <option value="IN_PERSON">Presencial</option>
            <option value="ONLINE">Online</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Valor (R$)</Label>
          <Input
            id={`${idPrefix}-amount`}
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="opcional"
            defaultValue={initialAmount}
            className="font-mono"
            aria-invalid={fieldErrors.amount ? true : undefined}
            aria-describedby={`${idPrefix}-amount-hint`}
          />
          {fieldErrors.amount ? (
            <p className="text-xs text-destructive">{fieldErrors.amount}</p>
          ) : (
            <p id={`${idPrefix}-amount-hint`} className="text-xs text-muted-foreground">
              Snapshot informativo; o financeiro é registrado na Fase 7.
            </p>
          )}
        </div>
      </div>

      {props.mode === "create" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-contract`}>Contrato</Label>
            <NativeSelect id={`${idPrefix}-contract`} name="contractId" defaultValue={values?.contractId ?? ""} disabled={contracts.length === 0}>
              <option value="">{contracts.length === 0 ? "Sem contrato ativo (consulta avulsa)" : "Não vincular (consulta avulsa)"}</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.planName} · {formatCalendarDate(contract.startDate)} – {formatCalendarDate(contract.endDate)}
                </option>
              ))}
            </NativeSelect>
            {fieldErrors.contractId ? <p className="text-xs text-destructive">{fieldErrors.contractId}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-status`}>Status inicial</Label>
            <NativeSelect id={`${idPrefix}-status`} name="initialStatus" defaultValue={values?.initialStatus ?? "SCHEDULED"}>
              <option value="SCHEDULED">Agendada</option>
              <option value="CONFIRMED">Confirmada</option>
            </NativeSelect>
          </div>
        </div>
      ) : null}

      {props.mode === "create" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-note`}>Observação interna</Label>
          <Textarea
            id={`${idPrefix}-note`}
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={values?.note ?? ""}
            placeholder="Opcional. Visível só para você (não aparece para o paciente)."
          />
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={props.cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : props.mode === "create" ? "Agendar consulta" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
