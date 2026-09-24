"use client";

import Image from "next/image";
import { useActionState, useId } from "react";
import { uploadResultImageAction, type ResultFormState } from "@/actions/results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ResultFormState = {};

/**
 * Upload das fotos de antes/depois (prompt Fase 14 §87). O bucket é PRIVADO:
 * o preview abaixo usa uma URL assinada de 30 s gerada no servidor, nunca
 * persistida. O tipo do arquivo é conferido pela assinatura dos bytes, não
 * pelo que o browser declara.
 */
export function ResultImageField({
  resultId,
  slot,
  previewUrl,
  disabled,
}: {
  resultId: string;
  slot: "before" | "after";
  previewUrl: string | null;
  disabled?: boolean;
}) {
  const action = uploadResultImageAction.bind(null, resultId, slot);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldId = useId();
  const label = slot === "before" ? "Antes" : "Depois";
  const error = state.fieldErrors?.file ?? state.error;

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={fieldId} className="font-heading text-base">
          {label}
        </Label>
        {previewUrl ? null : <span className="text-xs text-muted-foreground">Nenhuma foto enviada</span>}
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-secondary">
        {previewUrl ? (
          <Image src={previewUrl} alt={`Pré-visualização da foto de ${label.toLowerCase()}`} fill sizes="(min-width: 640px) 18rem, 100vw" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
            A foto aparece aqui depois do envio.
          </div>
        )}
      </div>

      <form action={formAction} className="space-y-2">
        <Input id={fieldId} name="file" type="file" accept="image/webp,image/png,image/jpeg" disabled={disabled} aria-invalid={error ? true : undefined} />
        <Button type="submit" variant="outline" size="sm" disabled={isPending || disabled}>
          {isPending ? "Enviando..." : previewUrl ? `Substituir foto de ${label.toLowerCase()}` : `Enviar foto de ${label.toLowerCase()}`}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-xs text-primary">
          Foto atualizada.
        </p>
      ) : null}
    </div>
  );
}
