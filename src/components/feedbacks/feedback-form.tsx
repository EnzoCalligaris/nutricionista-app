"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import type { FeedbackFormState } from "@/actions/feedbacks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: FeedbackFormState = {};

export type FeedbackFormInitial = { title: string; content: string; referenceDate: string };

/**
 * Formulário de feedback (prompt Fase 10 §20–§24): título opcional, mensagem
 * em texto livre (textarea — sem editor HTML, sem dangerouslySetInnerHTML),
 * data/referência opcional e dois envios: "Salvar rascunho" (só o
 * nutricionista vê) ou "Disponibilizar ao paciente". Num feedback já
 * disponibilizado, só "Salvar alterações".
 */
export function FeedbackForm({
  action,
  mode,
  published,
  cancelHref,
  initial,
}: {
  action: (prev: FeedbackFormState, formData: FormData) => Promise<FeedbackFormState>;
  mode: "create" | "edit";
  published: boolean;
  cancelHref: string;
  initial: FeedbackFormInitial;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const id = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const value = (key: keyof FeedbackFormInitial) => values?.[key] ?? initial[key];
  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-title`}>Título (opcional)</Label>
          <Input id={`${id}-title`} name="title" maxLength={120} defaultValue={value("title")} aria-invalid={fieldErrors.title ? true : undefined} placeholder="Ex.: Retorno da semana 2" />
          {err("title")}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Data de referência (opcional)</Label>
          <Input id={`${id}-date`} name="referenceDate" type="date" defaultValue={value("referenceDate")} aria-invalid={fieldErrors.referenceDate ? true : undefined} />
          {err("referenceDate")}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-content`}>Mensagem</Label>
        <Textarea id={`${id}-content`} name="content" rows={8} required maxLength={5000} defaultValue={value("content")} aria-invalid={fieldErrors.content ? true : undefined} className="min-h-40 leading-relaxed" />
        {err("content")}
        <p className="text-xs text-muted-foreground">Texto simples, até 5000 caracteres. O paciente lê no portal; não há resposta por aqui.</p>
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
        {published ? (
          <Button type="submit" name="intent" value="draft" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="draft" variant="secondary" disabled={isPending}>
              {isPending ? "Salvando..." : mode === "create" ? "Salvar rascunho" : "Salvar rascunho"}
            </Button>
            <Button type="submit" name="intent" value="publish" disabled={isPending}>
              {isPending ? "Salvando..." : "Disponibilizar ao paciente"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
