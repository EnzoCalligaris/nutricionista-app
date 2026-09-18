"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import { sendPortalInviteAction } from "@/actions/patients";
import { Button } from "@/components/ui/button";

/** "Enviar convite" no perfil de paciente sem conta (prompt Fase 5 §13/§14). */
export function SendInviteButton({ patientId, disabledReason }: { patientId: string; disabledReason?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending || Boolean(disabledReason)}
      title={disabledReason}
      onClick={() =>
        startTransition(async () => {
          const result = await sendPortalInviteAction(patientId);
          if (result.ok) {
            toast.success("Convite enviado por e-mail.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <MailPlus data-icon="inline-start" />
      {isPending ? "Enviando..." : "Enviar convite"}
    </Button>
  );
}
