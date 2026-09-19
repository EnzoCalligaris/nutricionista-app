"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import type { FinanceFormState } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PatientPicker } from "@/components/scheduling/patient-picker";
import { PAYMENT_METHOD_LABEL, type FinancialType, type PaymentMethod } from "@/domain/finance/definitions";
import type { FinancialCategory } from "@/data/financial";

type Initial = {
  description: string;
  type: FinancialType;
  categoryId: string;
  amount: string;
  occurredOn: string;
  dueOn: string;
  paymentMethod: PaymentMethod | "";
  status: "CONFIRMED" | "PENDING";
  notes: string;
  patient: { id: string; name: string } | null;
};

const initialState: FinanceFormState = {};

/** Lançamento manual (prompt Fase 7 §16–§19): receita ou despesa, paciente opcional, valor em centavos no servidor. */
export function TransactionForm({
  action,
  categories,
  initial,
  cancelHref,
  mode,
}: {
  action: (prev: FinanceFormState, formData: FormData) => Promise<FinanceFormState>;
  categories: FinancialCategory[];
  initial: Initial;
  cancelHref: string;
  mode: "create" | "edit";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const [type, setType] = useState<FinancialType>((values?.type as FinancialType) ?? initial.type);
  const typeCategories = categories.filter((category) => category.type === type && category.active);

  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Tipo</Label>
          <NativeSelect id={`${idPrefix}-type`} name="type" value={type} onChange={(event) => setType(event.target.value as FinancialType)}>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </NativeSelect>
          {err("type")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Categoria</Label>
          <NativeSelect id={`${idPrefix}-category`} name="categoryId" defaultValue={values?.categoryId ?? initial.categoryId}>
            <option value="">Sem categoria</option>
            {typeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
          {err("categoryId")}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Descrição</Label>
        <Input id={`${idPrefix}-description`} name="description" required maxLength={200} defaultValue={values?.description ?? initial.description} aria-invalid={fieldErrors.description ? true : undefined} />
        {err("description")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Valor (R$)</Label>
          <Input id={`${idPrefix}-amount`} name="amount" inputMode="decimal" placeholder="0,00" required className="font-mono" defaultValue={values?.amount ?? initial.amount} aria-invalid={fieldErrors.amount ? true : undefined} />
          {err("amount")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-occurredOn`}>Data</Label>
          <Input id={`${idPrefix}-occurredOn`} name="occurredOn" type="date" required defaultValue={values?.occurredOn ?? initial.occurredOn} aria-invalid={fieldErrors.occurredOn ? true : undefined} />
          {err("occurredOn")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-dueOn`}>Vencimento (opcional)</Label>
          <Input id={`${idPrefix}-dueOn`} name="dueOn" type="date" defaultValue={values?.dueOn ?? initial.dueOn} aria-invalid={fieldErrors.dueOn ? true : undefined} />
          {err("dueOn")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-method`}>Método de pagamento</Label>
          <NativeSelect id={`${idPrefix}-method`} name="paymentMethod" defaultValue={values?.paymentMethod ?? initial.paymentMethod}>
            <option value="">Não informado</option>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <NativeSelect id={`${idPrefix}-status`} name="status" defaultValue={values?.status ?? initial.status}>
            <option value="CONFIRMED">Pago</option>
            <option value="PENDING">Pendente</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Só lançamentos pagos entram em receita, despesa e saldo.</p>
        </div>
      </div>

      <PatientPicker
        initial={values?.patientId && values.patientName ? { id: values.patientId, name: values.patientName } : initial.patient}
        error={fieldErrors.patientId}
        autoOpen={false}
      />
      <p className="-mt-4 text-xs text-muted-foreground">Opcional. Para receita de contrato/parcela use &ldquo;Registrar pagamento&rdquo; no perfil do paciente.</p>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Observações</Label>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={3} maxLength={1000} defaultValue={values?.notes ?? initial.notes} />
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
          {isPending ? "Salvando..." : mode === "create" ? "Criar lançamento" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
