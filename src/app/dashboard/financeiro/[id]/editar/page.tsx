import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { TransactionForm } from "@/components/finance/transaction-form";
import { updateTransactionAction } from "@/actions/finance";
import { requireNutritionist } from "@/lib/auth/session";
import { getFinancialCategories, getTransactionById } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
import { isTransactionEditable } from "@/domain/finance/definitions";
import { transactionIdSchema } from "@/validators/finance";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Editar lançamento" };
export const dynamic = "force-dynamic";

/**
 * Edição de lançamento manual (prompt Fase 7 §18). Lançamentos gerados por
 * pagamento não são editáveis: a página redireciona para a listagem e o
 * banco também recusa (trigger).
 */
export default async function EditarLancamentoPage({ params }: PageProps<"/dashboard/financeiro/[id]/editar">) {
  const nutritionist = await requireNutritionist();
  const { id } = await params;
  const parsedId = transactionIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const settings = await getSchedulingSettings(nutritionist.id);
  const today = instantToDateISO(new Date(), settings.timeZone);
  const [transaction, categories] = await Promise.all([getTransactionById(nutritionist.id, parsedId.data, today), getFinancialCategories()]);
  if (!transaction) notFound();
  if (!isTransactionEditable(transaction.origin, transaction.status)) redirect("/dashboard/financeiro");

  const action = updateTransactionAction.bind(null, transaction.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ href: "/dashboard/financeiro", label: "Financeiro" }, { label: "Editar lançamento" }]} />

      <div>
        <h1 className="font-heading text-2xl font-medium">Editar lançamento</h1>
        <p className="text-sm text-muted-foreground">{transaction.description}</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do lançamento</CardTitle>
          <CardDescription>Alterações ficam registradas na auditoria.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionForm
            mode="edit"
            action={action}
            categories={categories}
            cancelHref="/dashboard/financeiro"
            initial={{
              description: transaction.description,
              type: transaction.type,
              categoryId: transaction.categoryId ?? "",
              amount: (transaction.amountCents / 100).toFixed(2).replace(".", ","),
              occurredOn: transaction.occurredOn,
              dueOn: transaction.dueOn ?? "",
              paymentMethod: transaction.paymentMethod ?? "",
              status: transaction.status === "PENDING" ? "PENDING" : "CONFIRMED",
              notes: transaction.notes ?? "",
              patient: transaction.patientId && transaction.patientName ? { id: transaction.patientId, name: transaction.patientName } : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
