import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FlashToast } from "@/components/shared/flash-toast";
import { ExternalLink } from "@/components/shared/external-link";
import { MaterialStatusBadge, MaterialTypeBadge } from "@/components/materials/material-badges";
import { MaterialActions } from "@/components/materials/material-actions";
import { AssignToPatientForm, UnassignButton } from "@/components/materials/assignment-controls";
import { requireNutritionist } from "@/lib/auth/session";
import { getMaterialById, listMaterialAssignments } from "@/data/materials";
import { canAssignMaterial } from "@/domain/patient-content/materials";
import { materialIdSchema } from "@/validators/patient-content";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Material" };
export const dynamic = "force-dynamic";

/**
 * Detalhe do material (prompt Fase 10 §33/§41–§43): dados, arquivo/link,
 * quem recebeu (ativos e histórico), atribuir a paciente e remover
 * atribuição. Ownership: material alheio ou inexistente = 404.
 */
export default async function MaterialPage({ params }: PageProps<"/dashboard/materiais/[materialId]">) {
  const nutritionist = await requireNutritionist();
  const { materialId } = await params;
  const parsed = materialIdSchema.safeParse(materialId);
  if (!parsed.success) notFound();
  const material = await getMaterialById(parsed.data);
  if (!material || material.nutritionistId !== nutritionist.id) notFound();
  const assignments = await listMaterialAssignments(material.id);
  const activeAssignments = assignments.filter((item) => item.revokedAt === null);
  const assignable = canAssignMaterial(material);

  return (
    <div className="space-y-6">
      <FlashToast />
      <Breadcrumbs items={[{ href: "/dashboard/materiais", label: "Materiais" }, { label: material.title }]} />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium break-words">{material.title}</h1>
          <MaterialTypeBadge item={material} />
          <MaterialStatusBadge item={material} />
        </div>
        <p className="text-sm text-muted-foreground">Criado em {formatDateTime(material.createdAt)}{material.updatedAt !== material.createdAt ? ` · atualizado em ${formatDateTime(material.updatedAt)}` : ""}</p>
        {material.description ? <p className="max-w-prose whitespace-pre-line text-sm">{material.description}</p> : null}
        {material.kind === "LINK" && material.externalUrl ? (
          <ExternalLink href={material.externalUrl} className="text-sm">
            Abrir link
          </ExternalLink>
        ) : null}
      </header>

      <MaterialActions
        materialId={material.id}
        title={material.title}
        kind={material.kind}
        archived={material.archivedAt !== null}
        file={material.storagePath ? { name: material.fileName ?? "arquivo", sizeBytes: material.fileSizeBytes, updatedAt: material.updatedAt, mime: material.mimeType } : null}
      />

      <section aria-labelledby="atribuicoes-h" className="space-y-3">
        <div>
          <h2 id="atribuicoes-h" className="font-heading text-lg font-medium">
            Pacientes ({activeAssignments.length})
          </h2>
          <p className="text-sm text-muted-foreground">Quem tem este material disponível no portal. Remover a atribuição não apaga o material.</p>
        </div>

        {assignable ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atribuir a um paciente</CardTitle>
              <CardDescription>Busque pelo nome; só pacientes ativos aparecem.</CardDescription>
            </CardHeader>
            <CardContent>
              <AssignToPatientForm materialId={material.id} />
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">{material.archivedAt ? "Material arquivado: não pode ser atribuído." : "Envie o arquivo antes de atribuir."}</p>
        )}

        {assignments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Ainda não foi atribuído a nenhum paciente.</CardContent>
          </Card>
        ) : (
          <>
            <Card className="hidden py-0 lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className="pl-4">Paciente</TableHead>
                    <TableHead scope="col">Atribuído em</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((item) => (
                    <TableRow key={item.id} className={cn(item.revokedAt && "text-muted-foreground")}>
                      <TableCell className="pl-4 font-medium">
                        <Link href={`/dashboard/pacientes/${item.patientId}?tab=materiais`} className="hover:underline">
                          {item.patientName}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(item.assignedAt)}</TableCell>
                      <TableCell>{item.revokedAt ? `Acesso removido em ${formatDateTime(item.revokedAt)}` : material.archivedAt ? "Material arquivado" : "Disponível"}</TableCell>
                      <TableCell className="pr-4 text-right">
                        {item.revokedAt === null && material.archivedAt === null ? <UnassignButton assignmentId={item.id} materialTitle={material.title} patientName={item.patientName} size="xs" /> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <ul className="grid gap-2 lg:hidden" aria-label="Pacientes com o material">
              {assignments.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                  <div className="min-w-0">
                    <Link href={`/dashboard/pacientes/${item.patientId}?tab=materiais`} className="font-medium break-words hover:underline">
                      {item.patientName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.revokedAt ? `Removido em ${formatDateTime(item.revokedAt)}` : `Atribuído em ${formatDateTime(item.assignedAt)}`}</p>
                  </div>
                  {item.revokedAt === null && material.archivedAt === null ? <UnassignButton assignmentId={item.id} materialTitle={material.title} patientName={item.patientName} size="xs" /> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
