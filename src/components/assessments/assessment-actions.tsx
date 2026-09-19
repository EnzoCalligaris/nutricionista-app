"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, Eye, EyeOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { archiveAssessmentAction, deleteAssessmentAction, removeReportAction, setVisibilityAction, uploadReportAction } from "@/actions/assessments";
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
import { formatDateTime } from "@/lib/dates";

type Pending = "archive" | "delete" | "removeReport" | null;

/**
 * Ações da avaliação (prompt Fase 9 §18/§25/§28–§29): liberar/ocultar ao
 * paciente, arquivar (dado já exibido) ou excluir (nunca exibido),
 * anexar/substituir/remover relatório. Toasts só após o servidor.
 */
export function AssessmentActions({
  assessmentId,
  patientId,
  visibleToPatient,
  archived,
  canDelete,
  report,
}: {
  assessmentId: string;
  patientId: string;
  visibleToPatient: boolean;
  archived: boolean;
  canDelete: boolean;
  report: { name: string; sizeBytes: number; uploadedAt: string; mime: string } | null;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const [pending, setPending] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadState, uploadAction, uploading] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await uploadReportAction(assessmentId, _prev, formData);
      if (result.ok) {
        toast.success(report ? "Relatório substituído." : "Relatório anexado.");
        router.refresh();
      }
      return result;
    },
    null,
  );

  function go(fn: () => Promise<ActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  }

  const sizeLabel = report ? (report.sizeBytes >= 1024 * 1024 ? `${(report.sizeBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(report.sizeBytes / 1024))} KB`) : "";

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-border p-4" aria-labelledby={`${idPrefix}-report-h`}>
        <h2 id={`${idPrefix}-report-h`} className="font-heading text-base font-medium">
          Relatório de bioimpedância
        </h2>
        {report ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{report.name}</p>
              <p className="text-xs text-muted-foreground">
                {report.mime === "application/pdf" ? "PDF" : "Imagem"} · {sizeLabel} · enviado em {formatDateTime(report.uploadedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={`/dashboard/pacientes/${patientId}/avaliacoes/${assessmentId}/relatorio`} target="_blank" rel="noopener">
                  <Download data-icon="inline-start" />
                  Abrir
                </a>
              </Button>
              {!archived ? (
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setPending("removeReport")}>
                  <Trash2 data-icon="inline-start" />
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum relatório anexado.</p>
        )}
        {!archived ? (
          <form action={uploadAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor={`${idPrefix}-file`}>{report ? "Substituir relatório" : "Anexar relatório"} (PDF, JPG ou PNG, até 10 MB)</Label>
              <Input id={`${idPrefix}-file`} name="report" type="file" accept="application/pdf,image/jpeg,image/png" required />
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
        <p className="text-xs text-muted-foreground">Arquivo privado: só você e o paciente (quando a avaliação estiver visível) acessam, por link temporário.</p>
      </section>

      {!archived ? (
        <section className="flex flex-wrap gap-2" aria-label="Ações da avaliação">
          <Button variant={visibleToPatient ? "outline" : "default"} size="sm" disabled={isPending} onClick={() => go(() => setVisibilityAction(assessmentId, !visibleToPatient), visibleToPatient ? "Avaliação ocultada do paciente." : "Avaliação liberada para o paciente.")}>
            {visibleToPatient ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            {visibleToPatient ? "Ocultar do paciente" : "Liberar para o paciente"}
          </Button>
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setPending("archive")}>
            <Archive data-icon="inline-start" />
            Arquivar
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setPending("delete")}>
              <Trash2 data-icon="inline-start" />
              Excluir
            </Button>
          ) : null}
        </section>
      ) : null}

      <AlertDialog open={pending === "archive"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar esta avaliação?</AlertDialogTitle>
            <AlertDialogDescription>Ela sai do histórico ativo, dos gráficos e do portal do paciente, mas fica guardada com todas as medidas. Não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => archiveAssessmentAction(assessmentId), "Avaliação arquivada.");
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "delete"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta avaliação?</AlertDialogTitle>
            <AlertDialogDescription>Ela nunca foi exibida ao paciente, por isso pode ser excluída de vez (medidas e relatório). Se preferir manter o registro, use &ldquo;Arquivar&rdquo;.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => deleteAssessmentAction(assessmentId), "Avaliação excluída.", () => router.push(`/dashboard/pacientes/${patientId}?tab=avaliacoes`));
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pending === "removeReport"} onOpenChange={(open) => !open && !isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o relatório?</AlertDialogTitle>
            <AlertDialogDescription>O arquivo é apagado do armazenamento e o paciente perde o acesso imediatamente. As medidas da avaliação não mudam.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                go(() => removeReportAction(assessmentId), "Relatório removido.");
              }}
            >
              Remover relatório
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
