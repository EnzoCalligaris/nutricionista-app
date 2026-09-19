"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bookAppointmentAction, type BookingFormState } from "@/actions/patient-booking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Slot } from "@/domain/scheduling/slots";
import { MODALITY_LABEL } from "@/domain/scheduling/state-machine";
import { formatDayMonth, formatWeekdayLong, formatWeekdayShort } from "@/lib/dates";

type Props = {
  dates: string[];
  selectedDate: string | null;
  slots: Slot[];
  canChooseModality: boolean;
  rescheduleOf: string | null;
  /** Número de dias pesquisados para a lista de datas. */
  horizonDays: number;
};

const initialState: BookingFormState = {};

/**
 * Agendamento pelo portal (prompt Fase 6 §39/§71): Data -> Horário -> Tipo
 * -> Confirmar, tudo numa coluna (mobile-first). Datas são links (URL é a
 * fonte de verdade); horário e tipo são radio groups; a confirmação é uma
 * Server Action que revalida tudo no servidor e no banco. Se o horário
 * acabou de ser reservado, o servidor devolve `slotUnavailable` e a lista
 * é recarregada (§45/§48).
 */
export function BookingFlow({ dates, selectedDate, slots, canChooseModality, rescheduleOf, horizonDays }: Props) {
  const router = useRouter();
  const idPrefix = useId();
  const [state, formAction, isPending] = useActionState(bookAppointmentAction, initialState);
  const [startsAt, setStartsAt] = useState<string>("");
  const [modality, setModality] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");

  // Horário indisponível: limpa a seleção durante o render (padrão
  // "adjust state on prop change") e, no efeito, só avisa e recarrega.
  const activeDateRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    // A data selecionada pode estar fora da faixa visível da lista horizontal.
    activeDateRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedDate]);

  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.slotUnavailable) setStartsAt("");
  }

  useEffect(() => {
    if (state.slotUnavailable) {
      toast.error(state.error ?? "Esse horário acabou de ser reservado. Escolha outro horário.");
      router.refresh();
    }
  }, [state, router]);

  const selectedSlot = slots.find((slot) => slot.startsAt === startsAt) ?? null;
  const modalities = selectedSlot?.modalities ?? ["IN_PERSON", "ONLINE"];
  const effectiveModality = canChooseModality ? (modalities.includes(modality) ? modality : modalities[0]!) : "IN_PERSON";
  const hrefFor = (date: string) => `/paciente/agendar?date=${date}${rescheduleOf ? `&reagendar=${rescheduleOf}` : ""}`;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {rescheduleOf ? <input type="hidden" name="rescheduleOf" value={rescheduleOf} /> : null}
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="modality" value={effectiveModality} />

      {/* 1. Data */}
      <section aria-labelledby={`${idPrefix}-date`} className="space-y-2">
        <h2 id={`${idPrefix}-date`} className="text-sm font-medium">
          1. Escolha a data
        </h2>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há horários disponíveis nos próximos {horizonDays} dias.</p>
        ) : (
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Datas com horários disponíveis">
            {dates.map((date) => {
              const active = date === selectedDate;
              return (
                <li key={date} className="shrink-0">
                  <Link
                    ref={active ? activeDateRef : undefined}
                    href={hrefFor(date)}
                    aria-current={active ? "date" : undefined}
                    aria-label={formatWeekdayLong(date)}
                    className={cn(
                      "flex w-16 flex-col items-center rounded-lg border px-2 py-2 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
                    )}
                  >
                    <span className="uppercase">{formatWeekdayShort(date)}</span>
                    <span className="text-sm font-medium">{formatDayMonth(date).split(" ")[0]}</span>
                    <span className={cn("text-[10px]", active ? "opacity-90" : "text-muted-foreground")}>{formatDayMonth(date).split(" ").slice(2).join(" ")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2. Horário */}
      {selectedDate ? (
        <section aria-labelledby={`${idPrefix}-slot`} className="space-y-2">
          <h2 id={`${idPrefix}-slot`} className="text-sm font-medium">
            2. Escolha o horário — {formatWeekdayLong(selectedDate)}
          </h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há horários disponíveis nesta data.</p>
          ) : (
            <div role="radiogroup" aria-label="Horários disponíveis" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map((slot) => {
                const selected = slot.startsAt === startsAt;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${slot.label}, ${formatWeekdayLong(selectedDate)}`}
                    onClick={() => setStartsAt(slot.startsAt)}
                    className={cn(
                      "h-11 rounded-lg border text-sm tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
                    )}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* 3. Tipo */}
      {selectedSlot ? (
        <section aria-labelledby={`${idPrefix}-modality`} className="space-y-2">
          <h2 id={`${idPrefix}-modality`} className="text-sm font-medium">
            3. Tipo de consulta
          </h2>
          {canChooseModality ? (
            <div role="radiogroup" aria-label="Tipo de consulta" className="grid grid-cols-2 gap-2">
              {(["IN_PERSON", "ONLINE"] as const).map((option) => {
                const allowed = modalities.includes(option);
                const selected = effectiveModality === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!allowed}
                    onClick={() => setModality(option)}
                    className={cn(
                      "h-11 rounded-lg border text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
                    )}
                  >
                    {MODALITY_LABEL[option]}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">O tipo (presencial/online) é definido pelo nutricionista.</p>
          )}
        </section>
      ) : null}

      {/* 4. Confirmar */}
      {selectedSlot ? (
        <section aria-labelledby={`${idPrefix}-confirm`} className="space-y-3 rounded-xl bg-muted/50 p-4">
          <h2 id={`${idPrefix}-confirm`} className="text-sm font-medium">
            4. Confirmar
          </h2>
          <p className="text-sm">
            {formatWeekdayLong(selectedDate!)} às <span className="font-medium tabular-nums">{selectedSlot.label}</span>
            {canChooseModality ? ` · ${MODALITY_LABEL[effectiveModality]}` : ""}
          </p>
          {state.error && !state.slotUnavailable ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={isPending || !startsAt} className="sm:min-w-48">
              {isPending ? "Confirmando..." : rescheduleOf ? "Confirmar reagendamento" : "Confirmar agendamento"}
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/paciente/consultas">Voltar</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
