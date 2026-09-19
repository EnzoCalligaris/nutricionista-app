import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MealPlanForm, type SourceVersionOption } from "@/components/meal-plans/plan-form";
import { createMealPlanAction } from "@/actions/meal-plans";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { listPatientMealPlans } from "@/data/meal-plans";
import { patientIdSchema } from "@/validators/patients";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Novo plano alimentar" };
export const dynamic = "force-dynamic";

/** Novo plano (prompt Fase 8 §6/§20): paciente do contexto; plano anterior pode servir de base. */
export default async function NovoPlanoPage({ params }: PageProps<"/dashboard/pacientes/[id]/cardapio/novo">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  const plans = await listPatientMealPlans(patient.id);
  if (plans.some((plan) => plan.archivedAt === null)) redirect(`/dashboard/pacientes/${patient.id}?tab=cardapio`);

  const sources: SourceVersionOption[] = plans.flatMap((plan) =>
    plan.versions
      .filter((version) => version.status !== "DRAFT")
      .map((version) => ({
        id: version.id,
        label: `${plan.title} — v${version.versionNumber}${version.publishedAt ? ` (publicada em ${formatCalendarDate(version.publishedAt.slice(0, 10))})` : ""}`,
      })),
  );

  const action = createMealPlanAction.bind(null, patient.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}?tab=cardapio`, label: patient.full_name },
          { label: "Novo plano alimentar" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Novo plano alimentar</h1>
        <p className="text-sm text-muted-foreground">Paciente: {patient.full_name}. O plano nasce como rascunho — o paciente só vê depois de publicado.</p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do plano</CardTitle>
          <CardDescription>Dias, refeições, alimentos e substituições são montados no editor, no próximo passo.</CardDescription>
        </CardHeader>
        <CardContent>
          <MealPlanForm mode="create" action={action} cancelHref={`/dashboard/pacientes/${patient.id}?tab=cardapio`} initial={{ title: "", startDate: "", notes: "" }} sources={sources} />
        </CardContent>
      </Card>
    </div>
  );
}
