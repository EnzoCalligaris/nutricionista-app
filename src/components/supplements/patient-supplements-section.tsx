import Link from "next/link";
import { Pill, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink } from "@/components/shared/external-link";
import { SupplementStatusBadge } from "@/components/supplements/supplement-badges";
import { SupplementActions } from "@/components/supplements/supplement-actions";
import { formatSupplementPeriod, supplementStatus } from "@/domain/patient-content/supplements";
import type { SupplementDetail } from "@/data/supplements";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

function usageLine(item: SupplementDetail): string {
  return [item.doseText, item.scheduleText].filter(Boolean).join(" · ") || "—";
}

/**
 * Aba Suplementos do perfil (prompt Fase 10 §3/§12): histórico completo —
 * ativas, encerradas e arquivadas — com produto, período, status, orientação
 * e última atualização. Tabela ≥ lg (com a sidebar aberta, 768 fica estreito), cards abaixo.
 */
export function PatientSupplementsSection({ patientId, supplements, canCreate }: { patientId: string; supplements: SupplementDetail[]; canCreate: boolean }) {
  const active = supplements.filter((item) => supplementStatus(item) === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium">Suplementos</h2>
          <p className="text-sm text-muted-foreground">
            {active.length === 0 ? "Nenhuma recomendação ativa." : `${active.length} recomendação(ões) ativa(s) visível(is) ao paciente.`}
          </p>
        </div>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href={`/dashboard/pacientes/${patientId}/suplementos/novo`}>
              <Plus data-icon="inline-start" />
              Nova recomendação
            </Link>
          </Button>
        ) : null}
      </div>

      {supplements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Pill className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhuma recomendação de suplemento.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Registre produto, orientação, dose e frequência. O paciente vê as recomendações ativas no portal.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Produto</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Dose / frequência</TableHead>
                  <TableHead scope="col">Período</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Atualização</TableHead>
                  <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplements.map((item) => (
                  <TableRow key={item.id} className={cn(item.archivedAt && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <p className="font-medium">{item.name}</p>
                      {item.brand ? <p className="text-xs text-muted-foreground">{item.brand}</p> : null}
                      {item.purchaseUrl ? (
                        <ExternalLink href={item.purchaseUrl} className="text-xs" showHost={false}>
                          Ver produto
                        </ExternalLink>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden max-w-56 xl:table-cell">
                      <p className="truncate">{usageLine(item)}</p>
                      {item.instructions ? <p className="truncate text-xs text-muted-foreground">{item.instructions}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatSupplementPeriod(item.startsOn, item.endsOn, formatCalendarDate) ?? "—"}</TableCell>
                    <TableCell><SupplementStatusBadge item={item} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <SupplementActions supplementId={item.id} patientId={patientId} name={item.name} item={item} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <ul className="grid gap-2 lg:hidden" aria-label="Recomendações de suplementos">
            {supplements.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{item.name}</p>
                    {item.brand ? <p className="text-xs text-muted-foreground">{item.brand}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <SupplementStatusBadge item={item} />
                    <SupplementActions supplementId={item.id} patientId={patientId} name={item.name} item={item} />
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Dose / frequência</dt>
                    <dd className="break-words">{usageLine(item)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Período</dt>
                    <dd>{formatSupplementPeriod(item.startsOn, item.endsOn, formatCalendarDate) ?? "—"}</dd>
                  </div>
                  {item.instructions ? (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Orientação</dt>
                      <dd className="break-words">{item.instructions}</dd>
                    </div>
                  ) : null}
                  {item.purchaseUrl ? (
                    <div className="col-span-2 min-w-0">
                      <ExternalLink href={item.purchaseUrl} className="text-sm">
                        Ver produto
                      </ExternalLink>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">A recomendação é sempre do nutricionista: o sistema não sugere produtos, doses ou substituições.</p>
    </div>
  );
}
