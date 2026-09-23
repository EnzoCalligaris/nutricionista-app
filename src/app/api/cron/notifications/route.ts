import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/auth/cron";
import { getServerEnv } from "@/lib/env";
import { generateDeliveries, processDeliveries } from "@/services/notifications/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Job de notificações (prompt Fase 12 §50–§63), chamado pelo scheduler
 * (Vercel Cron: `vercel.json`; ou qualquer cron externo com o mesmo header).
 * Duas responsabilidades separadas por `?task=`:
 *   - `generate`: eventos devidos → entregas (inclui lembretes de 5 dias que
 *     entraram na janela — o trigger já os agendou com `scheduled_for`)
 *   - `process`: entregas elegíveis → provider (claim atômico, lote limitado,
 *     recuperação de PROCESSING travado)
 *   - sem `task` (default): os dois em sequência.
 * Idempotente e seguro para invocação duplicada/concorrente (a Vercel pode
 * disparar mais de uma vez; dois workers nunca enviam a mesma entrega).
 * Segredo nunca logado; resposta só com contagens.
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
    console.warn(`[cron] notifications recusado: ${auth.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const task = url.searchParams.get("task") ?? "all";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);
  const startedAt = Date.now();
  try {
    const result: Record<string, unknown> = { task, mode: auth.mode };
    if (task === "generate" || task === "all") result.generate = await generateDeliveries({ limit: Math.max(limit, 100) });
    if (task === "process" || task === "all") result.process = await processDeliveries({ limit });
    if (task !== "generate" && task !== "process" && task !== "all") return NextResponse.json({ error: "unknown task" }, { status: 400 });
    result.durationMs = Date.now() - startedAt;
    console.info(`[cron] notifications ${task}: ${JSON.stringify(result)}`);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[cron] notifications ${task} falhou: ${error instanceof Error ? error.message : "erro"}`);
    return NextResponse.json({ error: "job failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
