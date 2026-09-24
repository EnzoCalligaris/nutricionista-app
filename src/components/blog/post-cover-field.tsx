"use client";

import Image from "next/image";
import { useActionState, useId } from "react";
import { uploadPostCoverAction, type PostFormState } from "@/actions/blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PostFormState = {};

/** Capa do post no bucket público `blog` — asset institucional (§45). */
export function PostCoverField({ postId, currentUrl }: { postId: string; currentUrl: string | null }) {
  const action = uploadPostCoverAction.bind(null, postId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldId = useId();
  const error = state.fieldErrors?.file ?? state.error;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-secondary">
        {currentUrl ? (
          <Image src={currentUrl} alt="Capa atual do post" fill sizes="(min-width: 1024px) 20rem, 100vw" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
            Nenhuma capa enviada.
          </div>
        )}
      </div>
      <form action={formAction} className="space-y-2">
        <Label htmlFor={fieldId}>Capa</Label>
        <Input id={fieldId} name="file" type="file" accept="image/webp,image/png,image/jpeg" aria-invalid={error ? true : undefined} />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Enviando..." : currentUrl ? "Substituir capa" : "Enviar capa"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-xs text-primary">
          Capa atualizada.
        </p>
      ) : null}
    </div>
  );
}
