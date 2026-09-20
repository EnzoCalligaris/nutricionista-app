import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MealResultView } from "@/components/meals/meal-result-view";
import { EstimateDisclaimer, MealStatusBadge } from "@/components/meals/meal-shared";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getFoodAnalysisById } from "@/data/food-analyses";
import { getFoodAnalysisConfigStatus } from "@/services/food-analysis";
import { analysisUiStatus } from "@/domain/food-analysis/status";
import { analysisIdSchema } from "@/validators/food-analysis";
import { patientIdSchema } from "@/validators/patients";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Refeição do paciente" };
export const dynamic = "force-dynamic";

/**
 * Detalhe da refeição para o nutricionista (prompt Fase 11 §43/§45/§47):
 * foto, versão confirmada, o que a IA estimou e o que o paciente alterou;
 * CTA para feedback manual e link para o cardápio. Sem avaliação
 * automática. Ownership pela rota; refeição alheia/arquivada = 404.
 */
export default async function RefeicaoDoPacientePage({ params }: PageProps<"/dashboard/pacientes/[id]/refeicoes/[analysisId]">) {
  const nutritionist = await requireNutritionist();
  const { id, analysisId } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  const parsedAnalysis = analysisIdSchema.safeParse(analysisId);
  if (!parsedId.success || !parsedAnalysis.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const analysis = await getFoodAnalysisById(parsedAnalysis.data);
  if (!analysis || analysis.patientId !== patient.id || analysis.archivedAt) notFound();
  const status = analysisUiStatus(analysis);
  const config = getFoodAnalysisConfigStatus();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=refeicoes`, label: patient.full_name },
          { label: `Refeição de ${formatDateTime(analysis.mealAt)}` },
        ]}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium">Refeição de {formatDateTime(analysis.mealAt)}</h1>
            <MealStatusBadge item={analysis} />
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.full_name}
            {analysis.confirmedAt ? ` · confirmada pelo paciente em ${formatDateTime(analysis.confirmedAt)}` : " · ainda não confirmada pelo paciente"}
            {analysis.provider ? ` · ${analysis.provider}/${analysis.model}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/dashboard/pacientes/${patient.id}/feedbacks/novo`}>
              <MessageSquare data-icon="inline-start" />
              Escrever feedback
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/pacientes/${patient.id}?tab=cardapio`}>
              <UtensilsCrossed data-icon="inline-start" />
              Abrir cardápio
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <figure className="space-y-2">
          <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração via route handler */}
            <img src={`/dashboard/pacientes/${patient.id}/refeicoes/${analysis.id}/foto`} alt={`Foto da refeição de ${patient.full_name}`} className="max-h-[50vh] w-full object-contain lg:max-h-none" />
          </div>
          <figcaption className="text-xs text-muted-foreground">Foto privada do paciente.</figcaption>
        </figure>
        <div className="min-w-0 space-y-6">
          <EstimateDisclaimer simulated={config.simulated} />
          {status === "REVIEW_REQUIRED" ? <p className="text-sm text-muted-foreground">O paciente ainda não revisou esta estimativa — os valores abaixo são os da IA, sem confirmação.</p> : null}
          <MealResultView original={analysis.original} confirmed={analysis.confirmed} viewer="nutritionist" />
          <p className="text-xs text-muted-foreground">Registro informativo: a análise não altera o cardápio, não gera nota nem compara com metas.</p>
        </div>
      </div>
    </div>
  );
}
