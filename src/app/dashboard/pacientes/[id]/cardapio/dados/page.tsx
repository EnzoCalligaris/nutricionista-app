import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MealPlanForm } from "@/components/meal-plans/plan-form";
import { updateMealPlanAction } from "@/actions/meal-plans";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { listPatientMealPlans } from "@/data/meal-plans";
import { patientIdSchema } from "@/validators/patients";

export const metadata: Metadata = { title: "Dados do plano alimentar" };
export const dynamic = "force-dynamic";

/** Edita nome, data de início e observação geral do plano ativo (não toca nas versões). */
export default async function DadosPlanoPage({ params }: PageProps<"/dashboard/pacientes/[id]/cardapio/dados">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  const active = (await listPatientMealPlans(patient.id)).find((plan) => plan.archivedAt === null);
  if (!active) redirect(`/dashboard/pacientes/${patient.id}?tab=cardapio`);

  const action = updateMealPlanAction.bind(null, active.id, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=cardapio`, label: patient.full_name },
          { label: "Dados do plano" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Dados do plano</h1>
        <p className="text-sm text-muted-foreground">{active.title}</p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Nome, início e observação geral</CardTitle>
          <CardDescription>Estas informações valem para todas as versões. O conteúdo (dias e refeições) é editado por versão.</CardDescription>
        </CardHeader>
        <CardContent>
          <MealPlanForm mode="edit" action={action} cancelHref={`/dashboard/pacientes/${patient.id}?tab=cardapio`} initial={{ title: active.title, startDate: active.startDate ?? "", notes: active.notes ?? "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
