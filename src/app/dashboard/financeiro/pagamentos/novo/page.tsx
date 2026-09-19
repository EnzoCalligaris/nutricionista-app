import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PaymentForm } from "@/components/finance/payment-form";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { listOpenInstallments } from "@/data/payments";
import { getFinancialCategories } from "@/data/financial";
import { getSchedulingSettings } from "@/data/scheduling";
import { instantToDateISO } from "@/lib/timezone";

export const metadata: Metadata = { title: "Registrar pagamento" };
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeReturnTo(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/dashboard/") || value.startsWith("//")) return fallback;
  return value;
}

/**
 * Registrar pagamento manual (prompt Fase 7 §22–§28). `?paciente=` é
 * obrigatório (escopado ao nutricionista), `?parcela=` pré-seleciona a
 * parcela e `?voltar=` define o retorno. A chave de idempotência nasce aqui
 * no servidor: um reenvio do mesmo formulário nunca cria dois pagamentos.
 */
export default async function NovoPagamentoPage({ searchParams }: PageProps<"/dashboard/financeiro/pagamentos/novo">) {
  const nutritionist = await requireNutritionist();
  const raw = await searchParams;
  const patientId = z.guid().safeParse(firstParam(raw.paciente));
  if (!patientId.success) notFound();

  const patient = await getPatientById(nutritionist.id, patientId.data);
  if (!patient) notFound();

  const [installments, categories, settings] = await Promise.all([
    listOpenInstallments(patient.id),
    getFinancialCategories(),
    getSchedulingSettings(nutritionist.id),
  ]);
  const today = instantToDateISO(new Date(), settings.timeZone);
  const parcela = z.guid().safeParse(firstParam(raw.parcela));
  const initialInstallmentId = parcela.success && installments.some((installment) => installment.id === parcela.data) ? parcela.data : null;
  const returnTo = safeReturnTo(firstParam(raw.voltar), `/dashboard/pacientes/${patient.id}?tab=financeiro`);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/dashboard/financeiro", label: "Financeiro" },
          { href: `/dashboard/pacientes/${patient.id}?tab=financeiro`, label: patient.full_name },
          { label: "Registrar pagamento" },
        ]}
      />

      <div>
        <h1 className="font-heading text-2xl font-medium">Registrar pagamento</h1>
        <p className="text-sm text-muted-foreground">O pagamento dá baixa na parcela e gera a receita correspondente, tudo em uma única operação.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados do pagamento</CardTitle>
          <CardDescription>Pagamento parcial é permitido; valores acima do restante da parcela são recusados.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentForm
            patient={{ id: patient.id, name: patient.full_name }}
            installments={installments}
            categories={categories}
            initialInstallmentId={initialInstallmentId}
            idempotencyKey={randomUUID()}
            today={today}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
