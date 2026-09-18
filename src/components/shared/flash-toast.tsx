"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Toast pós-redirect (prompt Fase 5 §55): uma Server Action que redireciona
 * ao terminar (ex.: criar paciente -> perfil) não tem como devolver estado
 * para o formulário; ela anexa `?toast=<código>` ao destino e este
 * componente, montado na página de destino, mostra a mensagem UMA vez e
 * limpa a URL. O código só é emitido pelo servidor depois da resposta
 * confirmada do backend — o toast nunca antecipa sucesso.
 */
export type FlashToastCode =
  | "patient_created"
  | "patient_created_invited"
  | "patient_created_invite_failed"
  | "patient_updated"
  | "contract_created";

const MESSAGES: Record<FlashToastCode, { type: "success" | "warning"; message: string; description?: string }> = {
  patient_created: { type: "success", message: "Paciente cadastrado com sucesso." },
  patient_created_invited: {
    type: "success",
    message: "Paciente cadastrado com sucesso.",
    description: "Convite para o portal enviado por e-mail.",
  },
  patient_created_invite_failed: {
    type: "warning",
    message: "Paciente cadastrado, mas o convite não foi enviado.",
    description: "Já existe uma conta ou convite pendente para este e-mail.",
  },
  patient_updated: { type: "success", message: "Paciente atualizado." },
  contract_created: { type: "success", message: "Contrato criado." },
};

function isFlashToastCode(value: string | null): value is FlashToastCode {
  return value !== null && value in MESSAGES;
}

export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const shown = useRef<string | null>(null);

  const code = searchParams.get("toast");

  useEffect(() => {
    if (!isFlashToastCode(code) || shown.current === code) return;
    shown.current = code;

    const entry = MESSAGES[code];
    if (entry.type === "success") toast.success(entry.message, { description: entry.description });
    else toast.warning(entry.message, { description: entry.description });

    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [code, pathname, router, searchParams]);

  return null;
}
