import Link from "next/link";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MealCard } from "@/components/meals/meal-card";
import { EstimateDisclaimer } from "@/components/meals/meal-shared";
import { analysisUiStatus } from "@/domain/food-analysis/status";
import type { FoodAnalysisDetail } from "@/data/food-analyses";

/**
 * Aba Refeições do perfil (prompt Fase 11 §42–§44): análises CONFIRMADAS
 * pelo paciente (acompanhamento); as em revisão aparecem à parte, só como
 * informação. Sem nota, score, aderência ou semáforo.
 */
export function PatientMealsSection({ patientId, analyses, simulated }: { patientId: string; analyses: FoodAnalysisDetail[]; simulated: boolean }) {
  const confirmed = analyses.filter((item) => analysisUiStatus(item) === "CONFIRMED");
  const pending = analyses.filter((item) => analysisUiStatus(item) === "REVIEW_REQUIRED");
  const href = (item: FoodAnalysisDetail) => `/dashboard/pacientes/${patientId}/refeicoes/${item.id}`;
  const photo = (item: FoodAnalysisDetail) => `/dashboard/pacientes/${patientId}/refeicoes/${item.id}/foto`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-medium">Refeições</h2>
        <p className="text-sm text-muted-foreground">{confirmed.length === 0 ? "Nenhuma refeição confirmada pelo paciente." : `${confirmed.length} refeição(ões) confirmada(s) pelo paciente — estimativas por foto, revisadas por ele.`}</p>
      </div>

      {confirmed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Camera className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma refeição registrada.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Quando o paciente fotografar uma refeição e confirmar a estimativa no portal, ela aparece aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <EstimateDisclaimer simulated={simulated} />
          <ul className="grid gap-2 xl:grid-cols-2" aria-label="Refeições confirmadas">
            {confirmed.map((item) => (
              <MealCard key={item.id} item={item} href={href(item)} photoHref={photo(item)} />
            ))}
          </ul>
        </>
      )}

      {pending.length > 0 ? (
        <section aria-labelledby="em-revisao-h" className="space-y-2">
          <h3 id="em-revisao-h" className="font-heading text-base font-medium">
            Aguardando revisão do paciente ({pending.length})
          </h3>
          <p className="text-xs text-muted-foreground">Estimativas ainda não confirmadas — não fazem parte do acompanhamento.</p>
          <ul className="grid gap-2 xl:grid-cols-2" aria-label="Refeições em revisão">
            {pending.map((item) => (
              <MealCard key={item.id} item={item} href={href(item)} photoHref={photo(item)} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Use as refeições como contexto para um retorno:</span>
        <Button asChild size="xs" variant="outline">
          <Link href={`/dashboard/pacientes/${patientId}/feedbacks/novo`}>Escrever feedback</Link>
        </Button>
      </div>
    </div>
  );
}
