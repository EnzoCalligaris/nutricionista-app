import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientForm } from "@/components/patients/patient-form";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { updatePatientAction } from "@/actions/patients";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { patientIdSchema } from "@/validators/patients";

export const metadata: Metadata = {
  title: "Editar paciente",
};

export const dynamic = "force-dynamic";

export default async function EditarPacientePage({ params }: PageProps<"/dashboard/pacientes/[id]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  // Ownership no servidor: só carrega se pertencer a este nutricionista.
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: `/dashboard/pacientes/${patient.id}`, label: patient.full_name },
          { label: "Editar" },
        ]}
      />

      <div>
        <h1 className="font-heading text-2xl font-medium">Editar paciente</h1>
        <p className="text-sm text-muted-foreground">Dados de cadastro de {patient.full_name}.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do paciente</CardTitle>
          <CardDescription>
            Somente dados administrativos. Vínculos internos (conta, nutricionista responsável) não são editáveis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PatientForm
            mode="edit"
            hasPortalAccount={patient.profile_id !== null}
            initial={{
              fullName: patient.full_name,
              email: patient.email ?? "",
              phone: patient.phone ?? "",
              birthDate: patient.birth_date ?? "",
            }}
            action={updatePatientAction.bind(null, patient.id)}
            cancelHref={`/dashboard/pacientes/${patient.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
