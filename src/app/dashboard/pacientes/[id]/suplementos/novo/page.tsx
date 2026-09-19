import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EMPTY_SUPPLEMENT, SupplementForm } from "@/components/supplements/supplement-form";
import { createSupplementAction } from "@/actions/supplements";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { patientIdSchema } from "@/validators/patients";

export const metadata: Metadata = { title: "Nova recomendação de suplemento" };
export const dynamic = "force-dynamic";

/** Nova recomendação (prompt Fase 10 §5): paciente do contexto da rota, reconferido por ownership. */
export default async function NovoSuplementoPage({ params }: PageProps<"/dashboard/pacientes/[id]/suplementos/novo">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();
  const action = createSupplementAction.bind(null, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=suplementos`, label: patient.full_name },
          { label: "Nova recomendação" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Nova recomendação de suplemento</h1>
        <p className="text-sm text-muted-foreground">Paciente: {patient.full_name}. A recomendação fica visível no portal assim que for salva.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados da recomendação</CardTitle>
          <CardDescription>Só o nome é obrigatório. Dose e frequência são texto livre — o sistema não calcula nem sugere nada.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplementForm mode="create" action={action} cancelHref={`/dashboard/pacientes/${patient.id}?tab=suplementos`} initial={EMPTY_SUPPLEMENT} />
        </CardContent>
      </Card>
    </div>
  );
}
