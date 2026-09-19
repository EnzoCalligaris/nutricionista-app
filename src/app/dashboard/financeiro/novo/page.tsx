import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { TransactionForm } from "@/components/finance/transaction-form";
import { createTransactionAction } from "@/actions/finance";
import { requireNutritionist } from "@/lib/auth/session";
import { getFinancialCategories } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Novo lançamento" };
export const dynamic = "force-dynamic";

/** Lançamento manual de receita ou despesa (prompt Fase 7 §16–§19). */
export default async function NovoLancamentoPage() {
  const nutritionist = await requireNutritionist();
  const [categories, settings] = await Promise.all([getFinancialCategories(), getSchedulingSettings(nutritionist.id)]);
  const today = instantToDateISO(new Date(), settings.timeZone);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/dashboard/financeiro", label: "Financeiro" }, { label: "Novo lançamento" }]} />

      <div>
        <h1 className="font-heading text-2xl font-medium">Novo lançamento</h1>
        <p className="text-sm text-muted-foreground">Receita ou despesa manual. Pagamentos de parcelas entram por &ldquo;Registrar pagamento&rdquo;.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do lançamento</CardTitle>
          <CardDescription>Valores em reais (ex.: 230,00). Lançamentos manuais podem ser editados ou cancelados depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            mode="create"
            action={createTransactionAction}
            categories={categories}
            cancelHref="/dashboard/financeiro"
            initial={{
              description: "",
              type: "INCOME",
              categoryId: "",
              amount: "",
              occurredOn: today,
              dueOn: "",
              paymentMethod: "",
              status: "CONFIRMED",
              notes: "",
              patient: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
