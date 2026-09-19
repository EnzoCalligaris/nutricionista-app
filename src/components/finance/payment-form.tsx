"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { recordPaymentAction, type FinanceFormState } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/finance/definitions";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import type { OpenInstallmentOption } from "@/data/payments";
import type { FinancialCategory } from "@/data/financial";

const initialState: FinanceFormState = {};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Registrar pagamento manual (prompt Fase 7 §22–§28): parcela → método →
 * data → valor (pré-preenchido com o restante; parcial permitido, a maior
 * bloqueado no banco) → observação. `idempotencyKey` vem do servidor (uma
 * por render do formulário): reenvio/clique duplo nunca duplica.
 */
export function PaymentForm({
  patient,
  installments,
  categories,
  initialInstallmentId,
  idempotencyKey,
  today,
  returnTo,
}: {
  patient: { id: string; name: string };
  installments: OpenInstallmentOption[];
  categories: FinancialCategory[];
  initialInstallmentId: string | null;
  idempotencyKey: string;
  today: string;
  returnTo: string;
}) {
  const [state, formAction, isPending] = useActionState(recordPaymentAction, initialState);
  const idPrefix = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};

  const [installmentId, setInstallmentId] = useState(values?.installmentId ?? initialInstallmentId ?? "");
  const selected = installments.find((installment) => installment.id === installmentId) ?? null;
  const [amount, setAmount] = useState(values?.amount ?? (selected ? centsToInput(selected.remainingCents) : ""));

  function selectInstallment(nextId: string) {
    setInstallmentId(nextId);
    const next = installments.find((installment) => installment.id === nextId);
    setAmount(next ? centsToInput(next.remainingCents) : "");
  }

  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);
  const incomeCategories = categories.filter((category) => category.type === "INCOME" && category.active);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="patientId" value={patient.id} />
      <input type="hidden" name="patientName" value={patient.name} />
      <input type="hidden" name="contractId" value={selected?.contractId ?? ""} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        Paciente: <span className="font-medium">{patient.name}</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-installment`}>Parcela</Label>
        <NativeSelect id={`${idPrefix}-installment`} name="installmentId" value={installmentId} onChange={(event) => selectInstallment(event.target.value)}>
          <option value="">Sem parcela (pagamento avulso)</option>
          {installments.map((installment) => (
            <option key={installment.id} value={installment.id}>
              {installment.planName} · parcela {installment.number} · vence {formatCalendarDate(installment.dueDate)} · restante {formatBRL(installment.remainingCents)}
            </option>
          ))}
        </NativeSelect>
        {err("installmentId")}
        {installments.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma parcela pendente para este paciente.</p> : null}
        {selected ? (
          <p className="text-xs text-muted-foreground">
            Parcela de {formatBRL(selected.amountCents)}; já recebido {formatBRL(selected.amountCents - selected.remainingCents)}. Pagamento parcial é permitido; valor acima do restante é recusado.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Valor (R$)</Label>
          <Input
            id={`${idPrefix}-amount`}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            required
            className="font-mono"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={fieldErrors.amount ? true : undefined}
          />
          {err("amount")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-method`}>Método</Label>
          <NativeSelect id={`${idPrefix}-method`} name="method" defaultValue={values?.method ?? "PIX"} required>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </NativeSelect>
          {err("method")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-paidOn`}>Data do pagamento</Label>
          <Input id={`${idPrefix}-paidOn`} name="paidOn" type="date" required max={today} defaultValue={values?.paidOn ?? today} aria-invalid={fieldErrors.paidOn ? true : undefined} />
          {err("paidOn")}
        </div>
      </div>

      {!selected ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Categoria da receita</Label>
          <NativeSelect id={`${idPrefix}-category`} name="categoryId" defaultValue={values?.categoryId ?? ""}>
            <option value="">Padrão</option>
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Observação (opcional)</Label>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} maxLength={500} defaultValue={values?.notes ?? ""} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={returnTo}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando..." : "Registrar pagamento"}
        </Button>
      </div>
    </form>
  );
}
