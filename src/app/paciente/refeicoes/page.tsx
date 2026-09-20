import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { MealCard } from "@/components/meals/meal-card";
import { EstimateDisclaimer } from "@/components/meals/meal-shared";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { listPatientFoodAnalyses } from "@/data/food-analyses";
import { getMealAiConsent } from "@/services/food-analysis/service";
import { getFoodAnalysisConfigStatus } from "@/services/food-analysis";

export const metadata: Metadata = { title: "Refeições" };
export const dynamic = "force-dynamic";

/**
 * Histórico de refeições do paciente (prompt Fase 11 §38/§67–§68): foto,
 * data/hora, total estimado confirmado e status, mais recente primeiro;
 * CTA para registrar; estado do consentimento e da configuração da IA.
 */
export default async function RefeicoesPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const [meals, consent] = context ? await Promise.all([listPatientFoodAnalyses(context.patientId), getMealAiConsent(context.patientId)]) : [[], null];
  const config = getFoodAnalysisConfigStatus();

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium">Refeições</h1>
          <p className="text-sm text-muted-foreground">Fotografe a refeição, receba uma estimativa por IA e revise antes de confirmar.</p>
        </div>
        {context ? (
          <Button asChild>
            <Link href="/paciente/refeicoes/nova">
              <Camera data-icon="inline-start" />
              Registrar refeição
            </Link>
          </Button>
        ) : null}
      </div>

      {meals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Camera className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Você ainda não registrou nenhuma refeição.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Tire uma foto do prato pelo celular: a IA estima os alimentos e você confirma o que comeu.</p>
            {context ? (
              <Button asChild>
                <Link href="/paciente/refeicoes/nova">
                  <Camera data-icon="inline-start" />
                  Registrar primeira refeição
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <EstimateDisclaimer simulated={config.simulated} />
          <ul className="grid gap-2 lg:grid-cols-2" aria-label="Refeições registradas">
            {meals.map((meal) => (
              <MealCard key={meal.id} item={meal} href={`/paciente/refeicoes/${meal.id}`} photoHref={`/paciente/refeicoes/${meal.id}/foto`} />
            ))}
          </ul>
        </>
      )}

      <section aria-labelledby="privacidade-h" className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="privacidade-h" className="font-medium">
              Privacidade e consentimento
            </h2>
            <p className="text-xs text-muted-foreground">
              As fotos ficam disponíveis apenas para você e para o seu nutricionista responsável.{" "}
              {consent ? "Consentimento para a análise por IA: aceito." : "Você ainda não aceitou o consentimento para a análise por IA."}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/paciente/refeicoes/consentimento">{consent ? "Ver ou revogar" : "Ler e aceitar"}</Link>
        </Button>
      </section>
    </div>
  );
}
