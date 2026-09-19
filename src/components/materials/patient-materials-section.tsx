import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssignmentStatusBadge, MaterialTypeBadge } from "@/components/materials/material-badges";
import { AssignFromLibraryForm, UnassignButton } from "@/components/materials/assignment-controls";
import { isAssignmentActive, materialTypeLabel } from "@/domain/patient-content/materials";
import type { MaterialDetail, PatientAssignment } from "@/data/materials";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Aba Materiais do perfil (prompt Fase 10 §42–§43): materiais atribuídos com
 * data, status e "Remover"; histórico de revogados/arquivados; atribuição a
 * partir da biblioteca. Tabela ≥ lg (com a sidebar aberta, 768 fica estreito), cards abaixo.
 */
export function PatientMaterialsSection({
  patientId,
  patientName,
  assignments,
  library,
  canAssign,
}: {
  patientId: string;
  patientName: string;
  assignments: PatientAssignment[];
  library: MaterialDetail[];
  canAssign: boolean;
}) {
  const active = assignments.filter(isAssignmentActive);
  const activeIds = new Set(active.map((item) => item.materialId));
  const options = library.filter((material) => !activeIds.has(material.id)).map((material) => ({ id: material.id, title: material.title, typeLabel: materialTypeLabel(material) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium">Materiais</h2>
          <p className="text-sm text-muted-foreground">{active.length === 0 ? "Nenhum material disponível ao paciente." : `${active.length} material(is) disponível(is) ao paciente.`}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/materiais">Biblioteca de materiais</Link>
        </Button>
      </div>

      {canAssign ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atribuir material</CardTitle>
            <CardDescription>Escolha um material da sua biblioteca. O paciente passa a vê-lo no portal imediatamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <AssignFromLibraryForm patientId={patientId} options={options} />
          </CardContent>
        </Card>
      ) : null}

      {assignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <FolderOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhum material atribuído.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Crie materiais na biblioteca (PDF, imagem ou link) e atribua aqui aos pacientes que devem recebê-los.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Material</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Atribuído em</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((item) => (
                  <TableRow key={item.id} className={cn(!isAssignmentActive(item) && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <Link href={`/dashboard/materiais/${item.materialId}`} className="font-medium hover:underline">
                        {item.material.title}
                      </Link>
                      {item.material.description ? <p className="max-w-56 truncate text-xs text-muted-foreground">{item.material.description}</p> : null}
                    </TableCell>
                    <TableCell><MaterialTypeBadge item={item.material} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap xl:table-cell">{formatDateTime(item.assignedAt)}</TableCell>
                    <TableCell><AssignmentStatusBadge item={item} /></TableCell>
                    <TableCell className="pr-4 text-right">
                      {isAssignmentActive(item) ? <UnassignButton assignmentId={item.id} materialTitle={item.material.title} patientName={patientName} size="xs" /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <ul className="grid gap-2 lg:hidden" aria-label="Materiais do paciente">
            {assignments.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/dashboard/materiais/${item.materialId}`} className="font-medium break-words hover:underline">
                      {item.material.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">Atribuído em {formatDateTime(item.assignedAt)}</p>
                  </div>
                  <MaterialTypeBadge item={item.material} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <AssignmentStatusBadge item={item} />
                  {isAssignmentActive(item) ? <UnassignButton assignmentId={item.id} materialTitle={item.material.title} patientName={patientName} size="xs" /> : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
