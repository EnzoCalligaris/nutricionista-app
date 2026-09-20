"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { createMealPhotoAction, type MealPhotoFormState } from "@/actions/food-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEAL_PHOTO_ACCEPT_ATTR, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/domain/food-analysis/photo";

const initialState: MealPhotoFormState = {};

/**
 * Etapa 1 — foto (prompt Fase 11 §8–§12/§61–§62): dois caminhos, "Tirar
 * foto" (`capture="environment"`, câmera traseira quando o navegador
 * suporta) e "Escolher da galeria" (sem `capture`), com preview, trocar,
 * remover e data/hora da refeição ajustável. O envio é multipart via
 * Server Action; o servidor confere assinatura, redimensiona e remove EXIF.
 */
export function PhotoCaptureForm({ defaultMealAt, maxMealAt }: { defaultMealAt: string; maxMealAt: string }) {
  const [state, formAction, isPending] = useActionState(createMealPhotoAction, initialState);
  const id = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  // Object URL do preview: criada junto com o arquivo e revogada quando ele muda/desmonta.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function pick(input: HTMLInputElement | null) {
    const chosen = input?.files?.[0] ?? null;
    if (!chosen) return;
    if (chosen.size > MEAL_PHOTO_MAX_INPUT_BYTES) {
      setLocalError("A foto precisa ter até 12 MB.");
      input!.value = "";
      return;
    }
    setLocalError(null);
    setFile(chosen);
    // Garante que só o input escolhido carregue o arquivo no envio.
    if (input === cameraRef.current && galleryRef.current) galleryRef.current.value = "";
    if (input === galleryRef.current && cameraRef.current) cameraRef.current.value = "";
  }

  function clear() {
    setFile(null);
    setLocalError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  const photoError = localError ?? state.fieldErrors?.photo;

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      <div className="space-y-2">
        <p className="text-sm font-medium">Foto da refeição</p>
        {/* Os dois inputs ficam no DOM; o que não foi usado é limpo antes do envio. */}
        <input ref={cameraRef} id={`${id}-camera`} name="photo" type="file" accept={MEAL_PHOTO_ACCEPT_ATTR} capture="environment" className="sr-only" onChange={(event) => pick(event.currentTarget)} aria-describedby={photoError ? `${id}-photo-error` : `${id}-photo-hint`} />
        <input ref={galleryRef} id={`${id}-gallery`} name="photo" type="file" accept={MEAL_PHOTO_ACCEPT_ATTR} className="sr-only" onChange={(event) => pick(event.currentTarget)} aria-describedby={photoError ? `${id}-photo-error` : `${id}-photo-hint`} />

        {previewUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), não passa pelo otimizador */}
              <img src={previewUrl} alt="Prévia da foto da refeição selecionada" className="mx-auto max-h-[60vh] w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} disabled={isPending}>
                <RefreshCw data-icon="inline-start" />
                Trocar foto
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={isPending}>
                <Trash2 data-icon="inline-start" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" size="lg" className="h-14" onClick={() => cameraRef.current?.click()} disabled={isPending}>
              <Camera data-icon="inline-start" />
              Tirar foto
            </Button>
            <Button type="button" size="lg" variant="outline" className="h-14" onClick={() => galleryRef.current?.click()} disabled={isPending}>
              <ImagePlus data-icon="inline-start" />
              Escolher da galeria
            </Button>
          </div>
        )}
        {photoError ? (
          <p id={`${id}-photo-error`} role="alert" className="text-sm text-destructive">
            {photoError}
          </p>
        ) : (
          <p id={`${id}-photo-hint`} className="text-xs text-muted-foreground">
            JPG, PNG ou WebP até 12 MB. A foto é redimensionada e os dados de localização (EXIF/GPS) são removidos antes de guardar.
          </p>
        )}
      </div>

      <div className="max-w-xs space-y-1">
        <Label htmlFor={`${id}-meal-at`}>Data e hora da refeição</Label>
        <Input id={`${id}-meal-at`} name="mealAt" type="datetime-local" defaultValue={defaultMealAt} max={maxMealAt} aria-invalid={state.fieldErrors?.mealAt ? true : undefined} />
        {state.fieldErrors?.mealAt ? <p className="text-xs text-destructive">{state.fieldErrors.mealAt}</p> : <p className="text-xs text-muted-foreground">Horário de Brasília. Você pode ajustar depois.</p>}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href="/paciente/refeicoes">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={!file || isPending}>
          <Upload data-icon="inline-start" />
          {isPending ? "Enviando foto..." : "Enviar foto"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">A foto fica disponível só para você e para o seu nutricionista responsável.</p>
    </form>
  );
}
