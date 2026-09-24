import { z } from "zod";

/**
 * Validação de plano, condição de preço e benefício (prompt Fase 14 §13–§19).
 *
 * As regras duras de preço também existem no BANCO (§18):
 * `plan_prices_amount_positive` (valor > 0), `installments >= 1` e o índice
 * único `plan_prices_one_primary_per_plan` (uma condição principal ativa por
 * plano). Aqui é a camada que dá mensagem boa ao nutricionista.
 */

export const planIdSchema = z.guid({ error: "Plano inválido." });
export const planPriceIdSchema = z.guid({ error: "Condição de preço inválida." });
export const planBenefitIdSchema = z.guid({ error: "Benefício inválido." });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .transform((value) => (value.length > 0 ? value : null))
    .nullable();

/**
 * `code` NÃO é editável: contratos existentes e o catálogo real dependem
 * dele. Sessões/duração ficam opcionais porque o ANUAL realmente não tem a
 * composição definida (docs/DECISIONS.md) — nada é inventado.
 */
export const planSchema = z.object({
  name: z.string().trim().min(3, { message: "Informe um nome com ao menos 3 caracteres." }).max(120, { message: "Use no máximo 120 caracteres." }),
  description: optionalText(600, "A descrição deve ter no máximo 600 caracteres."),
  durationMonths: z.coerce.number().int().min(1).max(60).nullable(),
  sessionsInPerson: z.coerce.number().int().min(0).max(120).nullable(),
  sessionsOnline: z.coerce.number().int().min(0).max(120).nullable(),
  active: z.boolean(),
  publiclyVisible: z.boolean(),
  availableForSale: z.boolean(),
});

export type PlanInput = z.infer<typeof planSchema>;

/**
 * Coerência das flags (§13/§14): as duas primeiras também são constraints
 * (`plans_public_requires_active`, `plans_sale_requires_active`).
 */
export function planFlagErrors(input: Pick<PlanInput, "active" | "publiclyVisible" | "availableForSale">): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.active && input.publiclyVisible) errors.publiclyVisible = "Um plano inativo não pode aparecer no site.";
  if (!input.active && input.availableForSale) errors.availableForSale = "Um plano inativo não pode estar disponível para venda.";
  return errors;
}

const PAYMENT_TYPES = ["AVISTA", "PARCELADO", "REFERENCIA"] as const;

export const planPriceSchema = z
  .object({
    label: z.string().trim().min(2, { message: "Informe um rótulo com ao menos 2 caracteres." }).max(120, { message: "Use no máximo 120 caracteres." }),
    /** Em reais no formulário; convertido para centavos inteiros. */
    amount: z.string().trim().min(1, { message: "Informe o valor." }),
    installments: z.coerce.number().int().min(1, { message: "O número de parcelas deve ser no mínimo 1." }).max(48, { message: "No máximo 48 parcelas." }),
    paymentType: z.enum(PAYMENT_TYPES, { message: "Escolha a forma de pagamento." }),
    isPrimary: z.boolean(),
    active: z.boolean(),
  })
  .transform((value, ctx) => {
    const cents = parseAmountToCents(value.amount);
    if (cents === null) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe um valor como 230,00." });
      return z.NEVER;
    }
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "O valor deve ser maior que zero." });
      return z.NEVER;
    }
    return { ...value, amountCents: cents };
  });

export type PlanPriceInput = z.infer<typeof planPriceSchema>;

/**
 * "230", "230,00", "1.050,00", "R$ 1.050,00" → centavos. Dinheiro é sempre
 * inteiro em centavos (CLAUDE.md) — nunca float.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s|R\$/gi, "").trim();
  if (!cleaned) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // "1.050" é milhar, não decimal.
    normalized = cleaned.replace(/\./g, "");
  }

  const asNumber = Number(normalized);
  if (!Number.isFinite(asNumber)) return null;
  return Math.round(asNumber * 100);
}

export const planBenefitSchema = z.object({
  label: z.string().trim().min(2, { message: "Informe um benefício com ao menos 2 caracteres." }).max(200, { message: "Use no máximo 200 caracteres." }),
  active: z.boolean(),
});

export type PlanBenefitInput = z.infer<typeof planBenefitSchema>;

export const benefitOrderSchema = z.object({
  benefitId: planBenefitIdSchema,
  direction: z.enum(["up", "down"], { message: "Direção inválida." }),
});
