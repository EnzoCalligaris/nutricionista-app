"use client";

import { useActionState, useId, useState } from "react";
import { Star, StarOff } from "lucide-react";
import { createPlanPriceAction, setPrimaryPriceAction, updatePlanPriceAction, type PlanFormState } from "@/actions/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatBRL } from "@/lib/money";
import type { AdminPlan, AdminPlanPrice } from "@/data/plans";

const initialState: PlanFormState = {};

const PAYMENT_LABELS = { AVISTA: "À vista", PARCELADO: "Parcelado", REFERENCIA: "Referência (valor “de”)" } as const;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Condições de preço do plano (prompt Fase 14 §16–§18).
 *
 * A "condição principal" é escolhida explicitamente e pode ser NENHUMA — que
 * é o estado atual do trimestral/semestral: o site então lista as opções sem
 * eleger nenhuma (§17/§67). Trocar a principal é uma operação atômica no
 * banco, então nunca existem duas ao mesmo tempo (§66).
 */
export function PlanPriceManager({ plan }: { plan: AdminPlan }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [primaryState, primaryAction, isSettingPrimary] = useActionState(
    async (_prev: PlanFormState, formData: FormData) => {
      const priceId = String(formData.get("priceId") ?? "");
      return setPrimaryPriceAction(plan.id, priceId === "" ? null : priceId);
    },
    initialState,
  );

  const activePrices = plan.prices.filter((price) => price.active);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {plan.prices.length === 0 ? (
          <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhuma condição de preço cadastrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {plan.prices.map((price) => (
              <li key={price.id} className="rounded-lg border border-border p-3">
                {editing === price.id ? (
                  <PriceForm plan={plan} price={price} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{price.label}</span>
                        {price.isPrimary ? (
                          <Badge className="gap-1 font-normal">
                            <Star className="size-3" aria-hidden="true" />
                            Principal
                          </Badge>
                        ) : null}
                        {!price.active ? <Badge variant="outline" className="font-normal">Inativa</Badge> : null}
                        <Badge variant="secondary" className="font-normal">{PAYMENT_LABELS[price.paymentType]}</Badge>
                      </div>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {formatBRL(price.amountCents)}
                        {price.installments > 1 ? ` · ${price.installments}x de ${formatBRL(Math.round(price.amountCents / price.installments))}` : ""}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(price.id)}>
                      Editar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={primaryAction} className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
        <Label htmlFor={`primary-${plan.id}`} className="flex items-center gap-2">
          <StarOff className="size-4 text-muted-foreground" aria-hidden="true" />
          Condição principal
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            id={`primary-${plan.id}`}
            name="priceId"
            defaultValue={plan.prices.find((price) => price.isPrimary)?.id ?? ""}
            className="max-w-sm"
          >
            <option value="">Nenhuma — listar as opções sem destacar</option>
            {activePrices.map((price) => (
              <option key={price.id} value={price.id}>
                {price.label} · {formatBRL(price.amountCents)}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={isSettingPrimary}>
            {isSettingPrimary ? "Salvando..." : "Definir"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          &ldquo;Nenhuma&rdquo; é um estado válido: o site exibe &ldquo;Opções de investimento&rdquo; com todas as
          condições, sem escolher uma por você.
        </p>
        {primaryState.error ? (
          <p role="alert" className="text-xs text-destructive">
            {primaryState.error}
          </p>
        ) : null}
        {primaryState.ok ? (
          <p role="status" className="text-xs text-primary">
            Condição principal atualizada.
          </p>
        ) : null}
      </form>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Nova condição de preço</summary>
        <div className="mt-3">
          <PriceForm plan={plan} price={null} onDone={() => undefined} />
        </div>
      </details>
    </div>
  );
}

function PriceForm({ plan, price, onDone }: { plan: AdminPlan; price: AdminPlanPrice | null; onDone: () => void }) {
  const action = price
    ? updatePlanPriceAction.bind(null, plan.id, price.id)
    : createPlanPriceAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-label`}>Rótulo</Label>
          <Input id={`${idPrefix}-label`} name="label" required maxLength={120} defaultValue={price?.label ?? ""} placeholder="Ex.: À vista" aria-invalid={fieldErrors.label ? true : undefined} />
          {fieldErrors.label ? <p className="text-xs text-destructive">{fieldErrors.label}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Valor total (R$)</Label>
          <Input id={`${idPrefix}-amount`} name="amount" required inputMode="decimal" defaultValue={price ? centsToInput(price.amountCents) : ""} placeholder="230,00" aria-invalid={fieldErrors.amount ? true : undefined} />
          {fieldErrors.amount ? <p className="text-xs text-destructive">{fieldErrors.amount}</p> : <p className="text-xs text-muted-foreground">Valor cheio da condição, não o da parcela.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-installments`}>Parcelas</Label>
          <Input id={`${idPrefix}-installments`} name="installments" type="number" min={1} max={48} required defaultValue={price?.installments ?? 1} aria-invalid={fieldErrors.installments ? true : undefined} />
          {fieldErrors.installments ? <p className="text-xs text-destructive">{fieldErrors.installments}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-paymentType`}>Forma</Label>
          <NativeSelect id={`${idPrefix}-paymentType`} name="paymentType" defaultValue={price?.paymentType ?? "AVISTA"}>
            {(Object.keys(PAYMENT_LABELS) as (keyof typeof PAYMENT_LABELS)[]).map((key) => (
              <option key={key} value={key}>
                {PAYMENT_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id={`${idPrefix}-active`} name="active" defaultChecked={price?.active ?? true} />
          <Label htmlFor={`${idPrefix}-active`} className="font-normal">Ativa</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`${idPrefix}-isPrimary`} name="isPrimary" defaultChecked={price?.isPrimary ?? false} />
          <Label htmlFor={`${idPrefix}-isPrimary`} className="font-normal">Marcar como principal</Label>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {price ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : price ? "Salvar condição" : "Adicionar condição"}
        </Button>
      </div>
    </form>
  );
}
