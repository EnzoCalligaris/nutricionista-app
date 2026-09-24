"use client";

import { useActionState, useId, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createPlanBenefitAction, movePlanBenefitAction, updatePlanBenefitAction, type PlanFormState } from "@/actions/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPlan, AdminPlanBenefit } from "@/data/plans";

const initialState: PlanFormState = {};

/**
 * Benefícios do plano (prompt Fase 14 §19): adicionar, editar, ordenar e
 * ativar/desativar. "Grupo exclusivo" não é reintroduzido (§21) e
 * "Comunidade VIP" não aparece até ser criada explicitamente (§20) — a
 * aplicação não sugere nem pré-preenche nenhum dos dois.
 */
export function PlanBenefitManager({ plan }: { plan: AdminPlan }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [moveState, moveAction, isMoving] = useActionState(
    async (_prev: PlanFormState, formData: FormData) =>
      movePlanBenefitAction(plan.id, String(formData.get("benefitId") ?? ""), formData.get("direction") === "up" ? "up" : "down"),
    initialState,
  );

  return (
    <div className="space-y-4">
      {plan.benefits.length === 0 ? (
        <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum benefício cadastrado para este plano.
        </p>
      ) : (
        <ol className="space-y-2">
          {plan.benefits.map((benefit, index) => (
            <li key={benefit.id} className="rounded-lg border border-border p-3">
              {editing === benefit.id ? (
                <BenefitForm plan={plan} benefit={benefit} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  {/* min-w-0 + flex-1: o rótulo longo quebra dentro da própria
                      coluna em vez de empurrar os botões para a linha de baixo. */}
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span className={benefit.active ? "min-w-0" : "min-w-0 text-muted-foreground line-through"}>{benefit.label}</span>
                    {!benefit.active ? <Badge variant="outline" className="font-normal">Inativo</Badge> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={moveAction}>
                      <input type="hidden" name="benefitId" value={benefit.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button type="submit" variant="ghost" size="icon" disabled={isMoving || index === 0} aria-label={`Subir ${benefit.label}`}>
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={moveAction}>
                      <input type="hidden" name="benefitId" value={benefit.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={isMoving || index === plan.benefits.length - 1}
                        aria-label={`Descer ${benefit.label}`}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(benefit.id)}>
                      Editar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {moveState.error ? (
        <p role="alert" className="text-sm text-destructive">
          {moveState.error}
        </p>
      ) : null}

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Novo benefício</summary>
        <div className="mt-3">
          <BenefitForm plan={plan} benefit={null} onDone={() => undefined} />
        </div>
      </details>
    </div>
  );
}

function BenefitForm({ plan, benefit, onDone }: { plan: AdminPlan; benefit: AdminPlanBenefit | null; onDone: () => void }) {
  const action = benefit
    ? updatePlanBenefitAction.bind(null, plan.id, benefit.id)
    : createPlanBenefitAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-label`}>Benefício</Label>
        <Input
          id={`${idPrefix}-label`}
          name="label"
          required
          maxLength={200}
          defaultValue={benefit?.label ?? ""}
          aria-invalid={fieldErrors.label ? true : undefined}
        />
        {fieldErrors.label ? <p className="text-xs text-destructive">{fieldErrors.label}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`${idPrefix}-active`} name="active" defaultChecked={benefit?.active ?? true} />
        <Label htmlFor={`${idPrefix}-active`} className="font-normal">
          Ativo (aparece no site)
        </Label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {benefit ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : benefit ? "Salvar benefício" : "Adicionar benefício"}
        </Button>
      </div>
    </form>
  );
}
