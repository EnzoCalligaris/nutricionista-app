"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import type { SupplementFormState } from "@/actions/supplements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: SupplementFormState = {};

export type SupplementFormInitial = {
  name: string;
  brand: string;
  instructions: string;
  doseText: string;
  scheduleText: string;
  startsOn: string;
  endsOn: string;
  notes: string;
  purchaseUrl: string;
};

export const EMPTY_SUPPLEMENT: SupplementFormInitial = { name: "", brand: "", instructions: "", doseText: "", scheduleText: "", startsOn: "", endsOn: "", notes: "", purchaseUrl: "" };

/**
 * Formulário da recomendação de suplemento (prompt Fase 10 §5–§9): campos
 * textuais (dose/frequência livres — sem engine, sem lista rígida), período
 * opcional e link de compra opcional (só http(s), validado no servidor).
 * O sistema só registra a orientação do nutricionista.
 */
export function SupplementForm({
  action,
  mode,
  cancelHref,
  initial,
}: {
  action: (prev: SupplementFormState, formData: FormData) => Promise<SupplementFormState>;
  mode: "create" | "edit";
  cancelHref: string;
  initial: SupplementFormInitial;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const id = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const value = (key: keyof SupplementFormInitial) => values?.[key] ?? initial[key];
  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <section aria-labelledby={`${id}-product-h`} className="space-y-4">
        <h2 id={`${id}-product-h`} className="font-heading text-lg font-medium">
          Produto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-name`}>Nome do suplemento</Label>
            <Input id={`${id}-name`} name="name" required maxLength={120} defaultValue={value("name")} aria-invalid={fieldErrors.name ? true : undefined} placeholder="Ex.: Whey protein, Creatina, Ômega 3" />
            {err("name")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-brand`}>Marca / produto comercial (opcional)</Label>
            <Input id={`${id}-brand`} name="brand" maxLength={120} defaultValue={value("brand")} aria-invalid={fieldErrors.brand ? true : undefined} />
            {err("brand")}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-url`}>Link de compra (opcional)</Label>
          <Input id={`${id}-url`} name="purchaseUrl" type="url" inputMode="url" maxLength={2048} defaultValue={value("purchaseUrl")} aria-invalid={fieldErrors.purchaseUrl ? true : undefined} placeholder="https://" />
          {err("purchaseUrl")}
          <p className="text-xs text-muted-foreground">Só endereços http:// ou https:// (prefira https). É apenas um link externo — sem cupom, comissão ou parceria.</p>
        </div>
      </section>

      <section aria-labelledby={`${id}-use-h`} className="space-y-4">
        <h2 id={`${id}-use-h`} className="font-heading text-lg font-medium">
          Orientação de uso
        </h2>
        <div className="space-y-1">
          <Label htmlFor={`${id}-instructions`}>Orientação</Label>
          <Textarea id={`${id}-instructions`} name="instructions" rows={3} maxLength={2000} defaultValue={value("instructions")} aria-invalid={fieldErrors.instructions ? true : undefined} placeholder="Como usar, com o quê, cuidados." />
          {err("instructions")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-dose`}>Dose / quantidade (opcional)</Label>
            <Input id={`${id}-dose`} name="doseText" maxLength={120} defaultValue={value("doseText")} aria-invalid={fieldErrors.doseText ? true : undefined} placeholder='Ex.: "1 cápsula", "5 g", "conforme orientação"' />
            {err("doseText")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-schedule`}>Frequência / momento (opcional)</Label>
            <Input id={`${id}-schedule`} name="scheduleText" maxLength={120} defaultValue={value("scheduleText")} aria-invalid={fieldErrors.scheduleText ? true : undefined} placeholder='Ex.: "1x ao dia", "após o treino"' />
            {err("scheduleText")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-starts`}>Início (opcional)</Label>
            <Input id={`${id}-starts`} name="startsOn" type="date" defaultValue={value("startsOn")} aria-invalid={fieldErrors.startsOn ? true : undefined} />
            {err("startsOn")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-ends`}>Fim (opcional)</Label>
            <Input id={`${id}-ends`} name="endsOn" type="date" defaultValue={value("endsOn")} aria-invalid={fieldErrors.endsOn ? true : undefined} />
            {err("endsOn")}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-notes`}>Observações (opcional)</Label>
          <Textarea id={`${id}-notes`} name="notes" rows={3} maxLength={2000} defaultValue={value("notes")} aria-invalid={fieldErrors.notes ? true : undefined} placeholder="Aparece para o paciente junto com a recomendação." />
          {err("notes")}
        </div>
      </section>

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
          {isPending ? "Salvando..." : mode === "create" ? "Salvar recomendação" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
