"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmPresenceAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

/** Confirmar presença pelo portal (prompt Fase 12 §48–§49): SCHEDULED → CONFIRMED, só o próprio paciente, só consulta futura. */
export function ConfirmPresenceButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmPresenceAction(appointmentId);
          if (result.ok) {
            toast.success(result.outcome === "ALREADY_CONFIRMED" ? "Esta consulta já estava confirmada." : "Presença confirmada.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <CalendarCheck data-icon="inline-start" />
      {isPending ? "Confirmando..." : "Confirmar presença"}
    </Button>
  );
}
