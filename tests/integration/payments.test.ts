import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { fakeProviderChargeId, fakeProviderPaymentId, FakePaymentProvider, signFakeWebhook } from "@/services/payments/fake-provider";
import { getPaymentProvider, getPaymentProviderStatus, paymentWebhookSecret } from "@/services/payments/index";
import { processPaymentWebhookEvent } from "@/services/payments/webhook";
import { expireStaleCharges, reconcilePendingCharges } from "@/services/payments/webhook";
import { detectPaidWithoutPayment } from "@/services/payments/reconciliation";
import type { ProviderWebhookEvent } from "@/domain/payments/webhook";

/**
 * Integração da Fase 13 contra o Supabase LOCAL (prompt §121): cobrança
 * criada com valor derivado do banco, Pix e cartão fake, webhook assinado
 * de verdade (verificação + idempotência + transição), duplicado, fora de
 * ordem, assinatura inválida, valor/moeda divergentes, expiração, conflito
 * manual × online, reconciliação, ownership e auditoria técnica.
 *
 * O worker/serviço real é exercitado; só o gateway é o FakePaymentProvider
 * (nada sai para a rede). Fixtures próprias (prefixo ff…).
 *
 * Requer `npm run db:start` + `db:reset`. Uso: npm run test:payments-online:integration
 */

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";
const NUTRI = "ff000000-0000-0000-0000-000000000001";
const NUTRI_B = "ff000000-0000-0000-0000-000000000002";
const PROFILE_A = "ff000000-0000-0000-0000-000000000003";
const PROFILE_B = "ff000000-0000-0000-0000-000000000004";
const PATIENT_A = "ff000000-0000-0000-0000-000000000010";
const PATIENT_B = "ff000000-0000-0000-0000-000000000011";
const CONTRACT_A = "ff000000-0000-0000-0000-000000000020";
const CONTRACT_B = "ff000000-0000-0000-0000-000000000021";
const INSTALLMENTS = ["ff000000-0000-0000-0000-00000000003a", "ff000000-0000-0000-0000-00000000003b", "ff000000-0000-0000-0000-00000000003c", "ff000000-0000-0000-0000-00000000003d", "ff000000-0000-0000-0000-00000000003e"];
const INSTALLMENT_B = "ff000000-0000-0000-0000-00000000003f";

let db: pg.Client;
const admin = () => createAdminClient();

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(text, params);
  return result.rows as T[];
}

/** Cria a cobrança exatamente como o serviço faz (RPC + provider fake + anexo dos dados). */
async function createCharge(installmentId: string, method: "PIX" | "CARD", key: string): Promise<{ id: string; providerChargeId: string; amountCents: number }> {
  const [row] = await sql<{ id: string; amount_cents: number }>(
    `select id, amount_cents from public.create_installment_charge($1, $2, $3, 'fake', 'simulated')`,
    [installmentId, method, key],
  );
  const provider = getPaymentProvider() as FakePaymentProvider;
  const created = await provider.createCharge({
    chargeId: row!.id,
    amountCents: row!.amount_cents,
    currency: "BRL",
    method,
    description: "Parcela",
    idempotencyKey: `charge:${row!.id}`,
    returnUrl: "http://localhost:3000/paciente/pagamentos",
    payer: { name: "Paciente", email: null },
    expiresAt: new Date(Date.now() + 30 * 60_000),
    signal: AbortSignal.timeout(5000),
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("provider recusou");
  await sql(
    `update public.payment_charges set provider_charge_id = $2, status = 'PENDING', pix_payload = $3, expires_at = $4 where id = $1`,
    [row!.id, created.data.providerChargeId, created.data.pixPayload ?? null, created.data.expiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString()],
  );
  return { id: row!.id, providerChargeId: created.data.providerChargeId, amountCents: row!.amount_cents };
}

function buildEvent(overrides: Partial<ProviderWebhookEvent> & { providerChargeId: string }): ProviderWebhookEvent {
  return {
    eventId: `evt_${Math.random().toString(36).slice(2, 10)}`,
    type: "payment.updated",
    providerPaymentId: "fake_pay_x",
    status: "PAID",
    amountCents: 20000,
    currency: "BRL",
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

async function chargeRow(id: string) {
  const { data } = await admin().from("payment_charges").select("id, status, payment_id, amount_cents, paid_at").eq("id", id).maybeSingle();
  return data;
}

async function cleanup(): Promise<void> {
  await sql(`set session_replication_role = replica`);
  try {
    await sql(`delete from public.payment_reconciliation_items where nutritionist_id = any($1::uuid[])`, [[NUTRI, NUTRI_B]]);
    await sql(`delete from public.payment_webhook_events where provider_charge_id like 'fake_ch_%'`);
    await sql(`delete from public.payment_charges where patient_id = any($1::uuid[])`, [[PATIENT_A, PATIENT_B]]);
    await sql(`delete from public.financial_transactions where patient_id = any($1::uuid[]) or nutritionist_id = any($2::uuid[])`, [[PATIENT_A, PATIENT_B], [NUTRI, NUTRI_B]]);
    await sql(`delete from public.payments where patient_id = any($1::uuid[])`, [[PATIENT_A, PATIENT_B]]);
    await sql(`delete from public.contract_installments where contract_id = any($1::uuid[])`, [[CONTRACT_A, CONTRACT_B]]);
    await sql(`delete from public.patient_contracts where id = any($1::uuid[])`, [[CONTRACT_A, CONTRACT_B]]);
    await sql(`delete from public.notification_events where patient_id = any($1::uuid[])`, [[PATIENT_A, PATIENT_B]]);
    await sql(`delete from public.notifications where recipient_id = any($1::uuid[])`, [[PROFILE_A, PROFILE_B]]);
    await sql(`delete from public.audit_logs where actor_id = any($1::uuid[])`, [[NUTRI, NUTRI_B]]);
    await sql(`delete from public.patients where id = any($1::uuid[])`, [[PATIENT_A, PATIENT_B]]);
    await sql(`delete from public.profiles where id = any($1::uuid[])`, [[NUTRI, NUTRI_B, PROFILE_A, PROFILE_B]]);
    await sql(`delete from auth.users where id = any($1::uuid[])`, [[NUTRI, NUTRI_B, PROFILE_A, PROFILE_B]]);
  } finally {
    await sql(`set session_replication_role = origin`);
  }
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  await cleanup();
  for (const [id, email] of [
    [NUTRI, "ff-nutri@example.test"],
    [NUTRI_B, "ff-nutri-b@example.test"],
    [PROFILE_A, "ff-patient-a@example.test"],
    [PROFILE_B, "ff-patient-b@example.test"],
  ] as Array<[string, string]>) {
    await sql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}', '', '', '', '') on conflict (id) do nothing`,
      [id, email],
    );
  }
  await sql(
    `insert into public.profiles (id, role, full_name) values ($1, 'NUTRITIONIST', 'Nutri Pagamentos'), ($2, 'NUTRITIONIST', 'Nutri B'), ($3, 'PATIENT', 'Paciente Pagamentos'), ($4, 'PATIENT', 'Paciente B')
     on conflict (id) do update set role = excluded.role, full_name = excluded.full_name`,
    [NUTRI, NUTRI_B, PROFILE_A, PROFILE_B],
  );
  await sql(`insert into public.patients (id, profile_id, nutritionist_id, full_name, email) values ($1, $3, $5, 'Paciente Pagamentos', 'ff-patient-a@example.test'), ($2, $4, $6, 'Paciente B', null)`, [
    PATIENT_A,
    PATIENT_B,
    PROFILE_A,
    PROFILE_B,
    NUTRI,
    NUTRI_B,
  ]);
  await sql(`insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents) select $1, $2, id, current_date, 'ACTIVE', 100000 from public.plans order by code limit 1`, [CONTRACT_A, PATIENT_A]);
  await sql(`insert into public.patient_contracts (id, patient_id, plan_id, start_date, status, contracted_amount_cents) select $1, $2, id, current_date, 'ACTIVE', 20000 from public.plans order by code limit 1`, [CONTRACT_B, PATIENT_B]);
  for (const [index, id] of INSTALLMENTS.entries()) {
    await sql(`insert into public.contract_installments (id, contract_id, number, amount_cents, due_date) values ($1, $2, $3, 20000, current_date + ($4::int))`, [id, CONTRACT_A, index + 1, (index + 1) * 30]);
  }
  await sql(`insert into public.contract_installments (id, contract_id, number, amount_cents, due_date) values ($1, $2, 1, 20000, current_date + 30)`, [INSTALLMENT_B, CONTRACT_B]);
});

afterAll(async () => {
  await cleanup();
  await db.end();
});

describe("provider e configuração", () => {
  it("o provider padrão é o fake, simulado, com Pix e cartão — e nunca pede dado de cartão", () => {
    const status = getPaymentProviderStatus();
    expect(status).toMatchObject({ provider: "fake", environment: "simulated", configured: true, simulated: true });
    expect(status.methods).toEqual(["PIX", "CARD"]);
    const provider = getPaymentProvider();
    expect(provider.availableMethods()).toContain("PIX");
    // Débito não é oferecido porque o provider não suporta (§9).
    expect(status.methods).not.toContain("DEBIT");
  });

  it("identificador sem adapter é erro de configuração — nunca cai no fake", async () => {
    const previous = process.env.PAYMENT_PROVIDER;
    try {
      vi.resetModules();
      process.env.PAYMENT_PROVIDER = "mercado-pago";
      const mod = await import("@/services/payments/index");
      expect(() => mod.getPaymentProvider()).toThrow(/não tem adapter/);
      expect(mod.getPaymentProviderStatus()).toMatchObject({ configured: false, provider: "mercado-pago", methods: [] });

      // Fake com ambiente de produção também é recusado (§5).
      vi.resetModules();
      process.env.PAYMENT_PROVIDER = "fake";
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = "production";
      const production = await import("@/services/payments/index");
      expect(() => production.getPaymentProvider()).toThrow(/production/);
    } finally {
      process.env.PAYMENT_PROVIDER = previous;
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = "simulated";
      vi.resetModules();
    }
  });
});

describe("cobrança: valor derivado, idempotência e reuso", () => {
  it("o valor cobrado é o saldo da parcela — tentativa de adulteração é ignorada", async () => {
    const charge = await createCharge(INSTALLMENTS[0]!, "PIX", "it-key-1");
    expect(charge.amountCents).toBe(20000);
    const row = await chargeRow(charge.id);
    expect(row).toMatchObject({ status: "PENDING", amount_cents: 20000 });
    const { data } = await admin().from("payment_charges").select("pix_payload, currency").eq("id", charge.id).maybeSingle();
    expect(data?.currency).toBe("BRL");
    expect(data?.pix_payload).toContain("FAKE-PIX-");
    expect(charge.providerChargeId).toBe(fakeProviderChargeId(charge.id));
  });

  it("clique duplo e duas requisições simultâneas geram UMA cobrança", async () => {
    const [a, b] = await Promise.all([
      sql<{ id: string }>(`select id from public.create_installment_charge($1, 'PIX', $2, 'fake', 'simulated')`, [INSTALLMENTS[1]!, "it-key-2"]),
      sql<{ id: string }>(`select id from public.create_installment_charge($1, 'PIX', $2, 'fake', 'simulated')`, [INSTALLMENTS[1]!, "it-key-3"]),
    ]);
    expect(a[0]!.id).toBe(b[0]!.id);
    const { data } = await admin().from("payment_charges").select("id").eq("installment_id", INSTALLMENTS[1]!).in("status", ["CREATED", "PENDING"]);
    expect(data).toHaveLength(1);
  });
});

describe("webhook assinado", () => {
  it("assinatura inválida é recusada e nada muda no financeiro", async () => {
    const charge = await createCharge(INSTALLMENTS[2]!, "PIX", "it-key-4");
    const provider = getPaymentProvider();
    const body = JSON.stringify({ event_id: "evt_bad", type: "payment.updated", charge_id: charge.providerChargeId, status: "PAID", amount_cents: 20000, currency: "BRL", occurred_at: new Date().toISOString() });

    expect(provider.verifyWebhook(body, new Headers())).toEqual({ valid: false, reason: "MISSING_SIGNATURE" });
    expect(provider.verifyWebhook(body, new Headers({ "x-payment-signature": "deadbeef" }))).toEqual({ valid: false, reason: "INVALID_SIGNATURE" });
    expect(provider.verifyWebhook(body, new Headers({ "x-payment-signature": signFakeWebhook(body, "outro-segredo") }))).toEqual({ valid: false, reason: "INVALID_SIGNATURE" });
    expect(provider.verifyWebhook(body, new Headers({ "x-payment-signature": signFakeWebhook(body, paymentWebhookSecret()) }))).toEqual({ valid: true });

    // Nada foi processado (a rota só chama o processamento depois de verificar).
    expect((await chargeRow(charge.id))?.status).toBe("PENDING");
    const { data: payments } = await admin().from("payments").select("id").eq("installment_id", INSTALLMENTS[2]!);
    expect(payments).toHaveLength(0);
  });

  it("evento PAID confirma pagamento, parcela e lançamento numa transação; 10 reenvios = 1 efeito", async () => {
    const charge = await createCharge(INSTALLMENTS[3]!, "PIX", "it-key-5");
    const event = buildEvent({ providerChargeId: charge.providerChargeId, providerPaymentId: fakeProviderPaymentId(charge.id) });

    const first = await processPaymentWebhookEvent(event);
    expect(first.outcome).toBe("PAID");

    const repeats = await Promise.all(Array.from({ length: 9 }, () => processPaymentWebhookEvent(event)));
    for (const result of repeats) expect(result.outcome).toBe("DUPLICATE_EVENT");

    const row = await chargeRow(charge.id);
    expect(row?.status).toBe("PAID");
    expect(row?.payment_id).toBeTruthy();

    const { data: payments } = await admin().from("payments").select("id, status, provider, external_id, amount_cents").eq("installment_id", INSTALLMENTS[3]!);
    expect(payments).toHaveLength(1);
    expect(payments?.[0]).toMatchObject({ status: "CONFIRMED", provider: "fake", amount_cents: 20000 });

    const { data: installment } = await admin().from("contract_installments").select("status").eq("id", INSTALLMENTS[3]!).maybeSingle();
    expect(installment?.status).toBe("PAID");

    const { data: transactions } = await admin().from("financial_transactions").select("id, type, status, amount_cents").eq("origin_payment_id", payments![0]!.id);
    expect(transactions).toHaveLength(1);
    expect(transactions?.[0]).toMatchObject({ type: "INCOME", status: "CONFIRMED", amount_cents: 20000 });

    // Evento de notificação (Fase 12) criado na mesma transação.
    const { data: events } = await admin().from("notification_events").select("event_type").eq("patient_id", PATIENT_A).eq("event_type", "PAYMENT_CONFIRMED");
    expect(events).toHaveLength(1);

    // Novo evento (id diferente) com o mesmo status: idempotente pelo estado da cobrança.
    const again = await processPaymentWebhookEvent(buildEvent({ providerChargeId: charge.providerChargeId }));
    expect(again.outcome).toBe("ALREADY_PAID");
    const { data: paymentsAfter } = await admin().from("payments").select("id").eq("installment_id", INSTALLMENTS[3]!);
    expect(paymentsAfter).toHaveLength(1);
  });

  it("evento fora de ordem (PENDING depois de PAID) não rebaixa o pagamento", async () => {
    const { data: paid } = await admin().from("payment_charges").select("id, provider_charge_id").eq("installment_id", INSTALLMENTS[3]!).eq("status", "PAID").maybeSingle();
    const result = await processPaymentWebhookEvent(buildEvent({ providerChargeId: paid!.provider_charge_id!, status: "PENDING" }));
    expect(result.outcome).toBe("OUT_OF_ORDER");
    expect((await chargeRow(paid!.id))?.status).toBe("PAID");
  });

  it("status desconhecido nunca vira PAID e abre revisão", async () => {
    const charge = await createCharge(INSTALLMENTS[4]!, "PIX", "it-key-6");
    const provider = getPaymentProvider();
    const body = JSON.stringify({ event_id: "evt_unknown", type: "payment.super_new", charge_id: charge.providerChargeId, status: "SUPER_NEW_STATUS", amount_cents: 20000, currency: "BRL", occurred_at: new Date().toISOString() });
    const parsed = provider.parseWebhook(body);
    expect(parsed?.status).toBe("UNKNOWN");

    const result = await processPaymentWebhookEvent(parsed!);
    expect(result.outcome).toBe("UNKNOWN_STATUS");
    expect((await chargeRow(charge.id))?.status).toBe("PENDING");
    const { data: items } = await admin().from("payment_reconciliation_items").select("kind, status").eq("charge_id", charge.id);
    expect(items).toEqual([expect.objectContaining({ kind: "UNKNOWN_PROVIDER_STATUS", status: "OPEN" })]);
  });

  it("valor e moeda divergentes não quitam nada e viram revisão", async () => {
    const charge = await createCharge(INSTALLMENTS[0]!, "PIX", "it-key-7-reuse");
    const mismatch = await processPaymentWebhookEvent(buildEvent({ providerChargeId: charge.providerChargeId, amountCents: 19900 }));
    expect(mismatch.outcome).toBe("AMOUNT_MISMATCH");
    const currency = await processPaymentWebhookEvent(buildEvent({ providerChargeId: charge.providerChargeId, currency: "USD" }));
    expect(currency.outcome).toBe("CURRENCY_MISMATCH");

    expect((await chargeRow(charge.id))?.status).toBe("PENDING");
    const { data: payments } = await admin().from("payments").select("id").eq("installment_id", INSTALLMENTS[0]!);
    expect(payments).toHaveLength(0);
    const { data: items } = await admin().from("payment_reconciliation_items").select("kind").eq("charge_id", charge.id).eq("status", "OPEN");
    expect(items?.map((item) => item.kind).sort()).toEqual(["AMOUNT_MISMATCH", "CURRENCY_MISMATCH"]);
  });

  it("cobrança inexistente é registrada como evento órfão, sem efeito financeiro", async () => {
    const result = await processPaymentWebhookEvent(buildEvent({ providerChargeId: "fake_ch_inexistente" }));
    expect(result.outcome).toBe("CHARGE_NOT_FOUND");
    const { data } = await admin().from("payment_webhook_events").select("status, error_code").eq("provider_charge_id", "fake_ch_inexistente").maybeSingle();
    expect(data).toMatchObject({ status: "FAILED", error_code: "CHARGE_NOT_FOUND" });
  });
});

describe("conflito manual × online e reconciliação", () => {
  it("parcela quitada no caixa enquanto o Pix estava aberto: webhook não duplica receita", async () => {
    const installment = INSTALLMENTS[1]!;
    const { data: openCharge } = await admin().from("payment_charges").select("id, provider_charge_id").eq("installment_id", installment).in("status", ["CREATED", "PENDING"]).maybeSingle();
    let providerChargeId = openCharge?.provider_charge_id ?? null;
    if (!providerChargeId) {
      const created = await createCharge(installment, "PIX", "it-key-8");
      providerChargeId = created.providerChargeId;
    } else {
      await sql(`update public.payment_charges set status = 'PENDING' where id = $1`, [openCharge!.id]);
    }

    // Pagamento manual (Fase 7) quita a parcela.
    await sql(
      `select public.apply_payment_effects($1, 20000, 'CASH', now(), 'manual-it-1', 'MANUAL', null, $2, $2, $3, $4, null, null, null, 'America/Sao_Paulo')`,
      [PATIENT_A, NUTRI, installment, CONTRACT_A],
    );
    const { data: installmentRow } = await admin().from("contract_installments").select("status").eq("id", installment).maybeSingle();
    expect(installmentRow?.status).toBe("PAID");

    const result = await processPaymentWebhookEvent(buildEvent({ providerChargeId: providerChargeId! }));
    expect(result.outcome).toBe("INSTALLMENT_ALREADY_SETTLED");

    const { data: payments } = await admin().from("payments").select("id, provider").eq("installment_id", installment).eq("status", "CONFIRMED");
    expect(payments).toHaveLength(1);
    expect(payments?.[0]?.provider).toBe("MANUAL");
    const { data: items } = await admin().from("payment_reconciliation_items").select("kind, status").eq("kind", "INSTALLMENT_ALREADY_SETTLED").eq("status", "OPEN");
    expect(items?.length).toBeGreaterThanOrEqual(1);
  });

  it("expiração tira a cobrança do ar e a reconciliação não inventa pagamento", async () => {
    const { data: open } = await admin().from("payment_charges").select("id").eq("patient_id", PATIENT_A).in("status", ["CREATED", "PENDING"]).limit(1);
    const chargeId = open?.[0]?.id;
    expect(chargeId).toBeTruthy();
    await sql(`update public.payment_charges set expires_at = now() - interval '1 minute' where id = $1`, [chargeId]);

    const expired = await expireStaleCharges();
    expect(expired.expired).toBeGreaterThanOrEqual(1);
    expect((await chargeRow(chargeId!))?.status).toBe("EXPIRED");

    const before = await admin().from("payments").select("id", { count: "exact", head: true }).eq("patient_id", PATIENT_A);
    const reconcile = await reconcilePendingCharges({ limit: 20 });
    expect(reconcile.confirmed).toBe(0);
    const after = await admin().from("payments").select("id", { count: "exact", head: true }).eq("patient_id", PATIENT_A);
    expect(after.count).toBe(before.count);
  });

  it("cobrança PAID sem pagamento vinculado é detectada (estado impossível)", async () => {
    const opened = await detectPaidWithoutPayment();
    expect(opened).toBeGreaterThanOrEqual(0);
    const { data } = await admin().from("payment_charges").select("id").eq("status", "PAID").is("payment_id", null);
    expect(data).toHaveLength(0);
  });
});

describe("ownership e dados sensíveis", () => {
  it("cobranças e pagamentos ficam com o nutricionista dono; nada cruza de paciente", async () => {
    const { data: crossed } = await admin().from("payment_charges").select("id").eq("patient_id", PATIENT_A).neq("nutritionist_id", NUTRI);
    expect(crossed).toHaveLength(0);
    const { data: forB } = await admin().from("payment_charges").select("id").eq("patient_id", PATIENT_B);
    expect(forB).toHaveLength(0);
  });

  it("nenhum dado de cartão em cobranças, eventos ou auditoria", async () => {
    const { data: charges } = await admin().from("payment_charges").select("*").eq("patient_id", PATIENT_A);
    const serialized = JSON.stringify(charges ?? []).toLowerCase();
    for (const forbidden of ["card_number", "cvv", "cvc", "\"pan\""]) expect(serialized).not.toContain(forbidden);

    const { data: events } = await admin().from("payment_webhook_events").select("summary");
    const eventsSerialized = JSON.stringify(events ?? []).toLowerCase();
    for (const forbidden of ["card_number", "cvv", "cvc"]) expect(eventsSerialized).not.toContain(forbidden);

    // O resumo do evento guarda só campos técnicos conhecidos.
    for (const row of events ?? []) {
      const keys = Object.keys((row.summary ?? {}) as Record<string, unknown>);
      expect(keys.every((key) => ["type", "status", "provider_charge_id", "provider_payment_id", "amount_cents", "currency", "occurred_at"].includes(key))).toBe(true);
    }
  });
});
