import { z } from "zod";

/**
 * Validação das Server Actions de pagamento (prompt Fase 13 §96–§97): só
 * REFERÊNCIA e escolha de método. Valor, moeda, paciente, provider, status,
 * parcela e ids externos são derivados no servidor — nunca aceitos do
 * cliente.
 */

export const chargeIdSchema = z.guid({ error: "Cobrança inválida." });
export const installmentIdSchema = z.guid({ error: "Parcela inválida." });
export const reconciliationItemIdSchema = z.guid({ error: "Item inválido." });

export const onlineMethodSchema = z.enum(["PIX", "CARD"], { error: "Método de pagamento inválido." });

/** Só referência e método: valor, moeda, paciente e tentativa são derivados no servidor. */
export const createCheckoutSchema = z.object({
  installmentId: installmentIdSchema,
  method: onlineMethodSchema,
});

export const resolveReconciliationSchema = z.object({
  itemId: reconciliationItemIdSchema,
  outcome: z.enum(["RESOLVED", "IGNORED"]),
  note: z.string().trim().max(500).optional(),
});

/** Simulação de webhook (só fora de produção, provider fake). */
export const simulateWebhookSchema = z.object({
  chargeId: chargeIdSchema,
  status: z.enum(["PAID", "PENDING", "EXPIRED", "FAILED", "CANCELLED"]),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type ResolveReconciliationInput = z.infer<typeof resolveReconciliationSchema>;
