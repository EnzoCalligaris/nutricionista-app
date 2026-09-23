"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, QrCode } from "lucide-react";
import { toast } from "sonner";
import { cancelChargeAsNutritionistAction, createChargeForInstallmentAction } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { ChargeStatusBadge } from "@/components/payments/charge-badges";
import type { ChargeStatus } from "@/domain/payments/charges";

/**
 * Cobrança online a partir do financeiro do paciente (prompt Fase 13 §61):
 * o nutricionista gera o Pix da parcela (o valor vem do banco) ou cancela a
 * cobrança aberta. Registrar pagamento manual continua existindo ao lado —
 * são caminhos diferentes para o mesmo saldo.
 */
export function InstallmentChargeActions({
  installmentId,
  activeCharge,
  disabled,
}: {
  installmentId: string;
  activeCharge: { chargeId: string; status: ChargeStatus } | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (activeCharge) {
    return (
      <span className="inline-flex flex-nowrap items-center gap-1.5">
        <ChargeStatusBadge status={activeCharge.status} />
        <Button
          size="xs"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={isPending}
          data-testid="cancel-charge"
          onClick={() =>
            startTransition(async () => {
              const result = await cancelChargeAsNutritionistAction(activeCharge.chargeId);
              if (result.ok) toast.success("Cobrança cancelada.");
              else toast.error(result.error);
              router.refresh();
            })
          }
        >
          <Ban data-icon="inline-start" className="xl:hidden" />
          <span className="sr-only xl:not-sr-only">Cancelar cobrança</span>
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="xs"
      variant="outline"
      disabled={disabled || isPending}
      data-testid="create-charge"
      onClick={() =>
        startTransition(async () => {
          const result = await createChargeForInstallmentAction(installmentId, "PIX");
          if (result.ok) toast.success("Cobrança Pix gerada.", { description: "O paciente já vê a cobrança no portal." });
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      <QrCode data-icon="inline-start" className="xl:hidden" />
      <span className="sr-only xl:not-sr-only">{isPending ? "Gerando..." : "Gerar cobrança Pix"}</span>
    </Button>
  );
}
