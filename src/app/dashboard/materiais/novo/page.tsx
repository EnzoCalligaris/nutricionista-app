import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { MaterialForm } from "@/components/materials/material-form";
import { createMaterialAction } from "@/actions/materials";
import { requireNutritionist } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo material" };
export const dynamic = "force-dynamic";

/** Novo material (prompt Fase 10 §34): arquivo privado OU link externo. */
export default async function NovoMaterialPage() {
  await requireNutritionist();
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/dashboard/materiais", label: "Materiais" }, { label: "Novo material" }]} />
      <div>
        <h1 className="font-heading text-2xl font-medium">Novo material</h1>
        <p className="text-sm text-muted-foreground">Depois de criar, atribua o material aos pacientes que devem recebê-lo.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados do material</CardTitle>
          <CardDescription>Arquivo (PDF, JPG ou PNG até 10 MB, em armazenamento privado) ou link externo — nunca os dois.</CardDescription>
        </CardHeader>
        <CardContent>
          <MaterialForm mode="create" action={createMaterialAction} cancelHref="/dashboard/materiais" initial={{ kind: "FILE", title: "", description: "", externalUrl: "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
