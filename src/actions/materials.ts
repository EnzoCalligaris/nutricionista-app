"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { assignmentIdSchema, materialFileMetaSchema, materialIdSchema, materialSchema, materialUpdateSchema } from "@/validators/patient-content";
import { patientIdSchema } from "@/validators/patients";
import * as service from "@/services/materials";
import type { ActionResult } from "@/actions/patients";

/**
 * Server Actions dos materiais (prompt Fase 10 §65): requireNutritionist,
 * Zod só com campos de negócio (nutritionist_id/storage_path/assigned_by
 * nunca do client), service, auditoria (no service), revalidação. O arquivo
 * chega por multipart e tem o tipo conferido pela assinatura no service.
 */

export type MaterialFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  // Nunca logar título/descrição/nome de arquivo: só a mensagem técnica do erro.
  console.error("[materials] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

function revalidateMaterials(materialId?: string, patientId?: string) {
  revalidatePath("/dashboard/materiais");
  if (materialId) revalidatePath(`/dashboard/materiais/${materialId}`);
  if (patientId) revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath("/paciente/materiais");
  revalidatePath("/paciente");
}

function fileFrom(formData: FormData, key: string): File | null {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

export async function createMaterialAction(_prev: MaterialFormState, formData: FormData): Promise<MaterialFormState> {
  const nutritionist = await requireNutritionist();
  const values: Record<string, string> = {
    kind: String(formData.get("kind") ?? "FILE"),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    externalUrl: String(formData.get("externalUrl") ?? ""),
  };
  const parsed = materialSchema.safeParse(values.kind === "LINK" ? { kind: "LINK", title: values.title, description: values.description, externalUrl: values.externalUrl } : { kind: "FILE", title: values.title, description: values.description });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  const file = values.kind === "FILE" ? fileFrom(formData, "file") : null;
  if (values.kind === "FILE") {
    if (!file) fieldErrors.file ??= "Selecione um arquivo PDF, JPG ou PNG.";
    else {
      const meta = materialFileMetaSchema.safeParse({ name: file.name, type: file.type, size: file.size });
      if (!meta.success) fieldErrors.file ??= meta.error.issues[0]?.message ?? domainErrorMessage("INVALID_MATERIAL_FILE");
    }
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };

  let created: { materialId: string };
  try {
    created = await service.createMaterial(nutritionist.id, parsed.data, file);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateMaterials(created.materialId);
  redirect(`/dashboard/materiais/${created.materialId}?toast=material_created`);
}

export async function updateMaterialAction(materialId: string, _prev: MaterialFormState, formData: FormData): Promise<MaterialFormState> {
  const nutritionist = await requireNutritionist();
  const id = materialIdSchema.safeParse(materialId);
  const values: Record<string, string> = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    externalUrl: String(formData.get("externalUrl") ?? ""),
  };
  if (!id.success) return { error: domainErrorMessage("MATERIAL_NOT_FOUND"), values };
  const parsed = materialUpdateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors, values };
  }
  try {
    await service.updateMaterial(nutritionist.id, id.data, parsed.data);
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  revalidateMaterials(id.data);
  redirect(`/dashboard/materiais/${id.data}?toast=material_updated`);
}

/** Substituir/enviar o arquivo de um material de arquivo (multipart via Server Action). */
export async function replaceMaterialFileAction(materialId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = materialIdSchema.safeParse(materialId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MATERIAL_NOT_FOUND") };
  const file = fileFrom(formData, "file");
  if (!file) return { ok: false, error: domainErrorMessage("INVALID_MATERIAL_FILE") };
  const meta = materialFileMetaSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (!meta.success) return { ok: false, error: meta.error.issues[0]?.message ?? domainErrorMessage("INVALID_MATERIAL_FILE") };
  try {
    await service.replaceMaterialFile(nutritionist.id, id.data, file);
    revalidateMaterials(id.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function archiveMaterialAction(materialId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = materialIdSchema.safeParse(materialId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MATERIAL_NOT_FOUND") };
  try {
    await service.archiveMaterial(nutritionist.id, id.data);
    revalidateMaterials(id.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Atribuir: material e paciente são reconferidos por ownership (o trigger do banco também recusa material alheio). */
export async function assignMaterialAction(materialId: string, patientId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const material = materialIdSchema.safeParse(materialId);
  const patient = patientIdSchema.safeParse(patientId);
  if (!material.success) return { ok: false, error: domainErrorMessage("MATERIAL_NOT_FOUND") };
  if (!patient.success) return { ok: false, error: domainErrorMessage("PATIENT_NOT_FOUND") };
  try {
    await service.assignMaterial(nutritionist.id, material.data, patient.data);
    revalidateMaterials(material.data, patient.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function unassignMaterialAction(assignmentId: string): Promise<ActionResult> {
  const nutritionist = await requireNutritionist();
  const id = assignmentIdSchema.safeParse(assignmentId);
  if (!id.success) return { ok: false, error: domainErrorMessage("MATERIAL_ASSIGNMENT_NOT_FOUND") };
  try {
    const result = await service.unassignMaterial(nutritionist.id, id.data);
    revalidateMaterials(result.materialId, result.patientId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
