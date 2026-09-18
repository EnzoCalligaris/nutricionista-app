import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvitePatientForm } from "@/components/auth/invite-patient-form";

export const metadata: Metadata = {
  title: "Convidar paciente — Método EM",
};

// Núcleo mínimo de onboarding (prompt Fase 3 §22) — não é a tela de gestão
// de pacientes (Fase 5, ver src/app/dashboard/pacientes/page.tsx). Existe
// para exercitar o fluxo Auth ponta a ponta: convite -> profile PATIENT
// automático -> paciente vinculado -> paciente ativa o próprio acesso.
export default function InvitePatientPage() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Convidar paciente</CardTitle>
        <CardDescription>
          Núcleo mínimo do fluxo de onboarding — cadastro completo de paciente chega na
          Fase 5. O paciente recebe um e-mail para ativar o próprio acesso e definir a
          própria senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvitePatientForm />
      </CardContent>
    </Card>
  );
}
