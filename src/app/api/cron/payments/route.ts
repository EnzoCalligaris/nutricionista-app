import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/auth/cron";
import { getServerEnv } from "@/lib/env";
import { detectPaidWithoutPayment } from "@/services/payments/reconciliation";
import { expireStaleCharges, reconcilePendingCharges } from "@/services/payments/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Job de pagamentos (prompt Fase 13 §56–§57): expira cobranças vencidas e
 * reconcilia as pendentes — inclusive o caso "webhook perdido", consultando
 * o provider quando o adapter real permitir. Mesma autenticação do job de
 * notificações (`Authorization: Bearer $CRON_SECRET`, comparação em tempo
 * constante, fail closed em produção). Idempotente e seguro para invocação
 * duplicada.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const auth = authorizeCronRequest({
    authorization: request.headers.get("authorization"),
    secret: env.CRON_SECRET,
    isProduction: process.env.NODE_ENV === "production",
    devHeader: request.headers.get("x-cron-dev"),
  });
  if (!auth.ok) {
    console.warn(`[cron] payments recusado: ${auth.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const startedAt = Date.now();
  try {
    const expire = await expireStaleCharges();
    const reconcile = await reconcilePendingCharges({ limit: 50 });
    const paidWithoutPayment = await detectPaidWithoutPayment();
    const result = { mode: auth.mode, ...expire, ...reconcile, paidWithoutPayment, durationMs: Date.now() - startedAt };
    console.info(`[cron] payments: ${JSON.stringify(result)}`);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[cron] payments falhou: ${error instanceof Error ? error.message : "erro"}`);
    return NextResponse.json({ error: "job failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
