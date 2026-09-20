"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { acceptMealAiConsentAction, revokeMealAiConsentAction } from "@/actions/food-analysis";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEAL_PHOTO_AI_CONSENT_TEXT, MEAL_PHOTO_AI_CONSENT_VERSION } from "@/domain/food-analysis/status";
import { formatDateTime } from "@/lib/dates";

/**
 * Consentimento para a análise por IA (prompt Fase 11 §19–§22): texto
 * versionado, aceite explícito persistido no servidor (nunca só um checkbox
 * no browser) e revogação para análises futuras.
 */
export function ConsentCard({ acceptedAt, nextHref }: { acceptedAt: string | null; nextHref?: string }) {
  const router = useRouter();
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptMealAiConsentAction();
      if (result.ok) {
        toast.success("Consentimento registrado.");
        if (nextHref) router.push(nextHref);
        else router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeMealAiConsentAction();
      if (result.ok) {
        toast.success("Consentimento revogado para novas análises.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setConfirmRevoke(false);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          Análise de fotos por inteligência artificial
        </CardTitle>
        <CardDescription>{acceptedAt ? `Consentimento aceito em ${formatDateTime(acceptedAt)} (versão ${MEAL_PHOTO_AI_CONSENT_VERSION}).` : "Antes da primeira análise, leia e aceite os pontos abaixo."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {MEAL_PHOTO_AI_CONSENT_TEXT.map((paragraph) => (
            <li key={paragraph}>{paragraph}</li>
          ))}
        </ul>
        {acceptedAt ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Você pode revogar a qualquer momento: novas análises ficam bloqueadas; as refeições já analisadas permanecem no seu histórico.</p>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setConfirmRevoke(true)}>
              Revogar consentimento
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor={`${id}-ok`} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input id={`${id}-ok`} type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
              <span>Li e aceito que as fotos das minhas refeições sejam analisadas por IA, entendendo que os valores são estimativas.</span>
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" onClick={() => router.push("/paciente/refeicoes")} disabled={isPending}>
                Agora não
              </Button>
              <Button type="button" disabled={!checked || isPending} onClick={accept}>
                {isPending ? "Registrando..." : "Aceitar e continuar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmRevoke} onOpenChange={(open) => !open && !isPending && setConfirmRevoke(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar o consentimento?</AlertDialogTitle>
            <AlertDialogDescription>Você não conseguirá analisar novas fotos até aceitar de novo. As refeições já analisadas continuam no seu histórico — nada é apagado automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                revoke();
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
