import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MaterialCard } from "@/components/portal/material-card";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { listVisibleMaterialsForPatient } from "@/data/materials";

export const metadata: Metadata = { title: "Materiais" };
export const dynamic = "force-dynamic";

/**
 * Materiais no portal (prompt Fase 10 §49–§50): só materiais atribuídos ao
 * próprio paciente, não revogados e não arquivados (patient_id da sessão;
 * RLS + query). Cards com abrir/baixar conforme o tipo.
 */
export default async function PatientMateriaisPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const materials = context ? await listVisibleMaterialsForPatient(context.patientId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Materiais</h1>
        <p className="text-sm text-muted-foreground">Guias, listas e arquivos disponibilizados pelo seu nutricionista.</p>
      </div>
      {materials.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FolderOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Você ainda não possui materiais disponíveis.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Quando o nutricionista disponibilizar um material para você, ele aparece aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Materiais disponíveis">
          {materials.map((item) => (
            <MaterialCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Os arquivos são privados: o link de download é temporário e só funciona enquanto o material estiver disponível para você.</p>
    </div>
  );
}
