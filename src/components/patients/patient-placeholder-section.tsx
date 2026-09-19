import { Card, CardContent } from "@/components/ui/card";
import type { PatientModuleCounts } from "@/data/patients";
import type { PatientSectionId } from "@/components/patients/patient-section-nav";

function summaryFor(section: PatientSectionId, counts: PatientModuleCounts): { count: number; noun: [string, string]; phase: string } | null {
  switch (section) {
    case "comentarios":
      return { count: counts.appointmentNotes, noun: ["comentário", "comentários"], phase: "Fase 6" };
    case "feedbacks":
      return { count: counts.feedbacks, noun: ["feedback", "feedbacks"], phase: "Fase 10" };
    case "materiais":
      return { count: counts.materials, noun: ["material atribuído", "materiais atribuídos"], phase: "Fase 10" };
    default:
      return null;
  }
}

/**
 * Seções que pertencem a fases futuras (prompt Fase 5 §22): mostram um
 * resumo REAL simples (contagem do banco) quando existe dado, e o estado
 * "Disponível em uma próxima etapa." — sem implementar o módulo.
 */
export function PatientPlaceholderSection({ section, counts }: { section: PatientSectionId; counts: PatientModuleCounts }) {
  const summary = summaryFor(section, counts);
  if (!summary) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-1 py-8 text-center">
        <p className="font-medium">
          {summary.count === 0
            ? `Nenhum registro ainda.`
            : `${summary.count} ${summary.count === 1 ? summary.noun[0] : summary.noun[1]}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          Disponível em uma próxima etapa ({summary.phase}).
        </p>
      </CardContent>
    </Card>
  );
}
