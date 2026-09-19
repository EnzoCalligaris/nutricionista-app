"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { FileUp, Link2 } from "lucide-react";
import type { MaterialFormState } from "@/actions/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MaterialKind } from "@/domain/patient-content/materials";

const initialState: MaterialFormState = {};

export type MaterialFormInitial = { kind: MaterialKind; title: string; description: string; externalUrl: string };

/**
 * Formulário de material (prompt Fase 10 §34–§38): título, descrição
 * opcional e ARQUIVO (PDF/JPG/PNG até 10 MB, assinatura conferida no
 * servidor) OU LINK EXTERNO (http(s), validado no servidor) — nunca os dois.
 * Na edição o tipo é fixo; o arquivo é trocado à parte.
 */
export function MaterialForm({
  action,
  mode,
  cancelHref,
  initial,
}: {
  action: (prev: MaterialFormState, formData: FormData) => Promise<MaterialFormState>;
  mode: "create" | "edit";
  cancelHref: string;
  initial: MaterialFormInitial;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const id = useId();
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const [kind, setKind] = useState<MaterialKind>((values?.kind as MaterialKind | undefined) ?? initial.kind);
  const value = (key: "title" | "description" | "externalUrl") => values?.[key] ?? initial[key];
  const err = (name: string) => (fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : null);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {mode === "create" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tipo de material</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: "FILE", label: "Arquivo", hint: "PDF, JPG ou PNG em armazenamento privado.", icon: FileUp },
                { value: "LINK", label: "Link externo", hint: "Endereço https:// de uma página ou documento externo.", icon: Link2 },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  kind === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="mt-0.5 size-4 accent-primary" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <option.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="kind" value={initial.kind} />
      )}

      <div className="space-y-1">
        <Label htmlFor={`${id}-title`}>Título</Label>
        <Input id={`${id}-title`} name="title" required maxLength={160} defaultValue={value("title")} aria-invalid={fieldErrors.title ? true : undefined} placeholder="Ex.: Guia de lanches práticos" />
        {err("title")}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-description`}>Descrição (opcional)</Label>
        <Textarea id={`${id}-description`} name="description" rows={3} maxLength={1000} defaultValue={value("description")} aria-invalid={fieldErrors.description ? true : undefined} placeholder="Aparece para o paciente junto com o material." />
        {err("description")}
      </div>

      {kind === "LINK" ? (
        <div className="space-y-1">
          <Label htmlFor={`${id}-url`}>Link externo</Label>
          <Input id={`${id}-url`} name="externalUrl" type="url" inputMode="url" required maxLength={2048} defaultValue={value("externalUrl")} aria-invalid={fieldErrors.externalUrl ? true : undefined} placeholder="https://" />
          {err("externalUrl")}
          <p className="text-xs text-muted-foreground">Só http:// ou https:// (prefira https). O paciente abre em nova aba.</p>
        </div>
      ) : mode === "create" ? (
        <div className="space-y-1">
          <Label htmlFor={`${id}-file`}>Arquivo (PDF, JPG ou PNG, até 10 MB)</Label>
          <Input id={`${id}-file`} name="file" type="file" required accept="application/pdf,image/jpeg,image/png" aria-invalid={fieldErrors.file ? true : undefined} />
          {err("file")}
          <p className="text-xs text-muted-foreground">Guardado em armazenamento privado; o paciente baixa por link temporário, só enquanto o material estiver atribuído a ele.</p>
        </div>
      ) : null}

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
          {isPending ? (kind === "FILE" && mode === "create" ? "Enviando..." : "Salvando...") : mode === "create" ? "Criar material" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
