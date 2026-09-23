"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  | "contract_created"
  | "appointment_created"
  | "appointment_updated"
  | "appointment_rescheduled"
  | "blocked_time_created"
  | "settings_saved"
  | "booking_created"
  | "booking_rescheduled"
  | "transaction_created"
  | "transaction_updated"
  | "payment_recorded"
  | "meal_plan_created"
  | "meal_plan_updated"
  | "meal_plan_version_created"
  | "meal_plan_published"
  | "meal_plan_archived"
  | "assessment_created"
  | "assessment_updated"
  | "supplement_created"
  | "supplement_updated"
  | "feedback_saved"
  | "feedback_published"
  | "feedback_updated"
  | "material_created"
  | "material_updated"
  | "meal_photo_reused"
  | "meal_confirmed"
  | "meal_updated"
  | "notification_settings_saved"
  | "notification_preferences_saved"
  | "presence_confirmed"
  | "presence_already_confirmed";

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
  appointment_created: { type: "success", message: "Consulta agendada." },
  appointment_updated: { type: "success", message: "Consulta atualizada." },
  appointment_rescheduled: { type: "success", message: "Consulta reagendada.", description: "A consulta original foi mantida no histórico como reagendada." },
  blocked_time_created: { type: "success", message: "Bloqueio criado." },
  settings_saved: { type: "success", message: "Configurações da agenda salvas." },
  booking_created: { type: "success", message: "Consulta agendada com sucesso." },
  booking_rescheduled: { type: "success", message: "Consulta reagendada com sucesso." },
  transaction_created: { type: "success", message: "Lançamento criado." },
  transaction_updated: { type: "success", message: "Lançamento atualizado." },
  payment_recorded: { type: "success", message: "Pagamento registrado." },
  meal_plan_created: { type: "success", message: "Plano criado.", description: "Adicione os dias, as refeições e os alimentos; publique quando estiver pronto." },
  meal_plan_updated: { type: "success", message: "Plano atualizado." },
  meal_plan_version_created: { type: "success", message: "Nova versão criada.", description: "A versão publicada continua visível para o paciente até você publicar esta." },
  meal_plan_published: { type: "success", message: "Plano publicado.", description: "O paciente já vê esta versão no portal." },
  meal_plan_archived: { type: "success", message: "Plano arquivado." },
  assessment_created: { type: "success", message: "Avaliação registrada.", description: "Anexe o relatório e libere para o paciente quando quiser." },
  assessment_updated: { type: "success", message: "Avaliação atualizada." },
  supplement_created: { type: "success", message: "Recomendação criada.", description: "O paciente já vê a recomendação no portal." },
  supplement_updated: { type: "success", message: "Recomendação atualizada." },
  feedback_saved: { type: "success", message: "Feedback salvo como rascunho.", description: "O paciente só verá quando você disponibilizar." },
  feedback_published: { type: "success", message: "Feedback disponibilizado.", description: "O paciente já vê o feedback no portal." },
  feedback_updated: { type: "success", message: "Feedback atualizado." },
  material_created: { type: "success", message: "Material criado.", description: "Atribua o material aos pacientes que devem recebê-lo." },
  material_updated: { type: "success", message: "Material atualizado." },
  meal_photo_reused: { type: "warning", message: "Esta foto já tinha sido enviada.", description: "Abrimos a refeição existente em vez de criar outra." },
  meal_confirmed: { type: "success", message: "Refeição confirmada.", description: "Os valores são estimativas revisadas por você." },
  meal_updated: { type: "success", message: "Refeição atualizada." },
  notification_settings_saved: { type: "success", message: "Preferências de notificação salvas." },
  notification_preferences_saved: { type: "success", message: "Preferências de aviso salvas." },
  presence_confirmed: { type: "success", message: "Presença confirmada.", description: "Obrigado! Sua consulta está confirmada." },
  presence_already_confirmed: { type: "success", message: "Esta consulta já estava confirmada." },
};

function isFlashToastCode(value: string | null): value is FlashToastCode {
  return value !== null && value in MESSAGES;
}

export function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const shown = useRef<string | null>(null);

  const code = searchParams.get("toast");

  useEffect(() => {
    if (!isFlashToastCode(code) || shown.current === code) return;
    shown.current = code;

    const entry = MESSAGES[code];
    if (entry.type === "success") toast.success(entry.message, { description: entry.description });
    else toast.warning(entry.message, { description: entry.description });

    // Limpa `?toast=` sem navegar: `router.replace` disparava uma navegação do
    // App Router que podia descartar uma Server Action enviada no mesmo
    // instante (ex.: anexar relatório logo após chegar pelo redirect — Fase 9).
    // O App Router integra `history.replaceState` com `useSearchParams`.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    const query = next.toString();
    window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
  }, [code, pathname, searchParams]);

  return null;
}
