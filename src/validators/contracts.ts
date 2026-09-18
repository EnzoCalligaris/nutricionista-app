import { z } from "zod";
import { isValidISODate } from "@/lib/calendar";
import { MAX_INSTALLMENTS } from "@/domain/contracts/installments";

// Schemas Zod de contratos/parcelamento (prompt Fase 5 §47).

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .refine(isValidISODate, { message: `${label} inválida.` });

const optionalIsoDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || isValidISODate(value), { message: `${label} inválida.` });

export const createContractSchema = z
  .object({
    planId: z.guid({ error: "Selecione um plano." }),
    // Condição de preço (plan_prices). Opcional: contrato manual pode não
    // corresponder a nenhuma linha de preço (ex.: valor negociado).
    planPriceId: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional()
      .refine((value) => value == null || z.guid().safeParse(value).success, {
        message: "Condição de preço inválida.",
      }),
    startDate: isoDate("Data de início"),
    endDate: optionalIsoDate("Data de término"),
    contractedAmountCents: z
      .number({ error: "Informe o valor contratado." })
      .int("Valor inválido.")
      .min(0, "Valor inválido.")
      .max(100_000_000, "Valor acima do limite."),
    installmentsCount: z
      .number({ error: "Informe a quantidade de parcelas." })
      .int("Quantidade de parcelas inválida.")
      .min(1, "Mínimo de 1 parcela.")
      .max(MAX_INSTALLMENTS, `Máximo de ${MAX_INSTALLMENTS} parcelas.`),
    firstDueDate: isoDate("Primeiro vencimento"),
    notes: z
      .string()
      .trim()
      .max(1000, "Observações muito longas (máximo 1000 caracteres).")
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional(),
  })
  .refine((data) => data.endDate == null || data.endDate >= data.startDate, {
    message: "A data de término não pode ser anterior ao início.",
    path: ["endDate"],
  });

export const contractIdSchema = z.guid({ error: "Identificador de contrato inválido." });

export const cancelContractSchema = z.object({
  contractId: contractIdSchema,
});

export const installmentPlanSchema = z.object({
  totalCents: z.number().int().min(0),
  count: z.number().int().min(1).max(MAX_INSTALLMENTS),
  firstDueDate: isoDate("Primeiro vencimento"),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
