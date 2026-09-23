import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, QrCode } from "lucide-react";
import { createCheckoutAction } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulatedEnvironmentNotice } from "@/components/payments/charge-badges";
import { requirePatient } from "@/lib/auth/session";
import { getPatientContracts } from "@/data/contracts";
import { getActiveChargesForInstallments } from "@/data/payment-charges";
import { getPatientBookingContext } from "@/services/scheduling";
import { getPaymentProviderStatus } from "@/services/payments/index";
import { installmentChargeEligibility, isChargePayable, ONLINE_METHOD_LABEL } from "@/domain/payments/charges";
import { domainErrorMessage, isDomainErrorCode } from "@/lib/errors/domain";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate } from "@/lib/dates";
import { installmentIdSchema } from "@/validators/payments";

export const metadata: Metadata = { title: "Pagar parcela" };
export const dynamic = "force-dynamic";

const METHOD_HINT: Record<"PIX" | "CARD", string> = {
  PIX: "QR Code e código copia e cola. A confirmação costuma ser em poucos segundos.",
  CARD: "Você é levado ao ambiente seguro do provedor de pagamento. Nós nunca recebemos os dados do seu cartão.",
};

/**
 * Resumo antes de pagar (prompt Fase 13 §63–§64): descrição, valor,
 * vencimento e o método. O valor mostrado é o saldo derivado no servidor —
 * o formulário envia apenas a referência da parcela e o método escolhido.
 */
export default async function PagarParcelaPage({ params, searchParams }: PageProps<"/paciente/pagamentos/[installmentId]">) {
  const profile = await requirePatient();
  const { installmentId } = await params;
  const parsed = installmentIdSchema.safeParse(installmentId);
  if (!parsed.success) notFound();

  const context = await getPatientBookingContext(profile.id);
  if (!context) notFound();
  const contracts = await getPatientContracts(context.patientId);
  const found = contracts.flatMap((contract) => contract.installments.map((installment) => ({ contract, installment }))).find((row) => row.installment.id === parsed.data);
  if (!found) notFound();

  const { erro } = await searchParams;
  const errorCode = Array.isArray(erro) ? erro[0] : erro;
  const providerStatus = getPaymentProviderStatus();
  const eligibility = installmentChargeEligibility({
    installmentStatus: found.installment.status,
    contractStatus: found.contract.status,
    amountCents: found.installment.amountCents,
    receivedCents: found.installment.receivedCents,
  });
  const activeCharges = await getActiveChargesForInstallments([parsed.data]);
  const active = activeCharges.get(parsed.data);
  const activePayable = active ? isChargePayable({ status: active.status, expiresAt: active.expiresAt }, new Date()) : false;

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/paciente/pagamentos">
            <ArrowLeft data-icon="inline-start" />
            Pagamentos
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-medium">Pagar parcela {found.installment.number}</h1>
      </div>

      {providerStatus.simulated ? <SimulatedEnvironmentNotice environment={providerStatus.environment} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Resumo</CardTitle>
          <CardDescription>Confira antes de continuar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Descrição</dt>
              <dd className="font-medium">
                {found.contract.plan.name} — parcela {found.installment.number}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vencimento</dt>
              <dd className="font-medium">{formatCalendarDate(found.installment.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor da parcela</dt>
              <dd className="font-medium tabular-nums">{formatBRL(found.installment.amountCents)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">A pagar agora</dt>
              <dd className="font-heading text-xl tabular-nums" data-testid="amount-to-pay">
                {formatBRL(eligibility.eligible ? eligibility.amountCents : 0)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Sem taxas adicionais. O valor é o saldo em aberto desta parcela.</p>
        </CardContent>
      </Card>

      {errorCode ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {isDomainErrorCode(errorCode) ? domainErrorMessage(errorCode) : domainErrorMessage("UNKNOWN")}
        </p>
      ) : null}

      {!eligibility.eligible ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-6 text-center">
            <p className="font-medium">{eligibility.reason === "ALREADY_PAID" || eligibility.reason === "NO_BALANCE" ? "Esta parcela já está paga." : "Esta parcela não pode ser paga online."}</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/paciente/pagamentos">Voltar para pagamentos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : activePayable && active ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-center">
            <p className="font-medium">Já existe uma cobrança aberta para esta parcela.</p>
            <Button asChild size="sm">
              <Link href={`/paciente/pagamentos/checkout/${active.chargeId}`}>Ver cobrança em aberto</Link>
            </Button>
          </CardContent>
        </Card>
      ) : providerStatus.methods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            O pagamento online não está disponível no momento. Combine o pagamento com o nutricionista.
          </CardContent>
        </Card>
      ) : (
        <form action={createCheckoutAction} className="space-y-4">
          <input type="hidden" name="installmentId" value={parsed.data} />
          <fieldset className="space-y-2">
            <legend className="mb-2 font-heading text-lg font-medium">Como você quer pagar?</legend>
            {providerStatus.methods.map((method, index) => (
              <label key={method} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5">
                <input type="radio" name="method" value={method} defaultChecked={index === 0} className="mt-0.5 size-4 accent-primary" required />
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    {method === "PIX" ? <QrCode className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                    {ONLINE_METHOD_LABEL[method]}
                  </span>
                  <span className="block text-muted-foreground">{METHOD_HINT[method]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" size="lg" className="w-full sm:w-auto" data-testid="start-checkout">
            Continuar para o pagamento
          </Button>
          <p className="text-xs text-muted-foreground">Cartão de débito e outros meios não aparecem porque o provedor configurado não os oferece.</p>
        </form>
      )}
    </div>
  );
}
