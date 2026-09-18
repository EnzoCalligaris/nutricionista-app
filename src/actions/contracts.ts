"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { parseBRLToCents } from "@/lib/money";
import { patientIdSchema } from "@/validators/patients";
import { contractIdSchema, createContractSchema } from "@/validators/contracts";
import { cancelContract, completeContract, createContract } from "@/services/contracts";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions de contrato (prompt Fase 5 §46). `patientId` chega como
 * argumento vinculado no server (`createContractAction.bind(null, id)`), e
 * o service reconfere ownership antes de escrever; `contractId` das ações
 * de status é validado como UUID e reconferido por ownership no service.
 */

export type ContractFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"planId" | "planPriceId" | "startDate" | "endDate" | "contractedAmount" | "installmentsCount" | "firstDueDate" | "notes", string>
  >;
  values?: Record<string, string>;
};

const FIELD_KEYS = new Set(["planId", "planPriceId", "startDate", "endDate", "contractedAmount", "installmentsCount", "firstDueDate", "notes"]);

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[contracts] erro inesperado:", error instanceof Error ? error.message : error);
  return domainErrorMessage("UNKNOWN");
}

export async function createContractAction(
  patientId: string,
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const nutritionist = await requireNutritionist();

  const values: Record<string, string> = {
    planId: String(formData.get("planId") ?? ""),
    planPriceId: String(formData.get("planPriceId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    contractedAmount: String(formData.get("contractedAmount") ?? ""),
    installmentsCount: String(formData.get("installmentsCount") ?? ""),
    firstDueDate: String(formData.get("firstDueDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const id = patientIdSchema.safeParse(patientId);
  if (!id.success) return { error: domainErrorMessage("PATIENT_NOT_FOUND"), values };

  const contractedAmountCents = parseBRLToCents(values.contractedAmount);
  const installmentsCount = Number(values.installmentsCount);

  const parsed = createContractSchema.safeParse({
    planId: values.planId,
    planPriceId: values.planPriceId,
    startDate: values.startDate,
    endDate: values.endDate,
    contractedAmountCents: contractedAmountCents ?? Number.NaN,
    installmentsCount: Number.isFinite(installmentsCount) ? installmentsCount : Number.NaN,
    firstDueDate: values.firstDueDate,
    notes: values.notes,
  });

  if (!parsed.success) {
    const fieldErrors: ContractFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const raw = String(issue.path[0] ?? "");
      const key = raw === "contractedAmountCents" ? "contractedAmount" : raw;
      if (FIELD_KEYS.has(key)) {
        fieldErrors[key as keyof NonNullable<ContractFormState["fieldErrors"]>] ??= issue.message;
      }
    }
    if (contractedAmountCents === null) fieldErrors.contractedAmount ??= "Informe um valor válido (ex.: 1.050,00).";
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };
  }

  try {
    await createContract(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id.data}`);
  redirect(`/dashboard/pacientes/${id.data}?toast=contract_created&tab=contratos`);
}

export async function cancelContractAction(contractId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = contractIdSchema.safeParse(contractId);
  if (!id.success) return { ok: false, error: domainErrorMessage("CONTRACT_NOT_FOUND") };

  let patientId: string;
  try {
    ({ patientId } = await cancelContract(nutritionist.id, id.data));
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  return { ok: true };
}

export async function completeContractAction(contractId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = contractIdSchema.safeParse(contractId);
  if (!id.success) return { ok: false, error: domainErrorMessage("CONTRACT_NOT_FOUND") };

  let patientId: string;
  try {
    ({ patientId } = await completeContract(nutritionist.id, id.data));
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  return { ok: true };
}
