import type { Metadata } from "next";
import Link from "next/link";
import { CircleDollarSign, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashToast } from "@/components/shared/flash-toast";
import { ChargeMethodBadge, ChargeStatusBadge, SimulatedEnvironmentNotice } from "@/components/payments/charge-badges";
import { requirePatient } from "@/lib/auth/session";
import { getPatientContracts } from "@/data/contracts";
import { getActiveChargesForInstallments, listPatientCharges } from "@/data/payment-charges";
import { getPatientBookingContext } from "@/services/scheduling";
import { getPaymentProviderStatus } from "@/services/payments/index";
import { computeInstallmentBalance, INSTALLMENT_UI_STATUS_LABEL } from "@/domain/finance/installments";
import { installmentChargeEligibility, isChargePayable, presentChargeStatus } from "@/domain/payments/charges";
import { formatBRL } from "@/lib/money";
import { formatCalendarDate, formatDateTime } from "@/lib/dates";
import { instantToDateISO } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pagamentos" };
export const dynamic = "force-dynamic";

/**
 * Pagamentos no portal (prompt Fase 13 §19/§62): plano, parcelas,
 * vencimentos, status (pago/pendente/atrasado), saldo e a ação de pagar
 * quando a parcela é elegível. Cobrança pendente e pagamento confirmado são
 * exibidos como coisas diferentes (§76).
 */
export default async function PagamentosPage() {
  const profile = await requirePatient();
  const context = await getPatientBookingContext(profile.id);
  if (!context) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-medium">Pagamentos</h1>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um cadastro de paciente. Fale com o nutricionista.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [contracts, charges, providerStatus] = await Promise.all([
    getPatientContracts(context.patientId),
    listPatientCharges(context.patientId, 20),
    Promise.resolve(getPaymentProviderStatus()),
  ]);
  const today = instantToDateISO(new Date(), context.settings.timeZone);
  const now = new Date();
  const allInstallments = contracts.flatMap((contract) => contract.installments.map((installment) => ({ contract, installment })));
  const activeCharges = await getActiveChargesForInstallments(allInstallments.map((row) => row.installment.id));
  const onlineEnabled = providerStatus.configured && providerStatus.methods.length > 0;

  const totals = contracts.reduce(
    (acc, contract) => ({
      contracted: acc.contracted + contract.financials.contractedCents,
      received: acc.received + contract.financials.receivedCents,
      pending: acc.pending + contract.financials.pendingCents,
    }),
    { contracted: 0, received: 0, pending: 0 },
  );
  const nextDue = allInstallments
    .filter(({ installment }) => computeInstallmentBalance({ amountCents: installment.amountCents, receivedCents: installment.receivedCents, status: installment.status, dueDate: installment.dueDate }, today).payable)
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate))[0];

  return (
    <div className="space-y-6">
      <FlashToast />
      <div>
        <h1 className="font-heading text-2xl font-medium">Pagamentos</h1>
        <p className="text-sm text-muted-foreground">Seu plano, as parcelas e o que já foi pago.</p>
      </div>

      {providerStatus.simulated ? <SimulatedEnvironmentNotice environment={providerStatus.environment} className="max-w-3xl" /> : null}

      {contracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CircleDollarSign className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nenhum plano contratado ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Quando você contratar um plano, as parcelas e os pagamentos aparecem aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3" data-testid="payment-summary">
            <Card className="py-3">
              <CardContent className="space-y-0.5 px-4">
                <p className="text-xs text-muted-foreground">Contratado</p>
                <p className="font-heading text-xl tabular-nums">{formatBRL(totals.contracted)}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="space-y-0.5 px-4">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="font-heading text-xl tabular-nums text-success">{formatBRL(totals.received)}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="space-y-0.5 px-4">
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="font-heading text-xl tabular-nums">{formatBRL(totals.pending)}</p>
              </CardContent>
            </Card>
          </div>

          {nextDue ? (
            <p className="text-sm text-muted-foreground">
              Próximo vencimento: <span className="font-medium text-foreground">{formatCalendarDate(nextDue.installment.dueDate)}</span> · {formatBRL(nextDue.installment.remainingCents)}
            </p>
          ) : null}

          {contracts.map((contract) => (
            <Card key={contract.id} className="max-w-3xl">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{contract.plan.name}</CardTitle>
                <CardDescription>
                  {contract.installments.length} parcela(s) · início em {formatCalendarDate(contract.startDate)}
                  {contract.status === "CANCELLED" ? " · contrato cancelado" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border" aria-label={`Parcelas do ${contract.plan.name}`}>
                  {contract.installments.map((installment) => {
                    const balance = computeInstallmentBalance(
                      { amountCents: installment.amountCents, receivedCents: installment.receivedCents, status: installment.status, dueDate: installment.dueDate },
                      today,
                    );
                    const eligibility = installmentChargeEligibility({
                      installmentStatus: installment.status,
                      contractStatus: contract.status,
                      amountCents: installment.amountCents,
                      receivedCents: installment.receivedCents,
                    });
                    const active = activeCharges.get(installment.id);
                    const activePayable = active ? isChargePayable({ status: active.status, expiresAt: active.expiresAt }, now) : false;
                    return (
                      <li key={installment.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3" data-testid="installment-row" data-status={balance.uiStatus}>
                        <div className="min-w-0">
                          <p className="font-medium">
                            Parcela {installment.number} · <span className="tabular-nums">{formatBRL(installment.amountCents)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vence em {formatCalendarDate(installment.dueDate)}
                            {balance.receivedCents > 0 && balance.remainingCents > 0 ? ` · já pago ${formatBRL(balance.receivedCents)}, restam ${formatBRL(balance.remainingCents)}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              balance.uiStatus === "PAID" ? "bg-success/10 text-success" : balance.uiStatus === "OVERDUE" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {INSTALLMENT_UI_STATUS_LABEL[balance.uiStatus]}
                          </span>
                          {activePayable && active ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/paciente/pagamentos/checkout/${active.chargeId}`}>Ver cobrança</Link>
                            </Button>
                          ) : eligibility.eligible && onlineEnabled ? (
                            <Button asChild size="sm" data-testid="pay-installment">
                              <Link href={`/paciente/pagamentos/${installment.id}`}>Pagar {formatBRL(eligibility.amountCents)}</Link>
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {!onlineEnabled && contracts.length > 0 ? (
        <p className="max-w-3xl text-sm text-muted-foreground">O pagamento online não está disponível no momento. Combine o pagamento diretamente com o nutricionista.</p>
      ) : null}

      <section aria-labelledby="historico-cobrancas" className="max-w-3xl space-y-3">
        <h2 id="historico-cobrancas" className="font-heading text-lg font-medium">
          Cobranças online
        </h2>
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança online gerada até agora.</p>
        ) : (
          <ul className="grid gap-2" aria-label="Cobranças online">
            {charges.map((charge) => {
              const status = presentChargeStatus(charge, now);
              return (
                <li key={charge.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10" data-testid="charge-row">
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums">
                      {formatBRL(charge.amountCents)}
                      {charge.installmentNumber ? <span className="font-normal text-muted-foreground"> · parcela {charge.installmentNumber}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{status === "PAID" && charge.paidAt ? `Pago em ${formatDateTime(charge.paidAt)}` : `Criada em ${formatDateTime(charge.createdAt)}`}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ChargeMethodBadge method={charge.method} />
                    <ChargeStatusBadge status={status} />
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/paciente/pagamentos/checkout/${charge.id}`}>
                        <Receipt data-icon="inline-start" />
                        Detalhes
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
