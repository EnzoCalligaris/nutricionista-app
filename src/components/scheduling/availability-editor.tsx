"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveAvailabilityAction } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  WEEKDAY_LABELS,
  sortAvailabilityRules,
  validateAvailabilityRules,
  type AvailabilityRuleDraft,
} from "@/domain/scheduling/availability-rules";

type Draft = AvailabilityRuleDraft & { key: string };


/**
 * Editor da disponibilidade semanal (prompt Fase 6 §6–§7): múltiplos
 * intervalos por dia, ativar/desativar, validação em memória (a mesma do
 * servidor) e um único "Salvar" que substitui o conjunto de regras.
 */
export function AvailabilityEditor({ initialRules }: { initialRules: AvailabilityRuleDraft[] }) {
  const router = useRouter();
  const idPrefix = useId();
  // Chaves determinísticas para as regras iniciais (iguais no servidor e no
  // cliente — evita mismatch de hidratação); novas linhas usam um contador
  // só de cliente, incrementado em evento.
  const [rules, setRules] = useState<Draft[]>(() => sortAvailabilityRules(initialRules).map((rule, index) => ({ ...rule, key: `initial-${index}` })));
  const counter = useRef(0);
  const nextKey = () => `new-${counter.current++}`;
  const [isPending, startTransition] = useTransition();
  const errors = useMemo(() => validateAvailabilityRules(rules), [rules]);
  const errorByIndex = new Map(errors.map((error) => [error.index, error.message]));

  function update(key: string, patch: Partial<AvailabilityRuleDraft>) {
    setRules((current) => current.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)));
  }

  function add(weekday: number) {
    setRules((current) => [...current, { key: nextKey(), weekday, start_time: "", end_time: "", modality: null, active: true }]);
  }

  function remove(key: string) {
    setRules((current) => current.filter((rule) => rule.key !== key));
  }

  function save() {
    if (errors.length > 0) {
      toast.error("Corrija os intervalos destacados antes de salvar.");
      return;
    }
    startTransition(async () => {
      const payload = rules.map(({ weekday, start_time, end_time, modality, active }) => ({ weekday, start_time, end_time, modality, active }));
      const result = await saveAvailabilityAction(JSON.stringify(payload));
      if (result.ok) {
        toast.success("Disponibilidade salva.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // Segunda a domingo na exibição.
  const weekdays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
        {weekdays.map((weekday) => {
          const dayRules = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.weekday === weekday);
          return (
            <li key={weekday} className="grid gap-3 p-3 sm:grid-cols-[120px_1fr] sm:items-start sm:p-4">
              <div className="flex items-center justify-between sm:block">
                <p className="text-sm font-medium">{WEEKDAY_LABELS[weekday]}</p>
                {dayRules.length === 0 ? <p className="text-xs text-muted-foreground sm:mt-0.5">Sem atendimento</p> : null}
              </div>
              <div className="space-y-2">
                {dayRules.map(({ rule, index }) => {
                  const error = errorByIndex.get(index);
                  return (
                    <div key={rule.key} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                        <Label htmlFor={`${idPrefix}-${rule.key}-start`} className="sr-only">
                          Início
                        </Label>
                        <Input
                          id={`${idPrefix}-${rule.key}-start`}
                          type="time"
                          step={300}
                          value={rule.start_time}
                          onChange={(event) => update(rule.key, { start_time: event.target.value })}
                          className="w-28"
                          aria-invalid={error ? true : undefined}
                        />
                        <span className="text-sm text-muted-foreground">até</span>
                        <Label htmlFor={`${idPrefix}-${rule.key}-end`} className="sr-only">
                          Fim
                        </Label>
                        <Input
                          id={`${idPrefix}-${rule.key}-end`}
                          type="time"
                          step={300}
                          value={rule.end_time}
                          onChange={(event) => update(rule.key, { end_time: event.target.value })}
                          className="w-28"
                          aria-invalid={error ? true : undefined}
                        />
                        <Label htmlFor={`${idPrefix}-${rule.key}-modality`} className="sr-only">
                          Modalidade
                        </Label>
                        <NativeSelect
                          id={`${idPrefix}-${rule.key}-modality`}
                          value={rule.modality ?? ""}
                          onChange={(event) => update(rule.key, { modality: (event.target.value || null) as AvailabilityRuleDraft["modality"] })}
                          className="w-44"
                        >
                          <option value="">Presencial e online</option>
                          <option value="IN_PERSON">Só presencial</option>
                          <option value="ONLINE">Só online</option>
                        </NativeSelect>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`${idPrefix}-${rule.key}-active`}
                            checked={rule.active}
                            onCheckedChange={(value) => update(rule.key, { active: value === true })}
                          />
                          <Label htmlFor={`${idPrefix}-${rule.key}-active`} className="text-xs font-normal">
                            Ativo
                          </Label>
                        </div>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(rule.key)} aria-label={`Remover intervalo de ${WEEKDAY_LABELS[weekday]}`}>
                          <Trash2 />
                        </Button>
                      </div>
                      {error ? (
                        <p className="text-xs text-destructive" role="alert">
                          {error}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                <Button type="button" variant="outline" size="xs" onClick={() => add(weekday)}>
                  <Plus data-icon="inline-start" />
                  Adicionar intervalo
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Intervalos adjacentes (ex.: 08:00–12:00 e 12:00–16:00) são permitidos; sobrepostos não. Consultas não atravessam a fronteira entre dois intervalos.
        </p>
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar disponibilidade"}
        </Button>
      </div>
    </div>
  );
}
