import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { PatientActions } from "@/components/patients/patient-actions";
import { PatientStatusBadge, PortalAccessBadge } from "@/components/patients/status-badges";
import { PatientSectionNav, parsePatientSection } from "@/components/patients/patient-section-nav";
import { PatientOverviewSection } from "@/components/patients/patient-overview-section";
import { PatientContractsSection } from "@/components/patients/patient-contracts-section";
import { PatientPlaceholderSection } from "@/components/patients/patient-placeholder-section";
import { PatientFinanceSection } from "@/components/patients/patient-finance-section";
import { PatientMealPlanSection } from "@/components/meal-plans/patient-meal-plan-section";
import { PatientAssessmentsSection } from "@/components/assessments/patient-assessments-section";
import { PatientSupplementsSection } from "@/components/supplements/patient-supplements-section";
import { PatientFeedbacksSection } from "@/components/feedbacks/patient-feedbacks-section";
import { PatientMaterialsSection } from "@/components/materials/patient-materials-section";
import { listPatientSupplements } from "@/data/supplements";
import { listPatientFeedbacks } from "@/data/feedbacks";
import { listAssignableMaterials, listPatientAssignments } from "@/data/materials";
import { listPatientAssessments } from "@/data/assessments";
import { listPatientMealPlans } from "@/data/meal-plans";
import { PatientAppointmentsSection } from "@/components/patients/patient-appointments-section";
import { listPatientAppointments } from "@/data/appointments";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientAuditEvents, getPatientById, getPatientModuleCounts, getPatientOverview, getPatientPayments } from "@/data/patients";
import { getPatientContracts } from "@/data/contracts";
import { listPatientPayments } from "@/data/payments";
import { listPatientTransactions } from "@/data/financial";
import { getPatientPortalAccess } from "@/services/patients";
import { buildPatientTimeline } from "@/domain/patients/timeline";
import { patientIdSchema } from "@/validators/patients";
import { todayISO } from "@/lib/calendar";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Paciente",
};

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Perfil do paciente (prompt Fase 5 §21–§25). Ownership no servidor:
 * `getPatientById(nutritionist.id, id)` só devolve pacientes deste
 * nutricionista — id de outro nutricionista cai em 404, sem revelar
 * existência. Tudo o mais só é consultado depois dessa checagem.
 */
export default async function PacientePage({ params, searchParams }: PageProps<"/dashboard/pacientes/[id]">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const search = await searchParams;

  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  const section = parsePatientSection(firstParam(search.tab));
  const today = todayISO();

  const [overview, contracts, payments, auditEvents, counts, portalAccess] = await Promise.all([
    getPatientOverview(nutritionist.id, patient.id),
    getPatientContracts(patient.id),
    getPatientPayments(nutritionist.id, patient.id),
    getPatientAuditEvents(patient.id),
    getPatientModuleCounts(patient.id),
    getPatientPortalAccess(patient),
  ]);
  if (!overview) notFound();

  const currentContract = overview.currentContract
    ? contracts.find((contract) => contract.id === overview.currentContract?.id) ?? null
    : null;

  const planNameByContract = new Map(contracts.map((contract) => [contract.id, contract.plan.name]));

  const timeline = buildPatientTimeline({
    patient: { created_at: patient.created_at, archived_at: patient.archived_at, status: patient.status },
    contracts: contracts.map((contract) => ({
      id: contract.id,
      plan_name: contract.plan.name,
      start_date: contract.startDate,
      end_date: contract.endDate,
      status: contract.status,
      cancelled_at: contract.cancelledAt,
      created_at: contract.createdAt,
    })),
    payments: payments.map((payment) => ({
      amount_label: formatBRL(payment.amount_cents),
      paid_at: payment.paid_at,
      status: payment.status,
      contract_plan_name: payment.contract_id ? planNameByContract.get(payment.contract_id) ?? null : null,
    })),
    auditEvents,
  });

  const canCreateContract = patient.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs items={[{ href: "/dashboard/pacientes", label: "Pacientes" }, { label: patient.full_name }]} />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium break-words">{patient.full_name}</h1>
            <PatientStatusBadge status={overview.uiStatus} />
            <PortalAccessBadge status={portalAccess} prefix="Portal: " />
          </div>
          <p className="text-sm text-muted-foreground">
            {currentContract ? (
              <>
                {currentContract.plan.name} · início em {formatCalendarDate(currentContract.startDate)}
                {currentContract.endDate ? ` · término previsto ${formatCalendarDate(currentContract.endDate)}` : ""}
              </>
            ) : (
              "Sem contrato vigente"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateContract ? (
            <Button asChild>
              <Link href={`/dashboard/pacientes/${patient.id}/contratos/novo`}>
                <Plus data-icon="inline-start" />
                Novo contrato
              </Link>
            </Button>
          ) : null}
          <PatientActions
            patientId={patient.id}
            fullName={patient.full_name}
            dbStatus={patient.status}
            variant="buttons"
            showView={false}
          />
        </div>
      </header>

      <PatientSectionNav patientId={patient.id} active={section} />

      {section === "visao-geral" ? (
        <PatientOverviewSection
          patient={patient}
          overview={overview}
          portalAccess={portalAccess}
          currentContract={currentContract}
          timeline={timeline}
          today={today}
        />
      ) : section === "contratos" ? (
        <PatientContractsSection patientId={patient.id} contracts={contracts} today={today} canCreate={canCreateContract} />
      ) : section === "consultas" ? (
        <PatientAppointmentsSection patientId={patient.id} appointments={await listPatientAppointments(patient.id)} canCreate={patient.status === "ACTIVE"} />
      ) : section === "cardapio" ? (
        <PatientMealPlanSection patientId={patient.id} plans={await listPatientMealPlans(patient.id)} canCreate={patient.status === "ACTIVE"} />
      ) : section === "avaliacoes" ? (
        <PatientAssessmentsSection patientId={patient.id} assessments={await listPatientAssessments(patient.id)} canCreate={patient.status === "ACTIVE"} />
      ) : section === "suplementos" ? (
        <PatientSupplementsSection patientId={patient.id} supplements={await listPatientSupplements(patient.id)} canCreate={patient.status === "ACTIVE"} />
      ) : section === "feedbacks" ? (
        <PatientFeedbacksSection patientId={patient.id} feedbacks={await listPatientFeedbacks(patient.id)} canCreate={patient.status === "ACTIVE"} />
      ) : section === "materiais" ? (
        <PatientMaterialsSection
          patientId={patient.id}
          patientName={patient.full_name}
          assignments={await listPatientAssignments(patient.id)}
          library={await listAssignableMaterials(nutritionist.id)}
          canAssign={patient.status === "ACTIVE"}
        />
      ) : section === "financeiro" ? (
        <PatientFinanceSection
          patient={{ id: patient.id, name: patient.full_name, status: patient.status }}
          contracts={contracts}
          payments={await listPatientPayments(nutritionist.id, patient.id)}
          transactions={await listPatientTransactions(nutritionist.id, patient.id, today)}
          today={today}
        />
      ) : (
        <PatientPlaceholderSection section={section} counts={counts} />
      )}
    </div>
  );
}
