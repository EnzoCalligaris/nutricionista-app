"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { requestAppointmentConfirmationAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

/** Nutricionista pede confirmação de presença (evento APPOINTMENT_CONFIRMATION_REQUEST) — só consulta futura SCHEDULED; um pedido por dia. */
export function RequestConfirmationButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      data-testid="request-confirmation"
      onClick={() =>
        startTransition(async () => {
          const result = await requestAppointmentConfirmationAction(appointmentId);
          if (result.ok) toast.success(result.queued ? "Pedido de confirmação enviado à fila de notificações." : "Já existe um pedido de confirmação de hoje para esta consulta.");
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      <BellRing data-icon="inline-start" />
      {isPending ? "Enviando..." : "Pedir confirmação"}
    </Button>
  );
}
