import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";
import { MAX_AMOUNT_CENTS } from "@/domain/finance/definitions";

// Schemas Zod do financeiro (prompt Fase 7 §62–§63). Só campos de negócio:
// nutritionist_id, origin, origin_payment_id, external_id, created_at,
// status privilegiado e ids internos nunca passam por aqui.

const isoDate = (label: string) => z.string().trim().refine(isValidISODate, { message: `${label} inválida.` });

const optionalIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || isValidISODate(value), { message: `${label} inválida.` });

const optionalGuid = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || z.guid().safeParse(value).success, { message: `${label} inválido.` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** Valor em centavos: inteiro, > 0 (§107–§109), dentro do limite seguro. */
export const amountCentsSchema = z
  .number({ error: "Informe um valor válido (ex.: 230,00)." })
  .int("Valor inválido.")
  .min(1, "Informe um valor maior que zero.")
  .max(MAX_AMOUNT_CENTS, "Valor acima do limite permitido.");

export const financialTypeSchema = z.enum(["INCOME", "EXPENSE"], { error: "Selecione receita ou despesa." });
export const paymentMethodSchema = z.enum(["PIX", "CARD", "CASH", "BANK_TRANSFER", "OTHER"], { error: "Selecione o método de pagamento." });

/** Lançamento manual (§16). Status permitido ao usuário: pago (CONFIRMED) ou pendente. */
export const manualTransactionSchema = z
  .object({
    description: z.string().trim().min(2, "Informe a descrição.").max(200, "Descrição muito longa."),
    type: financialTypeSchema,
    categoryId: optionalGuid("Categoria"),
    amountCents: amountCentsSchema,
    occurredOn: isoDate("Data"),
    dueOn: optionalIsoDate("Vencimento"),
    paymentMethod: paymentMethodSchema.nullable().optional(),
    status: z.enum(["CONFIRMED", "PENDING"], { error: "Selecione o status." }),
    notes: optionalText(1000),
    patientId: optionalGuid("Paciente"),
  })
  .refine((data) => data.dueOn == null || data.dueOn >= data.occurredOn, {
    message: "O vencimento não pode ser anterior à data do lançamento.",
    path: ["dueOn"],
  });

export const cancelTransactionSchema = z.object({
  reason: optionalText(500),
});

/** Pagamento manual (§22): paciente obrigatório; parcela/contrato/consulta opcionais e reconferidos por ownership. */
export const recordPaymentSchema = z.object({
  patientId: z.guid({ error: "Selecione o paciente." }),
  installmentId: optionalGuid("Parcela"),
  contractId: optionalGuid("Contrato"),
  appointmentId: optionalGuid("Consulta"),
  categoryId: optionalGuid("Categoria"),
  amountCents: amountCentsSchema,
  method: paymentMethodSchema,
  paidOn: isoDate("Data do pagamento"),
  notes: optionalText(500),
  /** UUID gerado no formulário: dois envios iguais => um pagamento (§26). */
  idempotencyKey: z.guid({ error: "Chave de idempotência inválida." }),
});

export const cancelPaymentSchema = z.object({
  reason: optionalText(500),
});

export const transactionListQuerySchema = z.object({
  periodo: z.enum(["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "custom"]).catch("this_month"),
  de: z.string().optional(),
  ate: z.string().optional(),
  tipo: z.enum(["all", "INCOME", "EXPENSE"]).catch("all"),
  status: z.enum(["all", "PAID", "PENDING", "OVERDUE", "CANCELLED"]).catch("all"),
  categoria: z.string().optional().transform((value) => (value && z.guid().safeParse(value).success ? value : undefined)),
  metodo: z.enum(["all", "PIX", "CARD", "CASH", "BANK_TRANSFER", "OTHER"]).catch("all"),
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(50).catch(20),
});

export const transactionIdSchema = z.guid({ error: "Identificador de lançamento inválido." });
export const paymentIdSchema = z.guid({ error: "Identificador de pagamento inválido." });

export type ManualTransactionInput = z.infer<typeof manualTransactionSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
