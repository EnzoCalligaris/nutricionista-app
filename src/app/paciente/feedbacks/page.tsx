import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackCard } from "@/components/portal/feedback-card";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { listVisibleFeedbacksForPatient } from "@/data/feedbacks";

export const metadata: Metadata = { title: "Feedbacks" };
export const dynamic = "force-dynamic";

/**
 * Feedbacks no portal (prompt Fase 10 §28–§29): só disponibilizados e não
 * arquivados do próprio paciente (patient_id da sessão; RLS + query).
 * Leitura confortável — uma coluna, largura de texto limitada.
 */
export default async function FeedbacksPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const feedbacks = context ? await listVisibleFeedbacksForPatient(context.patientId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Feedbacks</h1>
        <p className="text-sm text-muted-foreground">{feedbacks.length === 0 ? "Retornos do seu nutricionista aparecem aqui." : `${feedbacks.length} feedback(s) do seu nutricionista, do mais recente ao mais antigo.`}</p>
      </div>
      {feedbacks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <MessageSquare className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhum feedback disponível ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Quando o nutricionista disponibilizar um retorno sobre o seu acompanhamento, ele aparece aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid max-w-3xl gap-3" aria-label="Feedbacks recebidos">
          {feedbacks.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
