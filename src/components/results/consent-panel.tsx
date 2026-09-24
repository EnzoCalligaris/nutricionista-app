"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { revokeConsentFormAction, type ResultFormState } from "@/actions/results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NAME_DISPLAY_LABELS } from "@/domain/results/display";
import type { DashboardResult } from "@/data/results";

const initialState: ResultFormState = {};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Estado do consentimento e revogação (prompt Fase 14 §29/§31). Revogar tira
 * o resultado do site imediatamente — a policy pública confere o
 * consentimento, então não depende de editar o resultado.
 */
export function ConsentPanel({ result }: { result: DashboardResult }) {
  const consent = result.consent;
  const idPrefix = useId();
  const action = revokeConsentFormAction.bind(null, result.id, consent?.id ?? "");
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (!consent) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          Nenhum consentimento de uso de imagem registrado. Sem ele o resultado não pode ser publicado.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/resultados/${result.id}/consentimento`}>Registrar consentimento</Link>
        </Button>
      </div>
    );
  }

  const revoked = consent.revokedAt !== null;

  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Situação</dt>
          <dd className="flex items-center gap-1.5">
            {revoked ? (
              <>
                <ShieldX className="size-4 text-destructive" aria-hidden="true" />
                Revogado em {formatDate(consent.revokedAt!)}
              </>
            ) : (
              <>
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Válido
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Autorizado em</dt>
          <dd>{formatDate(consent.grantedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Identificação autorizada</dt>
          <dd>{NAME_DISPLAY_LABELS[consent.nameDisplayMode]}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Versão do termo</dt>
          <dd>
            <code>{consent.consentVersion}</code>
          </dd>
        </div>
        {consent.evidenceReference ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registro</dt>
            <dd>{consent.evidenceReference}</dd>
          </div>
        ) : null}
        {consent.revokeReason ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Motivo da revogação</dt>
            <dd>{consent.revokeReason}</dd>
          </div>
        ) : null}
      </dl>

      {result.displayName ? (
        <p className="text-sm text-muted-foreground">
          Nome exibido no site: <strong className="text-foreground">{result.displayName}</strong>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum nome é exibido no site (anônimo).</p>
      )}

      {revoked ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Com o consentimento revogado, este resultado não aparece no site — mesmo que continue marcado como
          publicado. O histórico é preservado de propósito.
        </p>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Revogar consentimento
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar o consentimento de imagem?</AlertDialogTitle>
              <AlertDialogDescription>
                O resultado sai do site imediatamente. A revogação é definitiva: para voltar a publicar, é preciso
                registrar uma nova autorização do paciente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form action={formAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-reason`}>Motivo (opcional)</Label>
                <Input id={`${idPrefix}-reason`} name="reason" maxLength={300} placeholder="Ex.: pedido do paciente em 00/00/0000" />
              </div>
              {state.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {isPending ? "Revogando..." : "Revogar"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
