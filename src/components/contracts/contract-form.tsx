"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContractFormState } from "@/actions/contracts";
import type { DashboardPlan } from "@/data/plans";
import { suggestEndDate } from "@/domain/contracts/dates";
import { generateInstallments, MAX_INSTALLMENTS } from "@/domain/contracts/installments";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { isValidISODate } from "@/lib/calendar";
import { formatCalendarDate } from "@/lib/dates";

type Props = {
  plans: DashboardPlan[];
  today: string;
  action: (prev: ContractFormState, formData: FormData) => Promise<ContractFormState>;
  cancelHref: string;
};

const initialState: ContractFormState = {};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const PAYMENT_TYPE_LABEL = {
  AVISTA: "à vista",
  PARCELADO: "parcelado",
  REFERENCIA: "valor de referência",
} as const;

/**
 * Formulário de novo contrato (prompt Fase 5 §27–§33). Página dedicada
 * (formulário médio, com pré-visualização das parcelas — não cabe num modal).
 *
 * O plano e a condição de preço vêm do banco (§26): escolher uma condição
 * PREENCHE valor e quantidade de parcelas; o nutricionista pode revisar
 * tudo antes de salvar. O valor salvo é um snapshot do contrato (§28).
 * A pré-visualização usa exatamente o mesmo algoritmo do servidor
 * (`generateInstallments`), então o que se vê é o que será gravado.
 */
export function ContractForm({ plans, today, action, cancelHref }: Props) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();

  const values = state.values;
  const [planId, setPlanId] = useState(values?.planId ?? plans[0]?.id ?? "");
  const [planPriceId, setPlanPriceId] = useState(values?.planPriceId ?? "");
  const [startDate, setStartDate] = useState(values?.startDate ?? today);
  const [endDate, setEndDate] = useState(values?.endDate ?? suggestEndDate(today, plans[0]?.durationMonths ?? null));
  const [amount, setAmount] = useState(values?.contractedAmount ?? "");
  const [installmentsCount, setInstallmentsCount] = useState(values?.installmentsCount ?? "1");
  const [firstDueDate, setFirstDueDate] = useState(values?.firstDueDate ?? today);

  const plan = plans.find((candidate) => candidate.id === planId) ?? null;

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    setPlanPriceId("");
    const nextPlan = plans.find((candidate) => candidate.id === nextPlanId);
    if (isValidISODate(startDate)) setEndDate(suggestEndDate(startDate, nextPlan?.durationMonths ?? null));
  }

  function selectPrice(nextPriceId: string) {
    setPlanPriceId(nextPriceId);
    const nextPrice = plan?.prices.find((candidate) => candidate.id === nextPriceId);
    if (nextPrice) {
      setAmount(centsToInput(nextPrice.amountCents));
      setInstallmentsCount(String(nextPrice.installments));
    }
  }

  function changeStartDate(next: string) {
    setStartDate(next);
    if (isValidISODate(next)) {
      setEndDate(suggestEndDate(next, plan?.durationMonths ?? null));
      setFirstDueDate((current) => (current === startDate || !current ? next : current));
    }
  }

  const preview = useMemo(() => {
    const totalCents = parseBRLToCents(amount);
    const count = Number(installmentsCount);
    if (totalCents === null || !Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) return null;
    if (!isValidISODate(firstDueDate)) return null;
    return generateInstallments({ totalCents, count, firstDueDate });
  }, [amount, installmentsCount, firstDueDate]);

  const fieldError = (name: keyof NonNullable<ContractFormState["fieldErrors"]>) => state.fieldErrors?.[name];
  const describedBy = (name: keyof NonNullable<ContractFormState["fieldErrors"]>, hintId?: string) =>
    fieldError(name) ? `${idPrefix}-${name}-error` : hintId;

  const errorText = (name: keyof NonNullable<ContractFormState["fieldErrors"]>) =>
    fieldError(name) ? (
      <p id={`${idPrefix}-${name}-error`} className="text-xs text-destructive">
        {fieldError(name)}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-8 pt-1" noValidate>
      <fieldset className="space-y-4">
        <legend className="font-heading text-base font-medium">Plano e condição</legend>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-planId`}>Plano</Label>
          <NativeSelect
            id={`${idPrefix}-planId`}
            name="planId"
            value={planId}
            onChange={(event) => selectPlan(event.target.value)}
            aria-invalid={fieldError("planId") ? true : undefined}
            aria-describedby={describedBy("planId")}
            required
          >
            {plans.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
                {candidate.durationMonths ? ` · ${candidate.durationMonths} meses` : ""}
                {!candidate.publiclyVisible ? " · não disponível no site" : ""}
              </option>
            ))}
          </NativeSelect>
          {errorText("planId")}
          {plan ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {plan.sessionsInPerson !== null || plan.sessionsOnline !== null ? (
                <span>
                  {plan.sessionsInPerson ?? "—"} presenciais · {plan.sessionsOnline ?? "—"} online
                </span>
              ) : (
                <span>Composição de consultas não definida para este plano.</span>
              )}
              {!plan.publiclyVisible ? <Badge variant="outline">Não disponível no site</Badge> : null}
              {!plan.availableForSale && plan.publiclyVisible ? <Badge variant="outline">Sem venda pública</Badge> : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-planPriceId`}>Condição de preço</Label>
          <NativeSelect
            id={`${idPrefix}-planPriceId`}
            name="planPriceId"
            value={planPriceId}
            onChange={(event) => selectPrice(event.target.value)}
            aria-invalid={fieldError("planPriceId") ? true : undefined}
            aria-describedby={describedBy("planPriceId", `${idPrefix}-planPriceId-hint`)}
          >
            <option value="">Valor negociado (informar manualmente)</option>
            {plan?.prices.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label} — {formatBRL(candidate.amountCents)}
                {candidate.installments > 1 ? ` (${candidate.installments}x)` : ""}
                {` · ${PAYMENT_TYPE_LABEL[candidate.paymentType]}`}
                {candidate.isPrimary ? " · principal" : ""}
              </option>
            ))}
          </NativeSelect>
          {errorText("planPriceId")}
          {!fieldError("planPriceId") ? (
            <p id={`${idPrefix}-planPriceId-hint`} className="text-xs text-muted-foreground">
              Todas as condições ativas do plano. Escolher uma preenche valor e parcelas; o valor salvo no
              contrato não muda se a tabela de preços mudar depois.
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading text-base font-medium">Período</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-startDate`}>Data de início</Label>
            <Input
              id={`${idPrefix}-startDate`}
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(event) => changeStartDate(event.target.value)}
              aria-invalid={fieldError("startDate") ? true : undefined}
              aria-describedby={describedBy("startDate")}
            />
            {errorText("startDate")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-endDate`}>Data de término</Label>
            <Input
              id={`${idPrefix}-endDate`}
              name="endDate"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-invalid={fieldError("endDate") ? true : undefined}
              aria-describedby={describedBy("endDate", `${idPrefix}-endDate-hint`)}
            />
            {errorText("endDate")}
            {!fieldError("endDate") ? (
              <p id={`${idPrefix}-endDate-hint`} className="text-xs text-muted-foreground">
                Sugerida a partir da duração do plano
                {plan?.durationMonths ? ` (${plan.durationMonths} meses)` : " (sem duração: mesmo dia)"}. Revise se
                necessário.
              </p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading text-base font-medium">Valor e parcelamento</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-contractedAmount`}>Valor contratado (R$)</Label>
            <Input
              id={`${idPrefix}-contractedAmount`}
              name="contractedAmount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="font-mono"
              aria-invalid={fieldError("contractedAmount") ? true : undefined}
              aria-describedby={describedBy("contractedAmount")}
            />
            {errorText("contractedAmount")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-installmentsCount`}>Parcelas</Label>
            <Input
              id={`${idPrefix}-installmentsCount`}
              name="installmentsCount"
              type="number"
              min={1}
              max={MAX_INSTALLMENTS}
              step={1}
              required
              value={installmentsCount}
              onChange={(event) => setInstallmentsCount(event.target.value)}
              aria-invalid={fieldError("installmentsCount") ? true : undefined}
              aria-describedby={describedBy("installmentsCount")}
            />
            {errorText("installmentsCount")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-firstDueDate`}>Primeiro vencimento</Label>
            <Input
              id={`${idPrefix}-firstDueDate`}
              name="firstDueDate"
              type="date"
              required
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
              aria-invalid={fieldError("firstDueDate") ? true : undefined}
              aria-describedby={describedBy("firstDueDate")}
            />
            {errorText("firstDueDate")}
          </div>
        </div>

        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Pré-visualização das parcelas</p>
            {preview ? (
              <p className="text-xs text-muted-foreground">
                {preview.length} {preview.length === 1 ? "parcela" : "parcelas"} · total{" "}
                <span className="font-mono tabular-nums">
                  {formatBRL(preview.reduce((sum, installment) => sum + installment.amount_cents, 0))}
                </span>
              </p>
            ) : null}
          </div>
          {preview ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-3">
                    Parcela
                  </TableHead>
                  <TableHead scope="col">Vencimento</TableHead>
                  <TableHead scope="col" className="pr-3 text-right">
                    Valor
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((installment) => (
                  <TableRow key={installment.number}>
                    <TableCell className="pl-3 tabular-nums">
                      {installment.number}/{preview.length}
                    </TableCell>
                    <TableCell>{formatCalendarDate(installment.due_date)}</TableCell>
                    <TableCell className="pr-3 text-right font-mono tabular-nums">
                      {formatBRL(installment.amount_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Informe valor, quantidade de parcelas e primeiro vencimento para ver as parcelas.
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Nenhuma parcela é marcada como paga ao criar o contrato. O registro de pagamentos é feito no
          módulo financeiro.
        </p>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Observações administrativas</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={values?.notes ?? ""}
          placeholder="Condição negociada, contexto do contrato (opcional)"
          aria-invalid={fieldError("notes") ? true : undefined}
          aria-describedby={describedBy("notes")}
        />
        {errorText("notes")}
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
        <Button type="submit" disabled={isPending || !plan}>
          {isPending ? "Salvando..." : "Criar contrato"}
        </Button>
      </div>
    </form>
  );
}
