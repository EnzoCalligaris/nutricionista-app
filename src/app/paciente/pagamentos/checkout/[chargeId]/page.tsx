import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChargeMethodBadge, ChargeStatusBadge, SimulatedEnvironmentNotice } from "@/components/payments/charge-badges";
import { ChargeWatcher } from "@/components/payments/charge-watcher";
import { PixPanel } from "@/components/payments/pix-panel";
import { requirePatient } from "@/lib/auth/session";
import { getChargeById } from "@/data/payment-charges";
import { getPatientBookingContext } from "@/services/scheduling";
import { isPaymentSimulationAllowed } from "@/services/payments/index";
import { presentChargeStatus } from "@/domain/payments/charges";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { chargeIdSchema } from "@/validators/payments";

export const metadata: Metadata = { title: "Pagamento" };
export const dynamic = "force-dynamic";

/**
 * Checkout da cobrança (prompt Fase 13 §29–§30/§63/§65–§66).
 *
 * Nada aqui declara pagamento aprovado: enquanto o servidor não tiver a
 * confirmação (webhook assinado), a tela diz "estamos confirmando". O
 * Pix mostra QR + copia e cola; o cartão leva ao ambiente do provedor —
 * a aplicação nunca pede número de cartão ou CVV.
 */
export default async function CheckoutPage({ params }: PageProps<"/paciente/pagamentos/checkout/[chargeId]">) {
  const profile = await requirePatient();
  const { chargeId } = await params;
  const parsed = chargeIdSchema.safeParse(chargeId);
  if (!parsed.success) notFound();

  const context = await getPatientBookingContext(profile.id);
  const charge = await getChargeById(parsed.data);
  // RLS já limita o SELECT; a checagem explícita evita qualquer brecha de leitura cruzada.
  if (!charge || !context || charge.patientId !== context.patientId) notFound();

  const status = presentChargeStatus(charge, new Date());
  const simulated = charge.providerEnvironment !== "production";
  const qrSvg = charge.method === "PIX" && charge.pixPayload && status === "PENDING" ? await QRCode.toString(charge.pixPayload, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/paciente/pagamentos">
            <ArrowLeft data-icon="inline-start" />
            Pagamentos
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-medium">{status === "PAID" ? "Pagamento confirmado" : "Pagamento"}</h1>
      </div>

      {simulated ? <SimulatedEnvironmentNotice environment={charge.providerEnvironment} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-heading text-lg tabular-nums">{formatBRL(charge.amountCents)}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <ChargeMethodBadge method={charge.method} />
              <ChargeStatusBadge status={status} />
            </div>
          </div>
          <CardDescription>
            {charge.installmentNumber ? `Parcela ${charge.installmentNumber}` : "Pagamento"} · cobrança criada em {formatDateTime(charge.createdAt)}
            {charge.expiresAt && status === "PENDING" ? ` · válida até ${formatDateTime(charge.expiresAt)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {status === "PAID" ? (
            <div className="space-y-2" data-testid="charge-paid">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-5" aria-hidden="true" />
                Recebemos seu pagamento.
              </p>
              <p className="text-sm text-muted-foreground">
                Pago em {formatDateTime(charge.paidAt)}. A parcela já consta como quitada no seu plano. Este comprovante não é um recibo fiscal.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/paciente/pagamentos">Ver meus pagamentos</Link>
              </Button>
            </div>
          ) : status === "EXPIRED" || status === "CANCELLED" || status === "FAILED" ? (
            <div className="space-y-3" data-testid="charge-closed">
              <p className="font-medium">{status === "EXPIRED" ? "Esta cobrança expirou." : status === "CANCELLED" ? "Esta cobrança foi cancelada." : "Não foi possível concluir este pagamento."}</p>
              <p className="text-sm text-muted-foreground">Você pode gerar uma nova cobrança para a mesma parcela.</p>
              {charge.installmentId ? (
                <Button asChild size="sm" data-testid="new-charge">
                  <Link href={`/paciente/pagamentos/${charge.installmentId}`}>Gerar nova cobrança</Link>
                </Button>
              ) : null}
            </div>
          ) : charge.method === "PIX" && qrSvg && charge.pixPayload ? (
            <PixPanel qrSvg={qrSvg} payload={charge.pixPayload} simulated={simulated} />
          ) : charge.method === "CARD" ? (
            <div className="space-y-3">
              {charge.checkoutUrl ? (
                <>
                  <p className="text-sm">Você será levado ao ambiente seguro do provedor para informar os dados do cartão.</p>
                  <Button asChild size="lg">
                    <a href={charge.checkoutUrl} rel="noopener noreferrer">
                      <CreditCard data-icon="inline-start" />
                      Abrir pagamento seguro
                    </a>
                  </Button>
                </>
              ) : (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Neste ambiente de demonstração nenhum dado de cartão é solicitado — o pagamento é confirmado por um evento do provedor, como aconteceria de verdade.
                </p>
              )}
            </div>
          ) : null}

          <ChargeWatcher chargeId={charge.id} status={status} canSimulate={isPaymentSimulationAllowed()} />
        </CardContent>
      </Card>
    </div>
  );
}
