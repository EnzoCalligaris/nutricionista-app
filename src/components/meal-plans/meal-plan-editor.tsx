"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { EditorMeal, type EditorContext } from "@/components/meal-plans/editor-meal";
import { MealForm } from "@/components/meal-plans/editor-forms";
import { WEEKDAY_LABEL, WEEKDAY_SHORT, WEEK_ORDER, type Weekday } from "@/domain/meal-plans/definitions";
import { availableWeekdays, type MealPlanDay } from "@/domain/meal-plans/structure";
import { addDayAction, addMealAction, duplicateDayAction, removeDayAction, updateDayAction, updateVersionNotesAction } from "@/actions/meal-plans";

/**
 * Editor do rascunho (prompt Fase 8 §51–§54): dias → refeições → alimentos →
 * substituições. Navegação por dia em abas (sem drag & drop); cada
 * operação salva explicitamente no servidor e recarrega (`router.refresh`).
 */
export function MealPlanEditor({
  patientId,
  versionId,
  versionNotes,
  days,
}: {
  patientId: string;
  versionId: string;
  versionNotes: string | null;
  days: MealPlanDay[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);
  // Se o dia selecionado sumiu (removido), cai no primeiro — derivado, sem efeito.
  const selected = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;

  const ctx: EditorContext = useMemo(
    () => ({
      patientId,
      versionId,
      pending: isPending,
      run: (fn, success) =>
        new Promise((resolve) => {
          startTransition(async () => {
            const result = await fn();
            if (result.ok) {
              toast.success(success);
              router.refresh();
            } else if (!result.fieldErrors) {
              toast.error(result.error);
            }
            resolve(result);
          });
        }),
    }),
    [patientId, versionId, isPending, router],
  );

  const free = availableWeekdays(days);
  const [chosenWeekday, setNewWeekday] = useState<string>("");
  // Escolha válida = a do usuário se ainda estiver livre; senão o primeiro dia livre.
  const newWeekday = free.some((weekday) => String(weekday) === chosenWeekday) ? chosenWeekday : free[0] != null ? String(free[0]) : "";

  return (
    <div className="space-y-6">
      <VersionNotes ctx={ctx} initial={versionNotes ?? ""} />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-3">
          <nav aria-label="Dias do plano" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex w-max min-w-full gap-1 lg:w-full lg:flex-col" role="tablist" aria-orientation="horizontal">
              {days.map((day) => {
                const active = selected?.id === day.id;
                return (
                  <li key={day.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`day-panel-${day.id}`}
                      id={`day-tab-${day.id}`}
                      onClick={() => setSelectedDayId(day.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="whitespace-nowrap">
                        <span className="lg:hidden">{WEEKDAY_SHORT[day.weekday]}</span>
                        <span className="hidden lg:inline">{WEEKDAY_LABEL[day.weekday]}</span>
                      </span>
                      <span className={cn("text-xs tabular-nums", active ? "text-primary-foreground/80" : "")}>{day.meals.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {free.length > 0 ? (
            <form
              className="flex items-end gap-2 lg:flex-col lg:items-stretch"
              onSubmit={(event) => {
                event.preventDefault();
                if (newWeekday === "") return;
                void ctx.run(() => addDayAction(versionId, patientId, { weekday: Number(newWeekday) }), "Dia adicionado.").then((result) => {
                  if (result.ok && result.id) setSelectedDayId(result.id);
                });
              }}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="new-weekday" className="text-xs">
                  Adicionar dia
                </Label>
                <NativeSelect id="new-weekday" value={newWeekday} onChange={(event) => setNewWeekday(event.target.value)}>
                  {free.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {WEEKDAY_LABEL[weekday]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={isPending || newWeekday === ""}>
                <CalendarPlus data-icon="inline-start" />
                Adicionar
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">Todos os dias da semana já estão no plano.</p>
          )}
        </aside>

        <section
          id={selected ? `day-panel-${selected.id}` : undefined}
          role="tabpanel"
          aria-labelledby={selected ? `day-tab-${selected.id}` : undefined}
          className="min-w-0 space-y-4"
        >
          {selected ? (
            <DayPanel key={selected.id} day={selected} days={days} ctx={ctx} onRemoved={() => setSelectedDayId(null)} />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Adicione o primeiro dia da semana para começar a montar o plano.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function VersionNotes({ ctx, initial }: { ctx: EditorContext; initial: string }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <p className={cn("min-w-0", !value && "text-muted-foreground")}>
          <span className="font-medium text-foreground">Observações desta versão:</span> {value || "nenhuma."}
        </p>
        <Button variant="ghost" size="xs" onClick={() => setEditing(true)} disabled={ctx.pending}>
          Editar observações
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void ctx.run(() => updateVersionNotesAction(ctx.versionId, ctx.patientId, { notes: value }), "Observações salvas.").then((result) => {
          if (result.ok) setEditing(false);
        });
      }}
    >
      <Label htmlFor="version-notes">Observações desta versão (o paciente vê no portal)</Label>
      <Textarea id="version-notes" rows={3} maxLength={2000} value={value} onChange={(event) => setValue(event.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setValue(initial); setEditing(false); }} disabled={ctx.pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={ctx.pending}>
          Salvar observações
        </Button>
      </div>
    </form>
  );
}

function DayPanel({ day, days, ctx, onRemoved }: { day: MealPlanDay; days: MealPlanDay[]; ctx: EditorContext; onRemoved: () => void }) {
  const [adding, setAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const targets = WEEK_ORDER.filter((weekday) => weekday !== day.weekday);
  const [target, setTarget] = useState<Weekday>(targets[0]!);
  const targetDay = days.find((candidate) => candidate.weekday === target) ?? null;
  const [notes, setNotes] = useState(day.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  function duplicate(replace: boolean) {
    void ctx.run(() => duplicateDayAction(day.id, ctx.patientId, ctx.versionId, { targetWeekday: target, replace }), `Dia copiado para ${WEEKDAY_LABEL[target].toLowerCase()}.`).then(() => {
      setDuplicating(false);
      setConfirmReplace(false);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-medium">{WEEKDAY_LABEL[day.weekday]}</h2>
          <p className="text-sm text-muted-foreground">{day.meals.length === 0 ? "Este dia ainda não possui refeições." : `${day.meals.length} refeição(ões)`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={ctx.pending} onClick={() => setDuplicating(true)}>
            <Copy data-icon="inline-start" />
            Duplicar dia
          </Button>
          <Button variant="ghost" size="sm" disabled={ctx.pending} onClick={() => setConfirmRemove(true)} aria-label={`Remover ${WEEKDAY_LABEL[day.weekday]}`}>
            <Trash2 data-icon="inline-start" />
            Remover dia
          </Button>
        </div>
      </div>

      {editingNotes ? (
        <form
          className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void ctx.run(() => updateDayAction(day.id, ctx.patientId, ctx.versionId, { notes, expectedUpdatedAt: day.updatedAt }), "Observação do dia salva.").then((result) => {
              if (result.ok) setEditingNotes(false);
            });
          }}
        >
          <Label htmlFor={`day-notes-${day.id}`}>Observação do dia (opcional)</Label>
          <Textarea id={`day-notes-${day.id}`} rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setNotes(day.notes ?? ""); setEditingNotes(false); }} disabled={ctx.pending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={ctx.pending}>
              Salvar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
          <p className={cn("min-w-0", !day.notes && "text-muted-foreground")}>
            <span className="font-medium text-foreground">Observação do dia:</span> {day.notes || "nenhuma."}
          </p>
          <Button variant="ghost" size="xs" onClick={() => setEditingNotes(true)} disabled={ctx.pending}>
            Editar
          </Button>
        </div>
      )}

      {day.meals.length > 0 ? (
        <ul className="space-y-3" aria-label={`Refeições de ${WEEKDAY_LABEL[day.weekday]}`}>
          {day.meals.map((meal, index) => (
            <EditorMeal key={meal.id} meal={meal} position={index} total={day.meals.length} day={day} days={days} ctx={ctx} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <MealForm
          initial={{ name: "", timeOfDay: "", notes: "" }}
          submitLabel="Adicionar refeição"
          pending={ctx.pending}
          errors={addErrors}
          onCancel={() => setAdding(false)}
          onSubmit={async (values) => {
            const result = await ctx.run(() => addMealAction(day.id, ctx.patientId, ctx.versionId, values), "Refeição adicionada.");
            if (result.ok) {
              setAdding(false);
              setAddErrors({});
            } else setAddErrors(result.fieldErrors ?? {});
          }}
        />
      ) : (
        <Button disabled={ctx.pending} onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          {day.meals.length === 0 ? "Adicionar a primeira refeição" : "Adicionar refeição"}
        </Button>
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {WEEKDAY_LABEL[day.weekday]} do rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              {day.meals.length > 0 ? `As ${day.meals.length} refeição(ões) deste dia, com alimentos e substituições, serão removidas do rascunho.` : "O dia é removido do rascunho."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void ctx.run(() => removeDayAction(day.id, ctx.patientId, ctx.versionId), "Dia removido.").then((result) => {
                  setConfirmRemove(false);
                  if (result.ok) onRemoved();
                });
              }}
            >
              Remover dia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicating} onOpenChange={setDuplicating}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar {WEEKDAY_LABEL[day.weekday]}</AlertDialogTitle>
            <AlertDialogDescription>Copia todas as refeições (com alimentos e substituições) deste dia para o dia escolhido.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`dup-day-${day.id}`}>Dia de destino</Label>
            <NativeSelect id={`dup-day-${day.id}`} value={target} onChange={(event) => setTarget(Number(event.target.value) as Weekday)}>
              {targets.map((weekday) => {
                const existing = days.find((candidate) => candidate.weekday === weekday);
                return (
                  <option key={weekday} value={weekday}>
                    {WEEKDAY_LABEL[weekday]}
                    {existing ? (existing.meals.length > 0 ? ` (já tem ${existing.meals.length} refeição(ões))` : " (vazio)") : " (novo dia)"}
                  </option>
                );
              })}
            </NativeSelect>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (targetDay && targetDay.meals.length > 0) {
                  setDuplicating(false);
                  setConfirmReplace(true);
                } else duplicate(false);
              }}
            >
              Duplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir o conteúdo de {WEEKDAY_LABEL[target]}?</AlertDialogTitle>
            <AlertDialogDescription>
              {WEEKDAY_LABEL[target]} já tem {targetDay?.meals.length} refeição(ões). Elas serão substituídas pelas refeições de {WEEKDAY_LABEL[day.weekday]}. Nada é sobrescrito sem esta confirmação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                duplicate(true);
              }}
            >
              Substituir e duplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
