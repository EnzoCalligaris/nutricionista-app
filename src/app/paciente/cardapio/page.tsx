import type { Metadata } from "next";
import { UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MealPlanView } from "@/components/meal-plans/meal-plan-view";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { getPublishedMealPlan } from "@/data/meal-plans";
import { defaultDay } from "@/domain/meal-plans/structure";
import { instantToDateISO, weekdayOfDate } from "@/lib/timezone";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Meu Cardápio" };
export const dynamic = "force-dynamic";

/**
 * Cardápio do paciente (prompt Fase 8 §27–§32): só a versão PUBLICADA do
 * plano ativo (RLS + query); rascunhos nunca chegam aqui. Abre no dia de
 * hoje (fuso do nutricionista), mobile-first.
 */
export default async function MeuCardapioPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);

  if (!context) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-medium">Meu Cardápio</h1>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Sua conta ainda não está vinculada a um cadastro de paciente. Fale com o nutricionista.</CardContent>
        </Card>
      </div>
    );
  }

  const version = await getPublishedMealPlan(context.patientId);
  const today = instantToDateISO(new Date(), context.settings.timeZone);
  const initialDay = version ? defaultDay(version.days, weekdayOfDate(today)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Meu Cardápio</h1>
        {version ? (
          <p className="text-sm text-muted-foreground">
            {version.plan.title}
            {version.plan.startDate ? ` · desde ${formatCalendarDate(version.plan.startDate)}` : ""}
            {version.publishedAt ? ` · atualizado em ${formatDateTime(version.publishedAt)}` : ""}
          </p>
        ) : null}
      </div>

      {!version ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Seu plano alimentar ainda não foi publicado.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Assim que o nutricionista publicar, ele aparece aqui com as refeições de cada dia.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {version.plan.notes || version.notes ? (
            <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              {version.plan.notes ? <p>{version.plan.notes}</p> : null}
              {version.notes ? <p className="text-muted-foreground">{version.notes}</p> : null}
            </div>
          ) : null}
          <MealPlanView days={version.days} defaultDayId={initialDay?.id ?? null} />
          <p className="text-xs text-muted-foreground">Dúvidas sobre quantidades ou substituições? Fale com o nutricionista na próxima consulta.</p>
        </>
      )}
    </div>
  );
}
