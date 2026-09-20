import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PhotoCaptureForm } from "@/components/meals/photo-capture-form";
import { MealSteps } from "@/components/meals/meal-shared";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { getMealAiConsent } from "@/services/food-analysis/service";
import { instantToDateISO, instantToTime } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { MEAL_TIME_FUTURE_TOLERANCE_MS } from "@/domain/food-analysis/status";

export const metadata: Metadata = { title: "Nova refeição" };
export const dynamic = "force-dynamic";

function localDateTime(instant: Date): string {
  return `${instantToDateISO(instant, DEFAULT_TIME_ZONE)}T${instantToTime(instant, DEFAULT_TIME_ZONE)}`;
}

/** Etapa 1 do fluxo (prompt Fase 11 §8–§10/§62): exige consentimento ativo — sem ele, vai para o texto. */
export default async function NovaRefeicaoPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) redirect("/paciente");
  const consent = await getMealAiConsent(context.patientId);
  if (!consent) redirect("/paciente/refeicoes/consentimento?next=nova");
  const now = new Date();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/paciente/refeicoes", label: "Refeições" }, { label: "Nova refeição" }]} />
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium">Nova refeição</h1>
        <MealSteps current={1} />
      </div>
      <PhotoCaptureForm defaultMealAt={localDateTime(now)} maxMealAt={localDateTime(new Date(now.getTime() + MEAL_TIME_FUTURE_TOLERANCE_MS))} />
    </div>
  );
}
