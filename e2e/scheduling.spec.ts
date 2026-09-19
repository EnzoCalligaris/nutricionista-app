import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

// Fase 6 — agenda e agendamento ponta a ponta contra o app real + Supabase
// local com o seed (disponibilidade fictícia seg–sex 08–12 / 14–18, 60 min
// a cada 30). Em série (mesmo servidor/Postgres) e com UMA sessão por
// bloco para respeitar o rate limit de login (docs/DECISIONS.md, Fase 5).
test.describe.configure({ mode: "serial" });

const NUTRITIONIST = { email: "dev-nutricionista@example.test", password: "NutricaoDev123", id: "90000000-0000-0000-0000-000000000001" };
const PATIENT = { email: "fulana.detal@example.test", password: "NutricaoDev123", patientId: "90000000-0000-0000-0000-000000000010" };
const OTHER_PATIENT_ID = "90000000-0000-0000-0000-000000000011"; // Beltrano
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55422/postgres";

// Segunda-feira ≥ 8 dias à frente (no fuso de São Paulo), dentro da
// disponibilidade do seed e longe das consultas do seed (+5d, +15d podem
// cair em outro dia da semana — a data escolhida é sempre a PRÓXIMA segunda
// após +8d).
function targetMonday(): string {
  const spDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = spDate.split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d! + 8));
  const weekday = base.getUTCDay();
  const toMonday = (8 - weekday) % 7;
  return new Date(base.getTime() + toMonday * 86_400_000).toISOString().slice(0, 10);
}
const DATE = targetMonday();
const STARTED_AT = new Date().toISOString();

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function withDb(fn: (client: pg.Client) => Promise<void>) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

// Remove só o que este arquivo criou (a partir do início da execução).
test.afterAll(async () => {
  await withDb(async (client) => {
    await client.query(`delete from public.audit_logs where created_at >= $1 and entity_type in ('appointment','blocked_time','availability','scheduling_settings')`, [STARTED_AT]);
    await client.query(`delete from public.appointment_notes where created_at >= $1`, [STARTED_AT]);
    await client.query(`update public.appointments set rescheduled_to_id = null where nutritionist_id = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT]);
    await client.query(`delete from public.appointments where nutritionist_id = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT]);
    await client.query(`delete from public.blocked_times where nutritionist_id = $1 and created_at >= $2`, [NUTRITIONIST.id, STARTED_AT]);
    await client.query(`delete from public.availability_rules where nutritionist_id = $1 and weekday = 6`, [NUTRITIONIST.id]);
  });
});

test.describe("nutricionista — agenda", () => {
  let page: Page;
  let createdAppointmentUrl = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, NUTRITIONIST);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("abre a agenda e troca semana/mês/dia", async () => {
    await page.goto(`/dashboard/agenda?view=week&date=${DATE}`);
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Visualização" }).getByRole("link", { name: "Semana" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("navigation", { name: "Visualização" }).getByRole("link", { name: "Mês" }).click();
    await expect(page).toHaveURL(/view=month/);
    await expect(page.getByRole("list", { name: "Dias do mês" })).toBeVisible();

    await page.getByRole("navigation", { name: "Visualização" }).getByRole("link", { name: "Dia" }).click();
    await expect(page).toHaveURL(/view=day/);
    await page.getByRole("link", { name: "Próximo período" }).click();
    await expect(page).toHaveURL(/view=day&date=/);
    await expect(page.getByRole("heading", { name: "Próximas sessões" })).toBeVisible();
  });

  test("configura disponibilidade (novo intervalo no sábado)", async () => {
    await page.goto("/dashboard/agenda/configuracoes");
    await expect(page.getByRole("heading", { name: "Configurações da agenda" })).toBeVisible();
    const saturday = page.getByRole("listitem").filter({ hasText: "Sábado" });
    await saturday.getByRole("button", { name: "Adicionar intervalo" }).click();
    await saturday.getByLabel("Início").fill("09:00");
    await saturday.getByLabel("Fim").fill("11:00");
    await page.getByRole("button", { name: "Salvar disponibilidade" }).click();
    await expect(page.getByText("Disponibilidade salva.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: "Sábado" }).getByLabel("Início")).toHaveValue("09:00");
  });

  test("valida sobreposição na disponibilidade", async () => {
    const monday = page.getByRole("listitem").filter({ hasText: "Segunda" });
    await monday.getByRole("button", { name: "Adicionar intervalo" }).click();
    await monday.getByLabel("Início").last().fill("11:00");
    await monday.getByLabel("Fim").last().fill("13:00");
    await expect(monday.getByText("Intervalo sobrepõe outro do mesmo dia.")).toBeVisible();
    await monday.getByRole("button", { name: "Remover intervalo de Segunda" }).last().click();
  });

  test("cria bloqueio de dia inteiro", async () => {
    // Domingo ≥ 3 semanas após a data-alvo: fora do alcance das consultas
    // do seed (+5d/+15d) e sem regra de disponibilidade.
    const sunday = new Date(Date.UTC(Number(DATE.slice(0, 4)), Number(DATE.slice(5, 7)) - 1, Number(DATE.slice(8, 10)) + 20)).toISOString().slice(0, 10);
    await page.goto(`/dashboard/agenda/bloqueios/novo?date=${sunday}`);
    await page.getByLabel("Dia inteiro").click();
    await page.getByLabel("Descrição").fill("Bloqueio E2E");
    await page.getByRole("button", { name: "Criar bloqueio" }).click();
    await expect(page).toHaveURL(/view=day/);
    await expect(page.getByText("Bloqueio criado.")).toBeVisible();
    await expect(page.getByTitle("Bloqueio E2E")).toBeVisible();
  });

  test("agenda paciente pelo dashboard usando um slot livre", async () => {
    await page.goto(`/dashboard/agenda/nova?date=${DATE}`);
    await page.getByPlaceholder("Buscar paciente pelo nome...").fill("Sicrana");
    await page.getByRole("option").filter({ hasText: "Sicrana Pereira" }).click();
    await expect(page.getByText("Sicrana Pereira")).toBeVisible();
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    await expect(slots.first()).toBeVisible();
    await slots.filter({ hasText: "14:00" }).click();
    await page.getByLabel("Observação interna").fill("Criada pelo E2E");
    await page.getByRole("button", { name: "Agendar consulta" }).click();
    await expect(page).toHaveURL(/\/dashboard\/agenda\/[0-9a-f-]{36}/);
    await expect(page.getByText("Consulta agendada.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Sicrana Pereira" })).toBeVisible();
    await expect(page.getByText("14:00 – 15:00")).toBeVisible();
    await expect(page.getByText("Criada pelo E2E")).toBeVisible();
    createdAppointmentUrl = page.url().split("?")[0]!;
  });

  test("slot ocupado deixa de aparecer e conflito é recusado com mensagem amigável", async () => {
    await page.goto(`/dashboard/agenda/nova?date=${DATE}`);
    await page.getByPlaceholder("Buscar paciente pelo nome...").fill("Fulano");
    await page.getByRole("option").filter({ hasText: "Fulano de Tal Neto" }).click();
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    await expect(slots.first()).toBeVisible();
    await expect(slots.filter({ hasText: /^14:00$/ })).toHaveCount(0);
    await expect(slots.filter({ hasText: /^14:30$/ })).toHaveCount(0);
    // Override: tenta o mesmo horário mesmo assim -> o banco recusa (23P01 -> mensagem).
    await page.getByLabel("Permitir fora da disponibilidade").click();
    await page.getByLabel("Horário").fill("14:30");
    await page.getByRole("button", { name: "Agendar consulta" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Esse horário acabou de ser reservado. Escolha outro horário.");
  });

  test("confirma, reagenda (histórico) e cancela", async () => {
    await page.goto(createdAppointmentUrl);
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar consulta" }).click();
    await expect(page.getByText("Consulta confirmada.")).toBeVisible();
    await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Reagendar" }).click();
    await expect(page.getByRole("heading", { name: "Reagendar consulta" })).toBeVisible();
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    await expect(slots.first()).toBeVisible();
    await slots.filter({ hasText: /^15:00$/ }).click();
    await page.getByRole("button", { name: "Confirmar reagendamento" }).click();
    await expect(page).toHaveURL(/\/dashboard\/agenda\/[0-9a-f-]{36}/);
    await expect(page.getByText("Consulta reagendada.")).toBeVisible();
    await expect(page.getByText("15:00 – 16:00")).toBeVisible();
    await expect(page.getByText(/Reagendada de/)).toBeVisible();

    // A original continua no histórico como reagendada.
    await page.locator("dd", { hasText: "Reagendada de" }).getByRole("link").click();
    await expect(page.getByText("Reagendada", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ver nova consulta" })).toBeVisible();
    await page.getByRole("link", { name: "ver nova consulta" }).click();

    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByLabel("Motivo (opcional)").fill("Cancelada pelo E2E");
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar consulta" }).click();
    await expect(page.getByText("Consulta cancelada.")).toBeVisible();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(page.getByText("Cancelada pelo E2E")).toBeVisible();
  });

  test("nutricionista logado com next do portal cai no dashboard, nunca no portal (§43/§94)", async () => {
    await page.goto("/login?next=%2Fpaciente%2Fagendar");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/paciente/agendar");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("próximas sessões e perfil do paciente listam consultas reais", async () => {
    await page.goto("/dashboard/agenda?periodo=month");
    await expect(page.getByRole("heading", { name: "Próximas sessões" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row", { name: /Fulana de Tal|Beltrano da Silva/ }).first()).toBeVisible();

    await page.goto(`/dashboard/pacientes/${PATIENT.patientId}?tab=consultas`);
    await expect(page.getByRole("columnheader", { name: "Pagamento" })).toBeVisible();
    await expect(page.getByRole("table").getByRole("row").nth(1)).toBeVisible();
  });
});

test.describe("paciente — portal", () => {
  let page: Page;
  let bookedLabel = "";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, PATIENT);
    await expect(page).toHaveURL(/\/paciente$/);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("vê próxima consulta e histórico", async () => {
    await page.goto("/paciente/consultas");
    await expect(page.getByRole("heading", { level: 1, name: "Consultas" })).toBeVisible();
    await expect(page.getByText("Próxima consulta", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("agenda: data -> horário -> tipo -> confirmar", async () => {
    await page.goto(`/paciente/agendar?date=${DATE}`);
    await expect(page.getByRole("heading", { name: "Agendar consulta" })).toBeVisible();
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    await expect(slots.first()).toBeVisible();
    // 14:00/15:00 não aparecem mais para o paciente? 14:00 foi reagendada
    // (liberou) e 15:00 cancelada (liberou) — mas 15:00 já pode ter sido
    // retomada; escolhemos 08:00, sempre livre nesta data.
    const slot = slots.filter({ hasText: /^08:00$/ });
    await expect(slot).toHaveCount(1);
    await slot.click();
    await page.getByRole("radio", { name: "Online" }).click();
    bookedLabel = "08:00";
    await expect(page.getByText(/às 08:00 · Online/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page).toHaveURL(/\/paciente\/consultas/);
    await expect(page.getByText("Consulta agendada com sucesso.")).toBeVisible();
    await expect(page.getByText("08:00 – 09:00").first()).toBeVisible();
  });

  test("conflito: slot reservado por outro antes da confirmação mostra mensagem e atualiza", async () => {
    await page.goto(`/paciente/agendar?date=${DATE}`);
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    const slot = slots.filter({ hasText: /^10:00$/ });
    await expect(slot).toHaveCount(1);
    await slot.click();
    // Outro paciente reserva 10:00 enquanto esta tela está aberta.
    await withDb(async (client) => {
      await client.query(
        `insert into public.appointments (nutritionist_id, patient_id, starts_at, ends_at, modality, status)
         values ($1, $2, ($3 || 'T10:00:00-03:00')::timestamptz, ($3 || 'T11:00:00-03:00')::timestamptz, 'IN_PERSON', 'SCHEDULED')`,
        [NUTRITIONIST.id, OTHER_PATIENT_ID, DATE],
      );
    });
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Esse horário acabou de ser reservado. Escolha outro horário.").first()).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio").filter({ hasText: /^10:00$/ })).toHaveCount(0);
  });

  test("reagenda e cancela a própria consulta", async () => {
    await page.goto("/paciente/consultas");
    const card = page.locator("[id^=consulta-]").filter({ hasText: `${bookedLabel} – 09:00` }).first();
    await card.getByRole("link", { name: "Reagendar" }).click();
    await expect(page.getByRole("heading", { name: "Reagendar consulta" })).toBeVisible();
    await page.goto(`/paciente/agendar?date=${DATE}&reagendar=${new URL(page.url()).searchParams.get("reagendar")}`);
    const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
    await slots.filter({ hasText: /^11:00$/ }).click();
    await page.getByRole("button", { name: "Confirmar reagendamento" }).click();
    await expect(page).toHaveURL(/\/paciente\/consultas/);
    await expect(page.getByText("Consulta reagendada com sucesso.")).toBeVisible();
    await expect(page.getByText("11:00 – 12:00").first()).toBeVisible();

    const newCard = page.locator("[id^=consulta-]").filter({ hasText: "11:00 – 12:00" }).first();
    await newCard.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar consulta" }).click();
    await expect(page.getByText("Consulta cancelada.")).toBeVisible();
    await expect(page.locator("[id^=consulta-]").filter({ hasText: "11:00 – 12:00" }).first().getByText("Cancelada", { exact: true })).toBeVisible();
  });

  test("não consegue agir sobre consulta de outro paciente pela URL", async () => {
    // Consulta do Beltrano (seed) — reagendar pela URL cai em aviso, sem expor dados.
    await page.goto(`/paciente/agendar?reagendar=90000000-0000-0000-0000-000000000404`);
    await expect(page.locator("main").getByRole("alert")).toContainText("não pode mais ser reagendada");
    await expect(page.getByText("Beltrano")).toHaveCount(0);
  });
});

test.describe("público — /agendar", () => {
  test("anônimo: CTA leva ao login com next seguro; paciente volta ao fluxo", async ({ page }) => {
    await page.goto("/agendar");
    const cta = page.getByRole("link", { name: /Já sou paciente/ });
    await expect(cta).toHaveAttribute("href", "/login?next=%2Fpaciente%2Fagendar");
    await cta.click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("E-mail").fill(PATIENT.email);
    await page.getByLabel("Senha").fill(PATIENT.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/paciente\/agendar$/);
    await expect(page.getByRole("heading", { name: "Agendar consulta" })).toBeVisible();
  });
});
