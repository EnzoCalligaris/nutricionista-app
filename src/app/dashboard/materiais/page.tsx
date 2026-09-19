import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FlashToast } from "@/components/shared/flash-toast";
import { MaterialStatusBadge, MaterialTypeBadge } from "@/components/materials/material-badges";
import { requireNutritionist } from "@/lib/auth/session";
import { listMaterials } from "@/data/materials";
import { isMaterialComplete } from "@/domain/patient-content/materials";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Materiais" };
export const dynamic = "force-dynamic";

/**
 * Biblioteca de materiais (prompt Fase 10 §33): título, tipo, status, criado
 * em, pacientes atribuídos, ações. Só materiais do nutricionista
 * autenticado (RLS + query). Tabela ≥ lg (com a sidebar aberta, 768 fica estreito), cards abaixo.
 */
export default async function MateriaisPage() {
  const nutritionist = await requireNutritionist();
  const materials = await listMaterials(nutritionist.id);
  const activeCount = materials.filter((item) => item.archivedAt === null).length;

  return (
    <div className="space-y-6">
      <FlashToast />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium">Materiais</h1>
          <p className="text-sm text-muted-foreground">Guias, listas e arquivos reutilizáveis. Um material pode ser atribuído a vários pacientes; cada paciente só vê o que foi atribuído a ele.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/materiais/novo">
            <Plus data-icon="inline-start" />
            Novo material
          </Link>
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FolderOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhum material ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Envie um PDF ou imagem, ou cadastre um link externo, e atribua aos pacientes pelo perfil de cada um.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {activeCount} ativo(s){materials.length - activeCount > 0 ? ` · ${materials.length - activeCount} arquivado(s)` : ""}
          </p>
          <Card className="hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4">Título</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="hidden xl:table-cell">Criado em</TableHead>
                  <TableHead scope="col" className="text-right">Pacientes</TableHead>
                  <TableHead scope="col" className="pr-4 text-right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((item) => (
                  <TableRow key={item.id} className={cn(item.archivedAt && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <Link href={`/dashboard/materiais/${item.id}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                      {!isMaterialComplete(item) ? <p className="text-xs text-destructive">Arquivo não enviado</p> : item.description ? <p className="max-w-64 truncate text-xs text-muted-foreground">{item.description}</p> : null}
                    </TableCell>
                    <TableCell><MaterialTypeBadge item={item} /></TableCell>
                    <TableCell><MaterialStatusBadge item={item} /></TableCell>
                    <TableCell className="hidden whitespace-nowrap xl:table-cell">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.activeAssignments}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/dashboard/materiais/${item.id}`}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <ul className="grid gap-2 lg:hidden" aria-label="Materiais">
            {materials.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/materiais/${item.id}`} className="min-w-0 font-medium break-words hover:underline">
                    {item.title}
                  </Link>
                  <MaterialTypeBadge item={item} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <MaterialStatusBadge item={item} />
                  <span>{item.activeAssignments} paciente(s)</span>
                  <span>· {formatDateTime(item.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
