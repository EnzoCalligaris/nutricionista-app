import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireNutritionist } from "@/lib/auth/session";
import { getAdminPlans } from "@/data/plans";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Planos" };
export const dynamic = "force-dynamic";

/**
 * Administração dos planos (prompt Fase 14 §13/§14). Mostra TODOS os planos,
 * inclusive o ANUAL — que existe no banco mas continua fora do site por
 * padrão. Nada aqui expõe um plano só porque ele existe.
 *
 * Tabela só a partir de `lg` (com a sidebar aberta, 768 px deixa ~490 px de
 * conteúdo); abaixo disso, cards (decisão da Fase 10).
 */
export default async function DashboardPlanosPage() {
  await requireNutritionist();
  const plans = await getAdminPlans();

  const primaryLabel = (plan: (typeof plans)[number]) => {
    const primary = plan.prices.find((price) => price.isPrimary && price.active);
    if (primary) return `${primary.label} · ${formatBRL(primary.amountCents)}`;
    return plan.pendingPrimary ? "Nenhuma (site lista as opções)" : "Sem preço ativo";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Planos</h1>
        <p className="text-sm text-muted-foreground">
          Nome, composição, preços, benefícios e visibilidade no site. O plano anual existe para histórico e contratos
          manuais, sem ser ofertado publicamente.
        </p>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground" role="status">
            Nenhum plano cadastrado. O catálogo é criado por migration — verifique o banco.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards (mobile/tablet) */}
          <ul className="grid gap-3 lg:hidden">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link href={`/dashboard/planos/${plan.id}`} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Card className="transition-colors group-hover:bg-muted/40">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="font-heading text-lg">{plan.name}</CardTitle>
                        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <CardDescription>
                        {plan.code} · {plan.prices.filter((price) => price.active).length} condição(ões) ativa(s) ·{" "}
                        {plan.benefits.filter((benefit) => benefit.active).length} benefício(s)
                      </CardDescription>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant={plan.active ? "secondary" : "outline"} className="font-normal">
                          {plan.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant={plan.publiclyVisible ? "secondary" : "outline"} className="font-normal">
                          {plan.publiclyVisible ? "No site" : "Fora do site"}
                        </Badge>
                        <Badge variant={plan.availableForSale ? "secondary" : "outline"} className="font-normal">
                          {plan.availableForSale ? "À venda" : "Sem venda"}
                        </Badge>
                        {plan.pendingPrimary ? (
                          <Badge variant="outline" className="gap-1 font-normal">
                            <CircleAlert className="size-3" aria-hidden="true" />
                            Sem condição principal
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Principal: {primaryLabel(plan)}</p>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tabela (desktop) */}
          <div className="hidden lg:block">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Composição</TableHead>
                      <TableHead>Condição principal</TableHead>
                      <TableHead>Benefícios</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="sr-only">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <span className="font-medium">{plan.name}</span>
                          <span className="block text-xs text-muted-foreground">{plan.code}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[
                            plan.durationMonths ? `${plan.durationMonths} meses` : null,
                            plan.sessionsInPerson !== null ? `${plan.sessionsInPerson} presenciais` : null,
                            plan.sessionsOnline !== null ? `${plan.sessionsOnline} online` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Não definida"}
                        </TableCell>
                        <TableCell className="text-sm">{primaryLabel(plan)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {plan.benefits.filter((benefit) => benefit.active).length}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={plan.active ? "secondary" : "outline"} className="font-normal">
                              {plan.active ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant={plan.publiclyVisible ? "secondary" : "outline"} className="font-normal">
                              {plan.publiclyVisible ? "No site" : "Fora do site"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/planos/${plan.id}`} className="text-sm text-primary hover:underline">
                            Gerenciar
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="font-heading text-base">Pendências de produto</CardTitle>
          <CardDescription>
            A periodicidade das consultas por plano e a elegibilidade de agendamento por plano continuam PENDENTE DE
            DEFINIÇÃO — nada é inferido a partir da duração do plano. A consulta avulsa mantém o valor já definido
            (R$&nbsp;230,00) e pode ser alterada aqui.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
