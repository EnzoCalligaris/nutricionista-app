import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaymentSimulationAllowed, paymentWebhookSecret } from "@/services/payments/index";
import { fakeProviderPaymentId, signFakeWebhook, type FakeWebhookBody } from "@/services/payments/fake-provider";
import { simulateWebhookSchema } from "@/validators/payments";

export const dynamic = "force-dynamic";

/**
 * Ferramenta de DESENVOLVIMENTO (prompt Fase 13 §68–§69): monta um evento do
 * provider fake, assina com o mesmo segredo que o verificador exige e o
 * entrega ao webhook REAL — o caminho de produção (assinatura → idempotência
 * → transição → baixa atômica) é exercitado de ponta a ponta, sem atalho.
 *
 * Indisponível em produção e quando o provider não é simulado; exige sessão
 * autenticada e só aceita cobrança que aquele usuário já poderia ver.
 */
export async function POST(request: Request) {
  if (!isPaymentSimulationAllowed()) {
    return NextResponse.json({ error: "not available" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const body = await request.json().catch(() => null);
  const parsed = simulateWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const admin = createAdminClient();
  const { data: charge } = await admin
    .from("payment_charges")
    .select("id, patient_id, nutritionist_id, provider_charge_id, amount_cents, currency, patients(profile_id)")
    .eq("id", parsed.data.chargeId)
    .maybeSingle();
  if (!charge?.provider_charge_id) return NextResponse.json({ error: "charge not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const patientProfileId = (charge.patients as { profile_id: string | null } | null)?.profile_id ?? null;
  const authorized = charge.nutritionist_id === profile.id || (profile.role === "PATIENT" && patientProfileId === profile.id);
  if (!authorized) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });

  const status = parsed.data.status;
  const payload: FakeWebhookBody = {
    event_id: `sim_${charge.id}_${status}_${Date.now()}`,
    type: "payment.updated",
    charge_id: charge.provider_charge_id,
    payment_id: status === "PAID" ? fakeProviderPaymentId(charge.id) : null,
    status,
    amount_cents: charge.amount_cents,
    currency: charge.currency,
    occurred_at: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const url = new URL("/api/webhooks/payments/fake", request.url);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment-signature": signFakeWebhook(rawBody, paymentWebhookSecret()) },
    body: rawBody,
  });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ simulated: status, webhookStatus: response.status, ...result }, { headers: { "Cache-Control": "no-store" } });
}
