import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SupplementForm } from "@/components/supplements/supplement-form";
import { SupplementStatusBadge } from "@/components/supplements/supplement-badges";
import { updateSupplementAction } from "@/actions/supplements";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getSupplementById } from "@/data/supplements";
import { canEditSupplement } from "@/domain/patient-content/supplements";
import { patientIdSchema } from "@/validators/patients";
import { supplementIdSchema } from "@/validators/patient-content";

export const metadata: Metadata = { title: "Editar recomendação" };
export const dynamic = "force-dynamic";

/** Edição administrativa controlada (prompt Fase 10 §13): ownership pela rota; arquivada é só leitura (404 na edição). */
export default async function EditarSuplementoPage({ params }: PageProps<"/dashboard/pacientes/[id]/suplementos/[supplementId]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id, supplementId } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  const parsedSupplement = supplementIdSchema.safeParse(supplementId);
  if (!parsedId.success || !parsedSupplement.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const supplement = await getSupplementById(parsedSupplement.data);
  if (!supplement || supplement.patientId !== patient.id || !canEditSupplement(supplement)) notFound();
  const action = updateSupplementAction.bind(null, supplement.id, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=suplementos`, label: patient.full_name },
          { label: "Editar recomendação" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-medium">Editar recomendação</h1>
        <SupplementStatusBadge item={supplement} />
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{supplement.name}</CardTitle>
          <CardDescription>Paciente: {patient.full_name}. As alterações são auditadas; para tirar do portal, encerre ou arquive na aba Suplementos.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplementForm
            mode="edit"
            action={action}
            cancelHref={`/dashboard/pacientes/${patient.id}?tab=suplementos`}
            initial={{
              name: supplement.name,
              brand: supplement.brand ?? "",
              instructions: supplement.instructions ?? "",
              doseText: supplement.doseText ?? "",
              scheduleText: supplement.scheduleText ?? "",
              startsOn: supplement.startsOn ?? "",
              endsOn: supplement.endsOn ?? "",
              notes: supplement.notes ?? "",
              purchaseUrl: supplement.purchaseUrl ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
