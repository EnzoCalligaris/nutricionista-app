import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientForm } from "@/components/patients/patient-form";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { createPatientAction } from "@/actions/patients";
import { requireNutritionist } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Novo paciente",
};

export const dynamic = "force-dynamic";

export default async function NovoPacientePage() {
  await requireNutritionist();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/dashboard/pacientes", label: "Pacientes" }, { label: "Novo paciente" }]} />

      <div>
        <h1 className="font-heading text-2xl font-medium">Novo paciente</h1>
        <p className="text-sm text-muted-foreground">
          Dados de cadastro. Contrato, consultas e avaliações são registrados depois, no perfil.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do paciente</CardTitle>
          <CardDescription>O paciente pode existir sem acesso ao portal — o convite é opcional.</CardDescription>
        </CardHeader>
        <CardContent>
          <PatientForm mode="create" action={createPatientAction} cancelHref="/dashboard/pacientes" />
        </CardContent>
      </Card>
    </div>
  );
}
