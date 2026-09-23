import { NextResponse } from "next/server";
import { getPaymentProvider, PaymentProviderConfigError } from "@/services/payments/index";
import { processPaymentWebhookEvent } from "@/services/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * Webhook do gateway (prompt Fase 13 §31–§36). Ordem obrigatória:
 *
 *   1. body BRUTO (nunca parseado/re-serializado antes da assinatura — §33);
 *   2. assinatura verificada pelo adapter do provider (§32);
 *   3. só então o evento é normalizado e processado, de forma idempotente.
 *
 * Assinatura inválida ⇒ 401 e NENHUMA alteração em payments/parcelas/
 * lançamentos (§34). Sem CSRF (não é browser) e sem rate limit de usuário
 * (§87/§88): a proteção é a assinatura + a idempotência por evento.
 * A resposta nunca vaza detalhe do evento.
 */
export async function POST(request: Request, context: RouteContext<"/api/webhooks/payments/[provider]">) {
  const { provider: providerParam } = await context.params;
  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    console.warn(`[payments:webhook] provider não configurado: ${error instanceof PaymentProviderConfigError ? "CONFIG" : "ERRO"}`);
    return NextResponse.json({ error: "provider not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (providerParam !== provider.id) {
    console.warn(`[payments:webhook] provider da rota (${providerParam.slice(0, 20)}) diferente do configurado`);
    return NextResponse.json({ error: "unknown provider" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const rawBody = await request.text();
  const verification = provider.verifyWebhook(rawBody, request.headers);
  if (!verification.valid) {
    console.warn(`[payments:webhook] assinatura recusada: ${verification.reason}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const event = provider.parseWebhook(rawBody);
  if (!event) {
    console.warn("[payments:webhook] corpo não reconhecido");
    return NextResponse.json({ error: "unsupported event" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await processPaymentWebhookEvent(event);
    // 200 sempre que o evento foi registrado: o provider não deve reenviar um
    // evento que já tratamos (inclusive divergências, que viram revisão).
    return NextResponse.json({ received: true, outcome: result.outcome }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[payments:webhook] falha ao processar: ${error instanceof Error ? error.message : "erro"}`);
    return NextResponse.json({ error: "processing failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
