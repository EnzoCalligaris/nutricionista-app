import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { getContractForOwnership } from "@/data/contracts";
import { getDashboardPlans } from "@/data/plans";
import { generateInstallments, sumInstallments } from "@/domain/contracts/installments";
import { canCancelContract, canCompleteContract } from "@/domain/contracts/status";
import { requireOwnedPatient } from "@/services/patients";
import { recordAudit } from "@/services/audit";
import type { CreateContractInput } from "@/validators/contracts";

/**
 * Casos de uso de contrato (prompt Fase 5 §27–§41). A escrita passa pelas
 * funções SQL transacionais da migration da Fase 5 (SECURITY INVOKER — a
 * RLS vale dentro delas); aqui ficam a validação de negócio e o ownership
 * explícito antes de chamar o banco.
 */

async function requireOwnedContract(nutritionistId: string, contractId: string) {
  const contract = await getContractForOwnership(contractId);
  if (!contract) throw new DomainError("CONTRACT_NOT_FOUND");
  if (contract.nutritionistId !== nutritionistId) throw new DomainError("CONTRACT_NOT_AUTHORIZED");
  return contract;
}

/**
 * Cria contrato + parcelas. `contracted_amount_cents` é o SNAPSHOT do valor
 * vendido (§28): prefixado pela condição de preço escolhida, mas gravado
 * como número próprio do contrato — mudar `plan_prices` depois não altera
 * contrato antigo. As parcelas são geradas aqui (domínio puro, testado) e
 * revalidadas pela função SQL (soma exata, numeração).
 */
export async function createContract(
  nutritionistId: string,
  patientId: string,
  input: CreateContractInput,
): Promise<{ contractId: string }> {
  await requireOwnedPatient(nutritionistId, patientId);

  const plans = await getDashboardPlans();
  const plan = plans.find((candidate) => candidate.id === input.planId);
  if (!plan) throw new DomainError("PLAN_NOT_AVAILABLE");

  if (input.planPriceId) {
    const price = plan.prices.find((candidate) => candidate.id === input.planPriceId);
    if (!price) throw new DomainError("PLAN_NOT_AVAILABLE");
  }

  if (input.endDate && input.endDate < input.startDate) throw new DomainError("INVALID_CONTRACT_PERIOD");

  const installments = generateInstallments({
    totalCents: input.contractedAmountCents,
    count: input.installmentsCount,
    firstDueDate: input.firstDueDate,
  });
  if (sumInstallments(installments) !== input.contractedAmountCents) {
    throw new DomainError("INVALID_INSTALLMENTS");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_contract_with_installments", {
    p_patient_id: patientId,
    p_plan_id: input.planId,
    p_start_date: input.startDate,
    p_contracted_amount_cents: input.contractedAmountCents,
    p_installments: installments,
    ...(input.planPriceId ? { p_plan_price_id: input.planPriceId } : {}),
    ...(input.endDate ? { p_end_date: input.endDate } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });

  if (error || !data) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "CONTRACT_CREATED",
    entityType: "contract",
    entityId: data,
    metadata: {
      patient_id: patientId,
      plan_code: plan.code,
      contracted_amount_cents: input.contractedAmountCents,
      installments: input.installmentsCount,
    },
  });

  return { contractId: data };
}

/** Cancela (§35): parcelas em aberto viram CANCELLED; nada é apagado. */
export async function cancelContract(nutritionistId: string, contractId: string): Promise<{ patientId: string }> {
  const contract = await requireOwnedContract(nutritionistId, contractId);
  if (!canCancelContract(contract.status)) throw new DomainError("INVALID_STATUS_TRANSITION");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_contract", { p_contract_id: contractId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "CONTRACT_CANCELLED",
    entityType: "contract",
    entityId: contractId,
    metadata: { patient_id: contract.patientId },
  });

  return { patientId: contract.patientId };
}

/** Encerra (ACTIVE -> COMPLETED) sem tocar nas parcelas. */
export async function completeContract(nutritionistId: string, contractId: string): Promise<{ patientId: string }> {
  const contract = await requireOwnedContract(nutritionistId, contractId);
  if (!canCompleteContract(contract.status)) throw new DomainError("INVALID_STATUS_TRANSITION");

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_contract", { p_contract_id: contractId });
  if (error) throw domainErrorFromDatabase(error);

  await recordAudit({
    actorId: nutritionistId,
    action: "CONTRACT_COMPLETED",
    entityType: "contract",
    entityId: contractId,
    metadata: { patient_id: contract.patientId },
  });

  return { patientId: contract.patientId };
}
