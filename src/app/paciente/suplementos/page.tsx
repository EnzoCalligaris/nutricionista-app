import type { Metadata } from "next";
import { Pill } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SupplementCard } from "@/components/portal/supplement-card";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { listActiveSupplementsForPatient } from "@/data/supplements";

export const metadata: Metadata = { title: "Suplementos" };
export const dynamic = "force-dynamic";

/**
 * Suplementos no portal (prompt Fase 10 §15–§17): só recomendações ATIVAS
 * do próprio paciente (patient_id da sessão; RLS + query). Cards,
 * mobile-first. Sem sugerir compra.
 */
export default async function SuplementosPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const supplements = context ? await listActiveSupplementsForPatient(context.patientId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Suplementos</h1>
        <p className="text-sm text-muted-foreground">Recomendações registradas pelo seu nutricionista.</p>
      </div>
      {supplements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Pill className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Você não possui recomendações de suplementos no momento.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Quando o nutricionista registrar uma recomendação, ela aparece aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Recomendações ativas">
          {supplements.map((item) => (
            <SupplementCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Siga sempre a orientação do nutricionista. Em caso de dúvida, fale com ele antes de alterar qualquer uso.</p>
    </div>
  );
}
