import Link from "next/link";
import { Pencil, Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VersionStatusBadge } from "@/components/meal-plans/version-badge";
import { PlanActions } from "@/components/meal-plans/plan-actions";
import { getMealPlanVersion, type MealPlanSummary, type MealPlanVersionMeta } from "@/data/meal-plans";
import { STRUCTURE_PROBLEM_MESSAGE, countStructure, validateStructureForPublish } from "@/domain/meal-plans/structure";
import { canCreateVersion, selectDraft, selectPublished } from "@/domain/meal-plans/versioning";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";

function VersionsTable({ plan, patientId }: { plan: MealPlanSummary; patientId: string }) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="pl-4">Versão</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col" className="hidden sm:table-cell">Criada em</TableHead>
            <TableHead scope="col" className="hidden md:table-cell">Publicada em</TableHead>
            <TableHead scope="col" className="hidden lg:table-cell">Responsável</TableHead>
            <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.versions.map((version: MealPlanVersionMeta) => (
            <TableRow key={version.id}>
              <TableCell className="pl-4 font-medium tabular-nums">
                v{version.versionNumber}
                <span className="block text-xs font-normal text-muted-foreground sm:hidden">{formatDateTime(version.createdAt)}</span>
              </TableCell>
              <TableCell><VersionStatusBadge status={version.status} /></TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDateTime(version.createdAt)}</TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{version.publishedAt ? formatDateTime(version.publishedAt) : "—"}</TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{version.publishedByName ?? version.createdByName ?? "—"}</TableCell>
              <TableCell className="pr-4 text-right">
                <Button asChild size="xs" variant="outline">
                  <Link href={`/dashboard/pacientes/${patientId}/cardapio/${version.id}`}>{version.status === "DRAFT" ? "Editar" : "Visualizar"}</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * Aba Cardápio do perfil (prompt Fase 8 §5/§26): plano atual (status,
 * versão, publicação, última atualização, ações) + histórico de versões +
 * planos arquivados (base para um novo plano).
 */
export async function PatientMealPlanSection({ patientId, plans, canCreate }: { patientId: string; plans: MealPlanSummary[]; canCreate: boolean }) {
  const active = plans.find((plan) => plan.archivedAt === null) ?? null;
  const archived = plans.filter((plan) => plan.archivedAt !== null);

  if (!active) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Nenhum plano alimentar ativo.</p>
              <p className="text-sm text-muted-foreground">Crie o plano, monte os dias e refeições e publique quando estiver pronto — o paciente só vê versões publicadas.</p>
            </div>
            {canCreate ? (
              <Button asChild>
                <Link href={`/dashboard/pacientes/${patientId}/cardapio/novo`}>
                  <Plus data-icon="inline-start" />
                  Criar plano alimentar
                </Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Reative o paciente para criar um plano.</p>
            )}
          </CardContent>
        </Card>
        {archived.length > 0 ? <ArchivedPlans plans={archived} patientId={patientId} /> : null}
      </div>
    );
  }

  const draft = selectDraft(active.versions);
  const published = selectPublished(active.versions);
  const current = draft ?? published ?? active.versions[0] ?? null;
  const draftFull = draft ? await getMealPlanVersion(draft.id) : null;
  const structure = draftFull ? validateStructureForPublish(draftFull.days) : null;
  const publishBlockedReason = structure && !structure.ok ? STRUCTURE_PROBLEM_MESSAGE[structure.problem] : null;
  const counts = draftFull ? countStructure(draftFull.days) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-heading text-lg">{active.title}</CardTitle>
                {current ? <VersionStatusBadge status={current.status} /> : null}
              </div>
              <CardDescription>
                {active.startDate ? `Início em ${formatCalendarDate(active.startDate)} · ` : ""}
                Atualizado em {formatDateTime(active.updatedAt)}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/pacientes/${patientId}/cardapio/dados`}>
                <Pencil data-icon="inline-start" />
                Editar dados
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Versão publicada</dt>
              <dd className="font-medium">{published ? `v${published.versionNumber}` : "Nenhuma"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Publicada em</dt>
              <dd className="font-medium">{published?.publishedAt ? formatDateTime(published.publishedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rascunho</dt>
              <dd className="font-medium">{draft ? `v${draft.versionNumber}` : "Nenhum"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Conteúdo do rascunho</dt>
              <dd className="font-medium">{counts ? `${counts.days} dia(s) · ${counts.meals} refeição(ões) · ${counts.items} alimento(s)` : "—"}</dd>
            </div>
          </dl>
          {active.notes ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Observação geral:</span> {active.notes}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <Button asChild>
                <Link href={`/dashboard/pacientes/${patientId}/cardapio/${draft.id}`}>Abrir editor (v{draft.versionNumber})</Link>
              </Button>
            ) : null}
            {published ? (
              <Button asChild variant={draft ? "outline" : "default"}>
                <Link href={`/dashboard/pacientes/${patientId}/cardapio/${published.id}`}>Ver versão publicada (v{published.versionNumber})</Link>
              </Button>
            ) : null}
          </div>
          <PlanActions
            planId={active.id}
            patientId={patientId}
            planTitle={active.title}
            draft={draft ? { id: draft.id, versionNumber: draft.versionNumber } : null}
            published={published ? { id: published.id, versionNumber: published.versionNumber } : null}
            canCreateVersion={canCreateVersion(active.versions, false)}
            publishBlockedReason={publishBlockedReason}
            archived={false}
            compact
          />
        </CardContent>
      </Card>

      <section aria-labelledby="versoes-heading" className="space-y-3">
        <h2 id="versoes-heading" className="font-heading text-lg font-medium">
          Histórico de versões
        </h2>
        <VersionsTable plan={active} patientId={patientId} />
      </section>

      {archived.length > 0 ? <ArchivedPlans plans={archived} patientId={patientId} /> : null}
    </div>
  );
}

function ArchivedPlans({ plans, patientId }: { plans: MealPlanSummary[]; patientId: string }) {
  return (
    <section aria-labelledby="arquivados-heading" className="space-y-3">
      <h2 id="arquivados-heading" className="font-heading text-lg font-medium">
        Planos arquivados
      </h2>
      <div className="space-y-3">
        {plans.map((plan) => (
          <Card key={plan.id} size="sm">
            <CardHeader>
              <CardTitle className="text-base">{plan.title}</CardTitle>
              <CardDescription>
                Arquivado em {plan.archivedAt ? formatDateTime(plan.archivedAt) : "—"} · {plan.versions.length} versão(ões)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.versions.map((version) => (
                <Button key={version.id} asChild size="xs" variant="outline">
                  <Link href={`/dashboard/pacientes/${patientId}/cardapio/${version.id}`}>
                    v{version.versionNumber}
                    {version.publishedAt ? ` · publicada ${formatCalendarDate(version.publishedAt.slice(0, 10))}` : ""}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
