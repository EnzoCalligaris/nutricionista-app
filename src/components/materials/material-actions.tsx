"use client";

import { useActionState, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Download, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { archiveMaterialAction, replaceMaterialFileAction } from "@/actions/materials";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/actions/patients";
import { formatFileSize, type MaterialKind } from "@/domain/patient-content/materials";
import { formatDateTime } from "@/lib/dates";

/**
 * Ações do material na página de detalhe (prompt Fase 10 §44–§45/§77):
 * editar, abrir/substituir o arquivo, arquivar (confirmação; nunca hard
 * delete pela UI). Toasts só após o servidor.
 */
export function MaterialActions({
  materialId,
  title,
  kind,
  archived,
  file,
}: {
  materialId: string;
  title: string;
  kind: MaterialKind;
  archived: boolean;
  file: { name: string; sizeBytes: number | null; updatedAt: string; mime: string | null } | null;
}) {
  const router = useRouter();
  const id = useId();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploadState, uploadAction, uploading] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await replaceMaterialFileAction(materialId, _prev, formData);
      if (result.ok) {
        toast.success(file ? "Arquivo substituído." : "Arquivo enviado.");
        router.refresh();
      }
      return result;
    },
    null,
  );

  function archive() {
    startTransition(async () => {
      const result = await archiveMaterialAction(materialId);
      if (result.ok) {
        toast.success("Material arquivado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setConfirmArchive(false);
    });
  }

  return (
    <div className="space-y-6">
      {kind === "FILE" ? (
        <section className="space-y-3 rounded-xl border border-border p-4" aria-labelledby={`${id}-file-h`}>
          <h2 id={`${id}-file-h`} className="font-heading text-base font-medium">
            Arquivo
          </h2>
          {file ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.mime === "application/pdf" ? "PDF" : "Imagem"}
                  {file.sizeBytes ? ` · ${formatFileSize(file.sizeBytes)}` : ""} · atualizado em {formatDateTime(file.updatedAt)}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={`/dashboard/materiais/${materialId}/arquivo`} target="_blank" rel="noopener">
                  <Download data-icon="inline-start" />
                  Abrir
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">O arquivo deste material ainda não foi enviado — ele não pode ser atribuído até isso.</p>
          )}
          {!archived ? (
            <form action={uploadAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`${id}-file`}>{file ? "Substituir arquivo" : "Enviar arquivo"} (PDF, JPG ou PNG, até 10 MB)</Label>
                <Input id={`${id}-file`} name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
              </div>
              <Button type="submit" size="sm" disabled={uploading}>
                <Upload data-icon="inline-start" />
                {uploading ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          ) : null}
          {uploadState && !uploadState.ok ? (
            <p role="alert" className="text-sm text-destructive">
              {uploadState.error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">Armazenamento privado: só você e os pacientes com o material atribuído acessam, por link temporário.</p>
        </section>
      ) : null}

      {!archived ? (
        <section className="flex flex-wrap gap-2" aria-label="Ações do material">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/materiais/${materialId}/editar`}>
              <Pencil data-icon="inline-start" />
              Editar
            </Link>
          </Button>
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmArchive(true)}>
            <Archive data-icon="inline-start" />
            Arquivar
          </Button>
        </section>
      ) : null}

      <AlertDialog open={confirmArchive} onOpenChange={(open) => !open && !isPending && setConfirmArchive(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar &ldquo;{title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Todos os pacientes deixam de ver o material e ele não pode mais ser atribuído. O histórico de quem recebeu permanece. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                archive();
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
