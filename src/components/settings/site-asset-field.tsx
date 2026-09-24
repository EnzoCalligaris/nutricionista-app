"use client";

import Image from "next/image";
import { useActionState, useId } from "react";
import { removeSiteAssetAction, uploadSiteAssetAction, type SettingsFormState } from "@/actions/site-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SettingsFormState = {};

/**
 * Upload de asset INSTITUCIONAL (foto profissional, logo, imagem de
 * compartilhamento) no bucket público `site-assets` — separado dos buckets de
 * paciente (prompt Fase 14 §45/§46). Tipo e tamanho são conferidos no
 * servidor pela assinatura do arquivo, não pelo que o browser declara (§87).
 */
export function SiteAssetField({
  settingKey,
  label,
  help,
  currentUrl,
}: {
  settingKey: string;
  label: string;
  help?: string;
  currentUrl: string | null;
}) {
  const action = uploadSiteAssetAction.bind(null, settingKey);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [removeState, removeAction, isRemoving] = useActionState(
    async () => removeSiteAssetAction(settingKey),
    initialState,
  );
  const fieldId = useId();
  const error = state.fieldErrors?.file ?? state.error ?? removeState.error;

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={fieldId}>{label}</Label>
          {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
        </div>
        {currentUrl ? (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            <Image src={currentUrl} alt={`${label} configurada`} fill sizes="80px" className="object-cover" unoptimized />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma imagem configurada.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <Input
            id={fieldId}
            name="file"
            type="file"
            accept="image/webp,image/png,image/jpeg"
            className="max-w-xs"
            aria-invalid={error ? true : undefined}
          />
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </form>
        {currentUrl ? (
          <form action={removeAction}>
            <Button type="submit" variant="ghost" disabled={isRemoving}>
              {isRemoving ? "Removendo..." : "Remover"}
            </Button>
          </form>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-xs text-primary">
          Imagem atualizada.
        </p>
      ) : null}
    </div>
  );
}
