import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ConsentCard } from "@/components/meals/consent-card";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { getMealAiConsent } from "@/services/food-analysis/service";

export const metadata: Metadata = { title: "Consentimento — análise por IA" };
export const dynamic = "force-dynamic";

/** Consentimento explícito e versionado antes da primeira análise (prompt Fase 11 §19–§22). */
export default async function ConsentimentoPage({ searchParams }: PageProps<"/paciente/refeicoes/consentimento">) {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  const consent = context ? await getMealAiConsent(context.patientId) : null;
  const search = await searchParams;
  const next = search.next === "nova" ? "/paciente/refeicoes/nova" : undefined;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/paciente/refeicoes", label: "Refeições" }, { label: "Consentimento" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Consentimento</h1>
        <p className="text-sm text-muted-foreground">Como funciona a análise de fotos por IA e o que você está autorizando.</p>
      </div>
      {context ? <ConsentCard acceptedAt={consent?.acceptedAt ?? null} nextHref={next} /> : <p className="text-sm text-muted-foreground">Sua conta ainda não está vinculada a um cadastro de paciente.</p>}
    </div>
  );
}
