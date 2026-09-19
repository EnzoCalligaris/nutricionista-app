import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MaterialForm } from "@/components/materials/material-form";
import { updateMaterialAction } from "@/actions/materials";
import { requireNutritionist } from "@/lib/auth/session";
import { getMaterialById } from "@/data/materials";
import { canEditMaterial } from "@/domain/patient-content/materials";
import { materialIdSchema } from "@/validators/patient-content";

export const metadata: Metadata = { title: "Editar material" };
export const dynamic = "force-dynamic";

/** Edição do material (título, descrição, link): ownership; arquivado é só leitura (404 na edição). */
export default async function EditarMaterialPage({ params }: PageProps<"/dashboard/materiais/[materialId]/editar">) {
  const nutritionist = await requireNutritionist();
  const { materialId } = await params;
  const parsed = materialIdSchema.safeParse(materialId);
  if (!parsed.success) notFound();
  const material = await getMaterialById(parsed.data);
  if (!material || material.nutritionistId !== nutritionist.id || !canEditMaterial(material)) notFound();
  const action = updateMaterialAction.bind(null, material.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/dashboard/materiais", label: "Materiais" }, { href: `/dashboard/materiais/${material.id}`, label: material.title }, { label: "Editar" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Editar material</h1>
        <p className="text-sm text-muted-foreground">O tipo (arquivo ou link) não muda. Para trocar o arquivo, use &ldquo;Substituir arquivo&rdquo; na página do material.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{material.title}</CardTitle>
          <CardDescription>As alterações aparecem imediatamente para os pacientes que já têm o material.</CardDescription>
        </CardHeader>
        <CardContent>
          <MaterialForm
            mode="edit"
            action={action}
            cancelHref={`/dashboard/materiais/${material.id}`}
            initial={{ kind: material.kind, title: material.title, description: material.description ?? "", externalUrl: material.externalUrl ?? "" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
