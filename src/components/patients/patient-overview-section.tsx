import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientStatusBadge, PortalAccessBadge } from "@/components/patients/status-badges";
import { SendInviteButton } from "@/components/patients/send-invite-button";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { calculateAge, formatAge } from "@/domain/patients/age";
import { PATIENT_STATUS_DESCRIPTION } from "@/domain/patients/status";
import { PORTAL_ACCESS_DESCRIPTION, type PortalAccessStatus } from "@/domain/patients/portal-access";
import type { TimelineEvent } from "@/domain/patients/timeline";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import type { PatientListItem, PatientRow } from "@/data/patients";
import type { PatientContract } from "@/data/contracts";

type Props = {
  patient: PatientRow;
  overview: PatientListItem;
  portalAccess: PortalAccessStatus;
  currentContract: PatientContract | null;
  timeline: TimelineEvent[];
  today: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** Visão Geral do perfil (prompt Fase 5 §23–§25). */
export function PatientOverviewSection({ patient, overview, portalAccess, currentContract, timeline, today }: Props) {
  const age = calculateAge(patient.birth_date, today);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do paciente</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Nome">{patient.full_name}</Field>
              <Field label="Idade">
                {formatAge(age)}
                {patient.birth_date ? (
                  <span className="text-muted-foreground"> · nascimento {formatCalendarDate(patient.birth_date)}</span>
                ) : null}
              </Field>
              <Field label="E-mail">
                {patient.email ? (
                  <a href={`mailto:${patient.email}`} className="break-all hover:underline">
                    {patient.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Não informado</span>
                )}
              </Field>
              <Field label="Telefone">
                {patient.phone ?? <span className="text-muted-foreground">Não informado</span>}
              </Field>
              <Field label="Status">
                <div className="flex flex-wrap items-center gap-2">
                  <PatientStatusBadge status={overview.uiStatus} />
                  <span className="text-xs text-muted-foreground">{PATIENT_STATUS_DESCRIPTION[overview.uiStatus]}</span>
                </div>
              </Field>
              <Field label="Acesso ao portal">
                <div className="flex flex-wrap items-center gap-2">
                  <PortalAccessBadge status={portalAccess} />
                  <span className="text-xs text-muted-foreground">{PORTAL_ACCESS_DESCRIPTION[portalAccess]}</span>
                </div>
                {portalAccess === "NO_ACCOUNT" && patient.status === "ACTIVE" ? (
                  <div className="mt-2">
                    <SendInviteButton
                      patientId={patient.id}
                      disabledReason={patient.email ? undefined : "Cadastre um e-mail para enviar o convite."}
                    />
                  </div>
                ) : null}
              </Field>
              <Field label="Cadastrado em">{formatCalendarDate(patient.created_at.slice(0, 10))}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrato atual</CardTitle>
            <CardDescription>
              {currentContract
                ? "Valores conforme o resumo financeiro do contrato vigente."
                : "Este paciente não possui contrato vigente."}
            </CardDescription>
          </CardHeader>
          {currentContract ? (
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
                <Field label="Plano">{currentContract.plan.name}</Field>
                <Field label="Início">{formatCalendarDate(currentContract.startDate)}</Field>
                <Field label="Término previsto">{formatCalendarDate(currentContract.endDate)}</Field>
                <Field label="Parcelas">{currentContract.installments.length}</Field>
                <Field label="Contratado">
                  <span className="font-mono tabular-nums">{formatBRL(currentContract.financials.contractedCents)}</span>
                </Field>
                <Field label="Recebido">
                  <span className="font-mono tabular-nums text-success">
                    {formatBRL(currentContract.financials.receivedCents)}
                  </span>
                </Field>
                <Field label="Pendente">
                  <span className="font-mono tabular-nums">{formatBRL(currentContract.financials.pendingCents)}</span>
                </Field>
                <Field label="Previsto">
                  <span className="font-mono tabular-nums">{formatBRL(currentContract.financials.forecastCents)}</span>
                </Field>
              </dl>
            </CardContent>
          ) : null}
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Linha do tempo</CardTitle>
          <CardDescription>Eventos registrados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <PatientTimeline events={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
