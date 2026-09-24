import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanDetailsForm } from "@/components/plans/plan-details-form";
import { PlanPriceManager } from "@/components/plans/plan-price-manager";
import { PlanBenefitManager } from "@/components/plans/plan-benefit-manager";
import { PlanCard } from "@/components/marketing/plan-card";
import { requireNutritionist } from "@/lib/auth/session";
import { getAdminPlan } from "@/data/plans";
import { toPublicPlanPreview } from "@/domain/plans/preview";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/planos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const plan = await getAdminPlan(id);
  return { title: plan ? `Plano ${plan.name}` : "Plano" };
}

/**
 * Gestão de um plano (prompt Fase 14 §13–§19) + PREVIEW do card público
 * (§64), montado com o mesmo componente que o site usa — então o que aparece
 * aqui é literalmente o que o visitante veria.
 */
export default async function DashboardPlanoPage({ params }: PageProps<"/dashboard/planos/[id]">) {
  await requireNutritionist();
  const { id } = await params;
  const plan = await getAdminPlan(id);
  if (!plan) notFound();

  const preview = toPublicPlanPreview(plan);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/configuracoes" className="hover:underline">
            Configurações
          </Link>{" "}
          /{" "}
          <Link href="/dashboard/planos" className="hover:underline">
            Planos
          </Link>{" "}
          / {plan.name}
        </p>
        <h1 className="font-heading text-2xl font-medium">{plan.name}</h1>
        <p className="text-sm text-muted-foreground">
          Código {plan.code}. As mudanças aparecem no site assim que salvas.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Dados e visibilidade</CardTitle>
              <CardDescription>Visível no site e disponível para venda exigem o plano ativo.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanDetailsForm plan={plan} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Condições de preço</CardTitle>
              <CardDescription>
                Preço é versionado: desative uma condição e crie outra em vez de reescrever o histórico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanPriceManager plan={plan} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Benefícios</CardTitle>
              <CardDescription>A ordem aqui é a ordem no site.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanBenefitManager plan={plan} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="font-heading text-lg font-medium">Como aparece no site</h2>
            <p className="text-sm text-muted-foreground">
              {plan.publiclyVisible
                ? "Este plano está visível no site."
                : "Este plano NÃO está visível no site — o preview é só uma prévia."}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-muted/40 p-4">
            <PlanCard plan={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}
