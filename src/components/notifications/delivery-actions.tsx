"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { retryDeliveryAction, runNotificationCycleAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

/** Reprocessar entrega FAILED (prompt Fase 12 §86): só o dono, só FAILED, nunca duplica SENT — decisão no servidor. */
export function RetryDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      data-testid="retry-delivery"
      onClick={() =>
        startTransition(async () => {
          const result = await retryDeliveryAction(deliveryId);
          if (!result.ok) toast.error(result.error);
          else if (result.status === "SENT") toast.success("Entrega reenviada com sucesso.");
          else toast.warning(`Entrega reprocessada, mas ainda não enviada (status: ${result.status}).`, { description: "Verifique o contato do paciente e a configuração do provedor." });
          router.refresh();
        })
      }
    >
      <RotateCcw data-icon="inline-start" />
      {isPending ? "Enviando..." : "Reenviar"}
    </Button>
  );
}

/** Dispara o mesmo ciclo do cron sob a sessão do nutricionista (útil sem scheduler local). */
export function RunCycleButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      data-testid="run-cycle"
      onClick={() =>
        startTransition(async () => {
          const result = await runNotificationCycleAction();
          if (result.ok) toast.success("Fila processada.", { description: result.summary });
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      <Play data-icon="inline-start" />
      {isPending ? "Processando..." : "Processar fila agora"}
    </Button>
  );
}
