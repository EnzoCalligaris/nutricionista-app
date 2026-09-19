import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { VersionStatusBadge } from "@/components/meal-plans/version-badge";
import { requireNutritionist } from "@/lib/auth/session";
import { listMealPlanOverview } from "@/data/meal-plans";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Cardápios" };
export const dynamic = "force-dynamic";

/**
 * Cardápios (prompt Fase 8): visão por paciente — plano ativo, versão
 * publicada, rascunho em andamento — com atalho para a aba Cardápio.
 */
export default async function CardapiosPage() {
  const nutritionist = await requireNutritionist();
  const rows = await listMealPlanOverview(nutritionist.id);
  const withPlan = rows.filter((row) => row.plan);
  const withoutPlan = rows.filter((row) => !row.plan && row.patientStatus === "ACTIVE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Cardápios</h1>
        <p className="text-sm text-muted-foreground">Plano alimentar por paciente. O paciente só vê a versão publicada.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum paciente cadastrado ainda.</CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="com-plano" className="space-y-3">
            <h2 id="com-plano" className="font-heading text-lg font-medium">
              Com plano ativo ({withPlan.length})
            </h2>
            {withPlan.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente com plano alimentar ativo.</CardContent>
              </Card>
            ) : (
              <>
                <Card className="hidden py-0 md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead scope="col" className="pl-4">Paciente</TableHead>
                        <TableHead scope="col">Plano</TableHead>
                        <TableHead scope="col">Publicada</TableHead>
                        <TableHead scope="col">Rascunho</TableHead>
                        <TableHead scope="col" className="hidden lg:table-cell">Atualizado em</TableHead>
                        <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withPlan.map((row) => (
                        <TableRow key={row.patientId}>
                          <TableCell className="pl-4 font-medium">
                            <Link href={`/dashboard/pacientes/${row.patientId}?tab=cardapio`} className="hover:underline">
                              {row.patientName}
                            </Link>
                          </TableCell>
                          <TableCell>{row.plan!.title}</TableCell>
                          <TableCell>
                            {row.plan!.published ? (
                              <span className="inline-flex items-center gap-2">
                                v{row.plan!.published.versionNumber} <VersionStatusBadge status="PUBLISHED" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Nenhuma</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.plan!.current?.status === "DRAFT" ? (
                              <span className="inline-flex items-center gap-2">
                                v{row.plan!.current.versionNumber} <VersionStatusBadge status="DRAFT" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDateTime(row.plan!.updatedAt)}</TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button asChild size="xs" variant="outline">
                              <Link href={`/dashboard/pacientes/${row.patientId}?tab=cardapio`}>Abrir</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                <ul className="grid gap-2 md:hidden" aria-label="Pacientes com plano ativo">
                  {withPlan.map((row) => (
                    <li key={row.patientId} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                      <Link href={`/dashboard/pacientes/${row.patientId}?tab=cardapio`} className="block truncate font-medium hover:underline">
                        {row.patientName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.plan!.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {row.plan!.published ? (
                          <span className="inline-flex items-center gap-1">
                            v{row.plan!.published.versionNumber} <VersionStatusBadge status="PUBLISHED" />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem versão publicada</span>
                        )}
                        {row.plan!.current?.status === "DRAFT" ? (
                          <span className="inline-flex items-center gap-1">
                            v{row.plan!.current.versionNumber} <VersionStatusBadge status="DRAFT" />
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="sem-plano" className="space-y-3">
            <h2 id="sem-plano" className="font-heading text-lg font-medium">
              Pacientes ativos sem plano ({withoutPlan.length})
            </h2>
            {withoutPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os pacientes ativos têm plano alimentar.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {withoutPlan.map((row) => (
                  <li key={row.patientId}>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/pacientes/${row.patientId}/cardapio/novo`}>{row.patientName}: criar plano</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
