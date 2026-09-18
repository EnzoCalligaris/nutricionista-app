import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PatientActions } from "@/components/patients/patient-actions";
import { PatientStatusBadge } from "@/components/patients/status-badges";
import { calculateAge, formatAge } from "@/domain/patients/age";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";
import type { PatientListItem } from "@/data/patients";

type Props = { items: PatientListItem[]; today: string };

/**
 * Listagem (prompt Fase 5 §9/§56): tabela a partir de `lg` (1024px — tablet
 * paisagem/desktop, quando sobra largura ao lado da sidebar) e cards em grade
 * abaixo disso — as ações continuam acessíveis em qualquer largura. A coluna
 * "Término previsto" e "Próxima consulta" só entram em `xl` (1280px); no
 * card ambas aparecem sempre.
 * Idade calculada de `birth_date` (§10), nunca armazenada.
 */
export function PatientTable({ items, today }: Props) {
  return (
    <>
      <div className="hidden lg:block">
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="pl-4">
                  Nome
                </TableHead>
                <TableHead scope="col">Idade</TableHead>
                <TableHead scope="col">Plano atual</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">
                  Valor contratado
                </TableHead>
                <TableHead scope="col">Início</TableHead>
                <TableHead scope="col" className="hidden xl:table-cell">
                  Término previsto
                </TableHead>
                <TableHead scope="col" className="hidden xl:table-cell">
                  Próxima consulta
                </TableHead>
                <TableHead scope="col" className="w-12 pr-3 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/dashboard/pacientes/${patient.id}`}
                      className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {patient.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAge(calculateAge(patient.birthDate, today))}
                  </TableCell>
                  <TableCell>
                    {patient.currentContract ? (
                      patient.currentContract.planName
                    ) : (
                      <span className="text-muted-foreground">Sem plano</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PatientStatusBadge status={patient.uiStatus} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {patient.currentContract ? formatBRL(patient.currentContract.contractedAmountCents) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCalendarDate(patient.currentContract?.startDate)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">
                    {formatCalendarDate(patient.currentContract?.endDate)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">
                    {patient.nextAppointmentAt ? formatDateTime(patient.nextAppointmentAt) : "Sem consulta agendada"}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <PatientActions patientId={patient.id} fullName={patient.fullName} dbStatus={patient.dbStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ul className="grid gap-3 lg:hidden" aria-label="Pacientes">
        {items.map((patient) => (
          <li key={patient.id}>
            <Card size="sm">
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/pacientes/${patient.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {patient.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatAge(calculateAge(patient.birthDate, today))}
                      {" · "}
                      {patient.currentContract ? patient.currentContract.planName : "Sem plano"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <PatientStatusBadge status={patient.uiStatus} />
                    <PatientActions patientId={patient.id} fullName={patient.fullName} dbStatus={patient.dbStatus} />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Valor contratado</dt>
                    <dd className="font-mono tabular-nums">
                      {patient.currentContract ? formatBRL(patient.currentContract.contractedAmountCents) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Período</dt>
                    <dd>
                      {patient.currentContract
                        ? `${formatCalendarDate(patient.currentContract.startDate)} – ${formatCalendarDate(patient.currentContract.endDate)}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    <span>
                      {patient.nextAppointmentAt
                        ? `Próxima consulta ${formatDateTime(patient.nextAppointmentAt)}`
                        : "Sem consulta agendada"}
                    </span>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
