import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { AnalyzePanel } from "@/components/meals/analyze-panel";
import { MealActions } from "@/components/meals/meal-actions";
import { MealResultView } from "@/components/meals/meal-result-view";
import { ReviewForm } from "@/components/meals/review-form";
import { EstimateDisclaimer, MealStatusBadge, MealSteps } from "@/components/meals/meal-shared";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { getFoodAnalysisById } from "@/data/food-analyses";
import { getFoodAnalysisConfigStatus } from "@/services/food-analysis";
import { analysisUiStatus, canArchive, canEditConfirmed, MEAL_TIME_FUTURE_TOLERANCE_MS } from "@/domain/food-analysis/status";
import { analysisIdSchema } from "@/validators/food-analysis";
import { instantToDateISO, instantToTime } from "@/lib/timezone";
import { DEFAULT_TIME_ZONE } from "@/config/site";
import { formatDateTime } from "@/lib/dates";
import { domainErrorMessage } from "@/lib/errors/domain";

export const metadata: Metadata = { title: "Refeição" };
export const dynamic = "force-dynamic";

function localDateTime(instant: Date): string {
  return `${instantToDateISO(instant, DEFAULT_TIME_ZONE)}T${instantToTime(instant, DEFAULT_TIME_ZONE)}`;
}

/**
 * Página da refeição (prompt Fase 11 §23/§32–§41/§62): uma tela para todos
 * os estados — foto enviada → analisar → analisando → revisar → confirmada
 * (leitura, corrigir, ajustar data, arquivar). patient_id vem da sessão;
 * refeição alheia/arquivada = 404.
 */
export default async function RefeicaoPage({ params, searchParams }: PageProps<"/paciente/refeicoes/[analysisId]">) {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) redirect("/paciente");
  const { analysisId } = await params;
  const parsed = analysisIdSchema.safeParse(analysisId);
  if (!parsed.success) notFound();
  const analysis = await getFoodAnalysisById(parsed.data);
  if (!analysis || analysis.patientId !== context.patientId || analysis.archivedAt) notFound();
  const search = await searchParams;
  const status = analysisUiStatus(analysis);
  const editing = search.modo === "corrigir" && canEditConfirmed(analysis) && analysis.original;
  const config = getFoodAnalysisConfigStatus();
  const step = status === "CONFIRMED" ? 3 : status === "REVIEW_REQUIRED" ? 3 : 2;
  const now = new Date();

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs items={[{ href: "/paciente/refeicoes", label: "Refeições" }, { label: formatDateTime(analysis.mealAt) }]} />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium">Refeição de {formatDateTime(analysis.mealAt)}</h1>
          <MealStatusBadge item={analysis} />
        </div>
        {status !== "CONFIRMED" ? <MealSteps current={step} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <figure className="space-y-2">
          <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração via route handler */}
            <img src={`/paciente/refeicoes/${analysis.id}/foto`} alt="Foto da refeição enviada" className="max-h-[50vh] w-full object-contain lg:max-h-none" />
          </div>
          <figcaption className="text-xs text-muted-foreground">Foto privada: só você e o seu nutricionista têm acesso.</figcaption>
        </figure>

        <div className="min-w-0 space-y-6">
          {status === "UPLOADED" || status === "PROCESSING" || status === "FAILED" ? (
            <>
              <AnalyzePanel analysisId={analysis.id} state={status} failureMessage={status === "FAILED" ? domainErrorMessage(analysis.failureCode === "PROVIDER_UNAVAILABLE" ? "FOOD_ANALYSIS_PROVIDER_UNAVAILABLE" : "FOOD_ANALYSIS_FAILED") : null} available={config.available} />
              <EstimateDisclaimer simulated={config.simulated} />
            </>
          ) : null}

          {status === "REVIEW_REQUIRED" && analysis.original ? (
            <section aria-labelledby="revisao-h" className="space-y-4">
              <div>
                <h2 id="revisao-h" className="font-heading text-lg font-medium">
                  Revise sua refeição
                </h2>
                <p className="text-sm text-muted-foreground">Corrija alimentos, quantidades e preparo; adicione o que a foto não mostra. Só depois confirme.</p>
              </div>
              <EstimateDisclaimer simulated={config.simulated} />
              {analysis.original.items.length === 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
                  A IA não identificou alimentos com clareza nesta foto. Você pode adicionar os itens manualmente abaixo ou arquivar e enviar outra foto.
                </p>
              ) : null}
              {analysis.original.ambiguities.length > 0 ? (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">A IA sinalizou:</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {analysis.original.ambiguities.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ReviewForm analysisId={analysis.id} source={analysis.original} mode="confirm" cancelHref="/paciente/refeicoes" simulated={config.simulated} />
              <MealActions analysisId={analysis.id} canEdit={false} canArchive={canArchive(analysis)} mealAtLocal={localDateTime(new Date(analysis.mealAt))} maxMealAt={localDateTime(new Date(now.getTime() + MEAL_TIME_FUTURE_TOLERANCE_MS))} />
            </section>
          ) : null}

          {status === "CONFIRMED" && analysis.confirmed && analysis.original ? (
            editing ? (
              <section aria-labelledby="corrigir-h" className="space-y-4">
                <div>
                  <h2 id="corrigir-h" className="font-heading text-lg font-medium">
                    Corrigir refeição
                  </h2>
                  <p className="text-sm text-muted-foreground">A correção substitui a versão confirmada; a estimativa original da IA continua guardada.</p>
                </div>
                <EstimateDisclaimer simulated={config.simulated} />
                <ReviewForm analysisId={analysis.id} source={analysis.confirmed} mode="update" cancelHref={`/paciente/refeicoes/${analysis.id}`} simulated={config.simulated} />
              </section>
            ) : (
              <>
                <EstimateDisclaimer simulated={config.simulated} />
                <MealResultView original={analysis.original} confirmed={analysis.confirmed} viewer="patient" />
                <p className="text-xs text-muted-foreground">Confirmada em {formatDateTime(analysis.confirmedAt)}{analysis.updatedAt !== analysis.confirmedAt ? ` · última correção em ${formatDateTime(analysis.updatedAt)}` : ""}.</p>
                <MealActions analysisId={analysis.id} canEdit={canEditConfirmed(analysis)} canArchive={canArchive(analysis)} mealAtLocal={localDateTime(new Date(analysis.mealAt))} maxMealAt={localDateTime(new Date(now.getTime() + MEAL_TIME_FUTURE_TOLERANCE_MS))} />
              </>
            )
          ) : null}

          {status === "UPLOADED" || status === "FAILED" ? (
            <MealActions analysisId={analysis.id} canEdit={false} canArchive={canArchive(analysis)} mealAtLocal={localDateTime(new Date(analysis.mealAt))} maxMealAt={localDateTime(new Date(now.getTime() + MEAL_TIME_FUTURE_TOLERANCE_MS))} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
