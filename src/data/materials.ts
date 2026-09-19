import "server-only";

import { createClient } from "@/lib/supabase/server";
import { domainErrorFromDatabase } from "@/lib/errors/domain";
import { sortMaterials, type MaterialKind } from "@/domain/patient-content/materials";

/**
 * Queries de materiais e atribuições (prompt Fase 10 §62). Cliente de sessão:
 * RLS decide quem vê (nutricionista = próprios materiais/pacientes; paciente =
 * só materiais ATRIBUÍDOS, não revogados, não arquivados e completos). O
 * portal repete o filtro na query.
 */

export type MaterialDetail = {
  id: string;
  nutritionistId: string;
  kind: MaterialKind;
  title: string;
  description: string | null;
  externalUrl: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaterialSummary = MaterialDetail & {
  /** Atribuições ativas (não revogadas). */
  activeAssignments: number;
};

export type AssignmentDetail = {
  id: string;
  materialId: string;
  patientId: string;
  assignedAt: string;
  revokedAt: string | null;
};

const MATERIAL_SELECT = "id, nutritionist_id, kind, title, description, external_url, storage_path, mime_type, file_name, file_size_bytes, archived_at, created_at, updated_at";

type MaterialRow = {
  id: string;
  nutritionist_id: string;
  kind: string;
  title: string;
  description: string | null;
  external_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = { id: string; material_id: string; patient_id: string; assigned_at: string; revoked_at: string | null };

function toMaterial(row: MaterialRow): MaterialDetail {
  return {
    id: row.id,
    nutritionistId: row.nutritionist_id,
    kind: row.kind === "LINK" ? "LINK" : "FILE",
    title: row.title,
    description: row.description,
    externalUrl: row.external_url,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAssignment(row: AssignmentRow): AssignmentDetail {
  return { id: row.id, materialId: row.material_id, patientId: row.patient_id, assignedAt: row.assigned_at, revokedAt: row.revoked_at };
}

/** Biblioteca do nutricionista (§33) com contagem de pacientes atribuídos; arquivados incluídos (por último). */
export async function listMaterials(nutritionistId: string): Promise<MaterialSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_materials")
    .select(`${MATERIAL_SELECT}, material_assignments(id, revoked_at)`)
    .eq("nutritionist_id", nutritionistId);
  if (error) throw domainErrorFromDatabase(error);
  const rows = (data ?? []) as unknown as (MaterialRow & { material_assignments: { id: string; revoked_at: string | null }[] })[];
  return sortMaterials(rows.map((row) => ({ ...toMaterial(row), activeAssignments: row.material_assignments.filter((entry) => entry.revoked_at === null).length })));
}

/** Materiais atribuíveis (ativos e completos) para o seletor do perfil do paciente. */
export async function listAssignableMaterials(nutritionistId: string): Promise<MaterialDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_materials")
    .select(MATERIAL_SELECT)
    .eq("nutritionist_id", nutritionistId)
    .is("archived_at", null)
    .order("title");
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as MaterialRow[]).map(toMaterial).filter((item) => (item.kind === "LINK" ? item.externalUrl !== null : item.storagePath !== null));
}

export async function getMaterialById(materialId: string): Promise<MaterialDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_materials").select(MATERIAL_SELECT).eq("id", materialId).maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toMaterial(data as MaterialRow) : null;
}

export type MaterialAssignmentWithPatient = AssignmentDetail & { patientName: string; patientStatus: string };

/** Quem recebeu o material (§33 "visualizar quem recebeu"), revogados incluídos como histórico. */
export async function listMaterialAssignments(materialId: string): Promise<MaterialAssignmentWithPatient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select("id, material_id, patient_id, assigned_at, revoked_at, patients!inner(full_name, status)")
    .eq("material_id", materialId)
    .order("assigned_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as unknown as (AssignmentRow & { patients: { full_name: string; status: string } })[]).map((row) => ({
    ...toAssignment(row),
    patientName: row.patients.full_name,
    patientStatus: row.patients.status,
  }));
}

export type PatientAssignment = AssignmentDetail & { material: MaterialDetail };

/** Aba Materiais do paciente (§42): atribuições com o material, ativas primeiro, mais recentes primeiro. */
export async function listPatientAssignments(patientId: string): Promise<PatientAssignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select(`id, material_id, patient_id, assigned_at, revoked_at, patient_materials!inner(${MATERIAL_SELECT})`)
    .eq("patient_id", patientId);
  if (error) throw domainErrorFromDatabase(error);
  const rows = ((data ?? []) as unknown as (AssignmentRow & { patient_materials: MaterialRow })[]).map((row) => ({ ...toAssignment(row), material: toMaterial(row.patient_materials) }));
  return rows.sort((a, b) => {
    const byActive = (a.revokedAt || a.material.archivedAt ? 1 : 0) - (b.revokedAt || b.material.archivedAt ? 1 : 0);
    if (byActive !== 0) return byActive;
    return b.assignedAt.localeCompare(a.assignedAt);
  });
}

export async function getAssignmentById(assignmentId: string): Promise<PatientAssignment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select(`id, material_id, patient_id, assigned_at, revoked_at, patient_materials!inner(${MATERIAL_SELECT})`)
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const row = data as unknown as AssignmentRow & { patient_materials: MaterialRow };
  return { ...toAssignment(row), material: toMaterial(row.patient_materials) };
}

/** Atribuição (ativa ou revogada) de um material a um paciente — a linha é única por par. */
export async function findAssignment(materialId: string, patientId: string): Promise<AssignmentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select("id, material_id, patient_id, assigned_at, revoked_at")
    .eq("material_id", materialId)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  return data ? toAssignment(data as AssignmentRow) : null;
}

/** Portal (§49): materiais disponíveis ao próprio paciente — a RLS já filtra; a query repete (não revogado, não arquivado). */
export async function listVisibleMaterialsForPatient(patientId: string): Promise<PatientAssignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select(`id, material_id, patient_id, assigned_at, revoked_at, patient_materials!inner(${MATERIAL_SELECT})`)
    .eq("patient_id", patientId)
    .is("revoked_at", null)
    .is("patient_materials.archived_at", null)
    .order("assigned_at", { ascending: false });
  if (error) throw domainErrorFromDatabase(error);
  return ((data ?? []) as unknown as (AssignmentRow & { patient_materials: MaterialRow })[])
    .map((row) => ({ ...toAssignment(row), material: toMaterial(row.patient_materials) }))
    .filter((row) => (row.material.kind === "LINK" ? row.material.externalUrl !== null : row.material.storagePath !== null));
}

/** Um material visível ao paciente (download): própria atribuição ativa + material ativo. */
export async function getVisibleMaterialForPatient(patientId: string, materialId: string): Promise<PatientAssignment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_assignments")
    .select(`id, material_id, patient_id, assigned_at, revoked_at, patient_materials!inner(${MATERIAL_SELECT})`)
    .eq("patient_id", patientId)
    .eq("material_id", materialId)
    .is("revoked_at", null)
    .is("patient_materials.archived_at", null)
    .maybeSingle();
  if (error) throw domainErrorFromDatabase(error);
  if (!data) return null;
  const row = data as unknown as AssignmentRow & { patient_materials: MaterialRow };
  return { ...toAssignment(row), material: toMaterial(row.patient_materials) };
}
