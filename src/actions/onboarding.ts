"use server";

import { requireNutritionist } from "@/lib/auth/session";
import { invitePatientSchema } from "@/validators/auth";
import { authErrorMessage } from "@/lib/auth/errors";
import { patientInviteRateLimiter, getClientIp } from "@/lib/auth/rate-limit";
import { invitePatientToPortal } from "@/services/onboarding";
import { isDomainError } from "@/lib/errors/domain";
import { recordAudit } from "@/services/audit";

export type InvitePatientState = { error?: string; success?: string };

/**
 * Núcleo mínimo de onboarding de paciente (prompt Fase 3 §22-26) — convida
 * um paciente por e-mail via Supabase Auth. Desde a Fase 5 a lógica de
 * Auth vive em `src/services/onboarding.ts` (`invitePatientToPortal`),
 * compartilhada com "Novo paciente + convite" e "Enviar convite" no perfil
 * — esta action só valida input, autentica, aplica rate limit e mapeia
 * erros (prompt Fase 5 §46).
 */
export async function invitePatientAction(
  _prevState: InvitePatientState,
  formData: FormData,
): Promise<InvitePatientState> {
  const nutritionist = await requireNutritionist();

  const parsed = invitePatientSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? authErrorMessage("VALIDATION_ERROR") };
  }

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName;

  const ip = await getClientIp();
  const rate = await patientInviteRateLimiter.consume(`${ip}:${nutritionist.id}`);
  if (!rate.success) {
    return { error: authErrorMessage("RATE_LIMITED") };
  }

  try {
    const { patientId } = await invitePatientToPortal({ nutritionistId: nutritionist.id, email, fullName });
    await recordAudit({
      actorId: nutritionist.id,
      action: "PATIENT_INVITED",
      entityType: "patient",
      entityId: patientId,
    });
    return { success: `Convite enviado para ${email}.` };
  } catch (error) {
    if (isDomainError(error)) {
      // Mesmas mensagens da Fase 3 para os dois casos que ela já tratava.
      if (error.code === "PATIENT_ALREADY_LINKED") return { error: authErrorMessage("PATIENT_ALREADY_LINKED") };
      if (error.code === "INVITE_NOT_SENT") return { error: authErrorMessage("INVITE_ALREADY_EXISTS") };
    }
    return { error: authErrorMessage("UNKNOWN") };
  }
}
