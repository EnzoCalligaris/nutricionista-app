import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ComparisonTable } from "@/components/assessments/comparison-table";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { listPatientAssessments } from "@/data/assessments";
import { patientIdSchema } from "@/validators/patients";
import { assessmentIdSchema } from "@/validators/assessments";
import { formatCalendarDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Comparar avaliações" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Comparação A x B (prompt Fase 9 §33): seleção pela URL (`?a=&b=`, GET —
 * funciona sem JS), só avaliações ativas do paciente; ids de fora caem no
 * padrão (anterior x mais recente).
 */
export default async function CompararPage({ params, searchParams }: PageProps<"/dashboard/pacientes/[id]/avaliacoes/comparar">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const search = await searchParams;
  const parsedId = patientIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const patient = await getPatientById(nutritionist.id, parsedId.data);
  if (!patient) notFound();

  const active = (await listPatientAssessments(patient.id)).filter((assessment) => assessment.archivedAt === null);
  const pick = (raw: string | undefined, fallbackIndex: number) => {
    const parsed = assessmentIdSchema.safeParse(raw);
    return (parsed.success ? active.find((assessment) => assessment.id === parsed.data) : undefined) ?? active[fallbackIndex] ?? null;
  };
  const a = pick(firstParam(search.a), 1);
  const b = pick(firstParam(search.b), 0);
  const backHref = `/dashboard/pacientes/${patient.id}?tab=avaliacoes`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/pacientes", label: "Pacientes" },
          { href: backHref, label: patient.full_name },
          { label: "Comparar avaliações" },
        ]}
      />
      <div>
        <h1 className="font-heading text-2xl font-medium">Comparar avaliações</h1>
        <p className="text-sm text-muted-foreground">Diferença entre duas avaliações, métrica a métrica. Percentuais em pontos percentuais (p.p.). Sem interpretação automática.</p>
      </div>

      {active.length < 2 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">São necessárias pelo menos duas avaliações ativas para comparar.</CardContent>
        </Card>
      ) : (
        <>
          <form method="get" className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="cmp-a">Avaliação A (anterior)</Label>
              <NativeSelect id="cmp-a" name="a" defaultValue={a?.id ?? ""}>
                {active.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {formatCalendarDate(assessment.assessmentDate)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cmp-b">Avaliação B (posterior)</Label>
              <NativeSelect id="cmp-b" name="b" defaultValue={b?.id ?? ""}>
                {active.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {formatCalendarDate(assessment.assessmentDate)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline">
              Comparar
            </Button>
          </form>
          {a && b ? (
            a.id === b.id ? (
              <p className="text-sm text-muted-foreground">Escolha duas avaliações diferentes.</p>
            ) : (
              <ComparisonTable a={a} b={b} />
            )
          ) : null}
        </>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={backHref}>Voltar às avaliações</a>
      </Button>
    </div>
  );
}
