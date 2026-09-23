import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireNutritionist } from "@/lib/auth/session";
import { ONLINE_METHOD_LABEL } from "@/domain/payments/charges";
import { APPOINTMENT_CHARGE_POLICY } from "@/domain/finance/definitions";
import { getPaymentProviderStatus } from "@/services/payments/index";

export const metadata: Metadata = { title: "Configurações de pagamento" };
export const dynamic = "force-dynamic";

/**
 * Configurações de pagamento (prompt Fase 13 §77–§78): provedor, ambiente,
 * métodos realmente habilitados e webhook. Nenhum segredo aparece aqui e
 * nenhuma chave é editável por esta tela — credenciais vivem apenas nas
 * variáveis de ambiente do servidor.
 */
export default async function ConfiguracoesPagamentosPage() {
  await requireNutritionist();
  const status = getPaymentProviderStatus();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard/configuracoes" className="hover:underline">
            Configurações
          </Link>{" "}
          / Pagamentos
        </p>
        <h1 className="font-heading text-2xl font-medium">Pagamentos online</h1>
        <p className="text-sm text-muted-foreground">Provedor, métodos disponíveis no checkout do paciente e recebimento de confirmações.</p>
      </div>

      <Card className="max-w-3xl" data-testid="payment-provider-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-heading text-lg">Provedor</CardTitle>
            {status.configured ? (
              status.simulated ? (
                <Badge variant="outline" className="border-transparent bg-warning/15 text-warning-foreground">
                  <FlaskConical data-icon="inline-start" />
                  Simulado
                </Badge>
              ) : (
                <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                  <CheckCircle2 data-icon="inline-start" />
                  Configurado
                </Badge>
              )
            ) : (
              <Badge variant="destructive">
                <CircleAlert data-icon="inline-start" />
                Não configurado
              </Badge>
            )}
          </div>
          <CardDescription>
            Provedor: <span className="font-mono">{status.provider}</span> · ambiente: <span className="font-mono">{status.environment}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            {status.simulated
              ? "Nenhuma cobrança real é criada e nenhum valor é movimentado: o checkout, o Pix e o cartão são simulados, e as confirmações vêm de eventos assinados de teste. O gateway real (Mercado Pago, Asaas, Pagar.me…) ainda não foi definido — quando for, entra como adapter e estas informações mudam sozinhas."
              : status.configured
                ? "Cobranças reais habilitadas. Confira sempre o painel do provedor em caso de divergência."
                : (status.problem ?? "Configuração incompleta no servidor.")}
          </p>

          <div>
            <p className="font-medium">Métodos habilitados no checkout</p>
            {status.methods.length === 0 ? (
              <p className="text-muted-foreground">Nenhum método disponível — o paciente não vê a opção de pagar online.</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-2">
                {status.methods.map((method) => (
                  <li key={method}>
                    <Badge variant="secondary">{ONLINE_METHOD_LABEL[method]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              O checkout mostra apenas o que o provedor realmente oferece. <span className="font-medium">Cartão de débito</span> continua PENDENTE DE DEFINIÇÃO: só aparecerá se o gateway escolhido
              suportar. Dinheiro e transferência seguem como pagamento manual, registrado por você no financeiro.
            </p>
          </div>

          <div>
            <p className="font-medium">Webhook</p>
            <p className="text-muted-foreground">
              {status.webhookConfigured ? "Segredo de assinatura configurado no servidor." : "Sem segredo configurado: em produção o recebimento de confirmações fica bloqueado."} Endpoint:{" "}
              <span className="font-mono text-xs">/api/webhooks/payments/{status.provider}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Um pagamento só é confirmado por evento assinado do provedor (ou consulta server-side) — nunca pelo retorno do navegador.
            </p>
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Chaves e segredos ficam apenas nas variáveis de ambiente do servidor. O sistema nunca recebe, guarda ou registra número de cartão, CVV ou senha: quando houver cartão, os dados vão direto ao
            ambiente seguro do provedor.
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-3xl border-dashed">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Cobrança de consulta avulsa</CardTitle>
          <CardDescription>Quando uma consulta avulsa vira cobrança.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Política atual: <span className="font-medium text-foreground">{APPOINTMENT_CHARGE_POLICY === "MANUAL" ? "manual" : APPOINTMENT_CHARGE_POLICY}</span> — agendar, confirmar ou realizar uma
            consulta não gera cobrança automática. O pagamento da consulta avulsa é registrado por você no financeiro.
          </p>
          <p>Gerar cobrança online automaticamente ao agendar continua PENDENTE DE DEFINIÇÃO: precisa de decisão comercial antes de ser ligado.</p>
        </CardContent>
      </Card>
    </div>
  );
}
