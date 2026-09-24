"use client";

import { useActionState, useId } from "react";
import { updatePlanAction, type PlanFormState } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPlan } from "@/data/plans";

const initialState: PlanFormState = {};

/**
 * Dados e VISIBILIDADE do plano (prompt Fase 14 §13/§14). O `code` não é
 * editável: contratos existentes dependem dele. Nada liga a visibilidade
 * sozinho — o ANUAL continua fora do site até o admin decidir o contrário.
 */
export function PlanDetailsForm({ plan }: { plan: AdminPlan }) {
  const action = updatePlanAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};

  const number = (value: number | null) => (value == null ? "" : String(value));

  const flag = (name: "active" | "publiclyVisible" | "availableForSale", label: string, help: string, checked: boolean) => (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <Checkbox id={`${idPrefix}-${name}`} name={name} defaultChecked={checked} />
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-${name}`}>{label}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
        {fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null}
      </div>
    </div>
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-name`}>Nome do plano</Label>
          <Input id={`${idPrefix}-name`} name="name" required defaultValue={plan.name} maxLength={120} aria-invalid={fieldErrors.name ? true : undefined} />
          {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-code`}>Código</Label>
          <Input id={`${idPrefix}-code`} value={plan.code} readOnly disabled />
          <p className="text-xs text-muted-foreground">Não editável: contratos existentes apontam para este código.</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-description`}>Descrição</Label>
          <Textarea id={`${idPrefix}-description`} name="description" rows={3} maxLength={600} defaultValue={plan.description ?? ""} />
          <p className="text-xs text-muted-foreground">Opcional. Vazia, o site mostra apenas nome, composição e benefícios.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-duration`}>Duração (meses)</Label>
          <Input id={`${idPrefix}-duration`} name="durationMonths" type="number" min={1} max={60} defaultValue={number(plan.durationMonths)} placeholder="sem duração" />
          {fieldErrors.durationMonths ? <p className="text-xs text-destructive">{fieldErrors.durationMonths}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-inPerson`}>Consultas presenciais</Label>
          <Input id={`${idPrefix}-inPerson`} name="sessionsInPerson" type="number" min={0} max={120} defaultValue={number(plan.sessionsInPerson)} placeholder="não definido" />
          <p className="text-xs text-muted-foreground">Vazio = composição não conhecida (não é zero).</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-online`}>Consultas online</Label>
          <Input id={`${idPrefix}-online`} name="sessionsOnline" type="number" min={0} max={120} defaultValue={number(plan.sessionsOnline)} placeholder="não definido" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {flag("active", "Ativo", "Desativado, some do dashboard de vendas e do site.", plan.active)}
        {flag("publiclyVisible", "Visível no site", "Precisa estar ativo. O ANUAL fica desligado por padrão.", plan.publiclyVisible)}
        {flag("availableForSale", "Disponível para venda", "Controla o CTA de contratação no site.", plan.availableForSale)}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-primary">
          Plano salvo. O site público já reflete a mudança.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar plano"}
        </Button>
      </div>
    </form>
  );
}
