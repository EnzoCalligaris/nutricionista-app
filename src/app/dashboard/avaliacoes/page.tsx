import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { requireNutritionist } from "@/lib/auth/session";
import { listAssessmentOverview } from "@/data/assessments";
import { formatMetric } from "@/domain/assessments/numbers";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Avaliações" };
export const dynamic = "force-dynamic";

/** Avaliações (prompt Fase 9): visão por paciente — última avaliação, peso, visibilidade — com atalho para a aba. */
export default async function AvaliacoesPage() {
  const nutritionist = await requireNutritionist();
  const rows = await listAssessmentOverview(nutritionist.id);
  const withAssessment = rows.filter((row) => row.latest);
  const without = rows.filter((row) => !row.latest && row.patientStatus === "ACTIVE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Avaliações</h1>
        <p className="text-sm text-muted-foreground">Avaliações físicas e bioimpedância por paciente. O paciente só vê o que você liberar.</p>
      </div>

      <section aria-labelledby="com-avaliacao" className="space-y-3">
        <h2 id="com-avaliacao" className="font-heading text-lg font-medium">
          Com avaliação ({withAssessment.length})
        </h2>
        {withAssessment.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação registrada ainda.</CardContent>
          </Card>
        ) : (
          <>
            <Card className="hidden py-0 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className="pl-4">Paciente</TableHead>
                    <TableHead scope="col">Última avaliação</TableHead>
                    <TableHead scope="col" className="text-right">Peso</TableHead>
                    <TableHead scope="col" className="hidden lg:table-cell">Visibilidade</TableHead>
                    <TableHead scope="col" className="hidden text-right lg:table-cell">Total</TableHead>
                    <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withAssessment.map((row) => (
                    <TableRow key={row.patientId}>
                      <TableCell className="pl-4 font-medium">
                        <Link href={`/dashboard/pacientes/${row.patientId}?tab=avaliacoes`} className="hover:underline">
                          {row.patientName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCalendarDate(row.latest!.assessmentDate)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{row.latest!.weight != null ? formatMetric(row.latest!.weight, "kg") : "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{row.latest!.visibleToPatient ? "Visível ao paciente" : "Só nutricionista"}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{row.total}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/dashboard/pacientes/${row.patientId}?tab=avaliacoes`}>Abrir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <ul className="grid gap-2 md:hidden" aria-label="Pacientes com avaliação">
              {withAssessment.map((row) => (
                <li key={row.patientId} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <Link href={`/dashboard/pacientes/${row.patientId}?tab=avaliacoes`} className="block truncate font-medium hover:underline">
                    {row.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatCalendarDate(row.latest!.assessmentDate)} · {row.latest!.weight != null ? formatMetric(row.latest!.weight, "kg") : "sem peso"} · {row.total} avaliação(ões)
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="sem-avaliacao" className="space-y-3">
        <h2 id="sem-avaliacao" className="font-heading text-lg font-medium">
          Pacientes ativos sem avaliação ({without.length})
        </h2>
        {without.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os pacientes ativos têm avaliação registrada.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {without.map((row) => (
              <li key={row.patientId}>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/pacientes/${row.patientId}/avaliacoes/nova`}>{row.patientName}: nova avaliação</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
