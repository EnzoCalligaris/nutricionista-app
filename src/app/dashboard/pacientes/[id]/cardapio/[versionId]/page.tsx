import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { MealPlanEditor } from "@/components/meal-plans/meal-plan-editor";
import { MealPlanView } from "@/components/meal-plans/meal-plan-view";
import { PlanActions } from "@/components/meal-plans/plan-actions";
import { VersionStatusBadge } from "@/components/meal-plans/version-badge";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { getMealPlanById, getMealPlanVersion } from "@/data/meal-plans";
import { STRUCTURE_PROBLEM_MESSAGE, countStructure, validateStructureForPublish } from "@/domain/meal-plans/structure";
import { canCreateVersion, isEditable, selectDraft, selectPublished } from "@/domain/meal-plans/versioning";
import { patientIdSchema } from "@/validators/patients";
import { versionIdSchema } from "@/validators/meal-plans";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Plano alimentar" };
export const dynamic = "force-dynamic";

/**
 * Página da versão (prompt Fase 8 §51–§52): rascunho abre o editor;
 * publicada/arquivada abre só leitura com "Criar nova versão". Ownership:
 * paciente do nutricionista + versão do plano desse paciente (ids
 * adulterados caem em 404 sem revelar nada).
 */
export default async function VersaoPlanoPage({ params }: PageProps<"/dashboard/pacientes/[id]/cardapio/[versionId]">) {
  const nutritionist = await requireNutritionist();
  const { id, versionId } = await params;
  const parsedPatient = patientIdSchema.safeParse(id);
  const parsedVersion = versionIdSchema.safeParse(versionId);
  if (!parsedPatient.success || !parsedVersion.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedPatient.data);
  if (!patient) notFound();

  const version = await getMealPlanVersion(parsedVersion.data);
  if (!version || version.plan.patientId !== patient.id || version.plan.nutritionistId !== nutritionist.id) notFound();
  const plan = await getMealPlanById(version.plan.id);
  if (!plan) notFound();

  const editable = isEditable(version.status) && plan.archivedAt === null;
  const draft = selectDraft(plan.versions);
  const published = selectPublished(plan.versions);
  const counts = countStructure(version.days);
  // Motivo de bloqueio da publicação sempre se refere ao RASCUNHO (que pode
  // não ser a versão aberta quando se visualiza a publicada).
  const draftFull = draft ? (draft.id === version.id ? version : await getMealPlanVersion(draft.id)) : null;
  const draftStructure = draftFull ? validateStructureForPublish(draftFull.days) : null;
  const publishBlockedReason = draftStructure && !draftStructure.ok ? STRUCTURE_PROBLEM_MESSAGE[draftStructure.problem] : null;
  const backHref = `/dashboard/pacientes/${patient.id}?tab=cardapio`;

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: backHref, label: patient.full_name },
          { label: `${plan.title} · v${version.versionNumber}` },
        ]}
      />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium break-words">{plan.title}</h1>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums">v{version.versionNumber}</span>
            <VersionStatusBadge status={version.status} />
            {plan.archivedAt ? <span className="text-xs text-muted-foreground">plano arquivado</span> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {version.status === "PUBLISHED" && version.publishedAt ? `Publicada em ${formatDateTime(version.publishedAt)} · ` : ""}
            {version.status === "ARCHIVED" && version.archivedAt ? `Arquivada em ${formatDateTime(version.archivedAt)} · ` : ""}
            Atualizada em {formatDateTime(version.updatedAt)} · {counts.days} dia(s), {counts.meals} refeição(ões), {counts.items} alimento(s)
          </p>
          {plan.notes ? <p className="text-sm text-muted-foreground">{plan.notes}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>Voltar ao cardápio do paciente</Link>
          </Button>
          {plan.archivedAt === null ? (
            <PlanActions
              planId={plan.id}
              patientId={patient.id}
              planTitle={plan.title}
              draft={draft ? { id: draft.id, versionNumber: draft.versionNumber } : null}
              published={published ? { id: published.id, versionNumber: published.versionNumber } : null}
              canCreateVersion={canCreateVersion(plan.versions, false)}
              publishBlockedReason={publishBlockedReason}
              archived={false}
              compact
            />
          ) : null}
        </div>
      </header>

      {editable ? (
        <MealPlanEditor patientId={patient.id} versionId={version.id} versionNotes={version.notes} days={version.days} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            {version.status === "PUBLISHED"
              ? "Esta é a versão que o paciente vê no portal. Para alterar, crie uma nova versão: a atual continua publicada até você publicar a nova."
              : "Versão arquivada — histórico somente leitura."}
            {draft && draft.id !== version.id ? (
              <>
                {" "}
                <Link href={`/dashboard/pacientes/${patient.id}/cardapio/${draft.id}`} className="font-medium underline underline-offset-4">
                  Abrir o rascunho v{draft.versionNumber}
                </Link>
                .
              </>
            ) : null}
          </div>
          {version.notes ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Observações desta versão:</span> {version.notes}
            </p>
          ) : null}
          <MealPlanView days={version.days} defaultDayId={version.days[0]?.id ?? null} showNutrients />
        </div>
      )}
    </div>
  );
}
