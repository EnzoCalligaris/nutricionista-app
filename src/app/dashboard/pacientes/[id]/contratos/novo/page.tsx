import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ContractForm } from "@/components/contracts/contract-form";
import { createContractAction } from "@/actions/contracts";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getDashboardPlans } from "@/data/plans";
import { patientIdSchema } from "@/validators/patients";
import { todayISO } from "@/lib/calendar";

export const metadata: Metadata = {
  title: "Novo contrato",
};

export const dynamic = "force-dynamic";

export default async function NovoContratoPage({ params }: PageProps<"/dashboard/pacientes/[id]/contratos/novo">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  const plans = await getDashboardPlans();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}`, label: patient.full_name },
          { label: "Novo contrato" },
        ]}
      />

      <div>
        <h1 className="font-heading text-2xl font-medium">Novo contrato</h1>
        <p className="text-sm text-muted-foreground">
          Registre o plano contratado por {patient.full_name}. As parcelas são geradas automaticamente e
          ficam pendentes até o pagamento ser registrado.
        </p>
      </div>

      {patient.status !== "ACTIVE" ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Este paciente está desativado. Reative o cadastro antes de registrar um novo contrato.
          </CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum plano ativo no catálogo. Cadastre um plano antes de criar contratos.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Dados do contrato</CardTitle>
            <CardDescription>
              Planos, preços e benefícios vêm do catálogo. O valor salvo é o valor vendido neste contrato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContractForm
              plans={plans}
              today={todayISO()}
              action={createContractAction.bind(null, patient.id)}
              cancelHref={`/dashboard/pacientes/${patient.id}?tab=contratos`}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
