"use server";

import { revalidatePath } from "next/cache";
import { requireNutritionist } from "@/lib/auth/session";
import { domainErrorMessage, isDomainError } from "@/lib/errors/domain";
import { revalidatePublicSite } from "@/lib/revalidate";
import { settingsOfGroup, type SettingGroupId } from "@/domain/site-settings/registry";
import * as service from "@/services/site-settings";

/**
 * Server Actions das configurações (prompt Fase 14 §1–§12, §60, §62):
 * requireNutritionist → validação do registry (no service) → gravação →
 * auditoria → revalidação explícita do site público. O toast só aparece
 * depois da confirmação do servidor (§62) porque o estado retornado vem da
 * própria action.
 */

export type SettingsFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: number;
};

function errorMessage(error: unknown): string {
  if (isDomainError(error)) return error.message;
  console.error("[site-settings] erro inesperado:", error instanceof Error ? error.message : "erro");
  return domainErrorMessage("UNKNOWN");
}

/**
 * Salva um grupo. Só as chaves DAQUELE grupo são lidas do FormData — um
 * campo injetado de outro grupo é simplesmente ignorado (§56).
 */
export async function saveSettingsGroupAction(
  group: SettingGroupId,
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const nutritionist = await requireNutritionist();

  const raw: Record<string, string> = {};
  for (const definition of settingsOfGroup(group)) {
    const value = formData.get(definition.key);
    raw[definition.key] = typeof value === "string" ? value : "";
  }

  try {
    await service.saveSettingsGroup(nutritionist.id, group, raw);
  } catch (error) {
    if (service.isSettingsValidationError(error)) {
      return { error: domainErrorMessage("VALIDATION_ERROR"), fieldErrors: error.fieldErrors };
    }
    return { error: errorMessage(error) };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath(`/dashboard/configuracoes/${GROUP_ROUTES[group]}`);
  revalidatePublicSite();
  return { ok: true, savedAt: Date.now() };
}

const GROUP_ROUTES: Record<SettingGroupId, string> = {
  professional: "perfil",
  contact: "contato",
  address: "contato",
  attendance: "atendimento",
  home: "site",
  seo: "site",
};

export async function uploadSiteAssetAction(
  key: string,
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const nutritionist = await requireNutritionist();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem.", fieldErrors: { file: "Selecione uma imagem." } };
  }

  try {
    await service.uploadSiteAsset(nutritionist.id, key, file);
  } catch (error) {
    return { error: errorMessage(error), fieldErrors: { file: errorMessage(error) } };
  }

  revalidatePath("/dashboard/configuracoes/perfil");
  revalidatePath("/dashboard/configuracoes/site");
  revalidatePublicSite();
  return { ok: true, savedAt: Date.now() };
}

export async function removeSiteAssetAction(key: string): Promise<SettingsFormState> {
  const nutritionist = await requireNutritionist();
  try {
    await service.removeSiteAsset(nutritionist.id, key);
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/dashboard/configuracoes/perfil");
  revalidatePath("/dashboard/configuracoes/site");
  revalidatePublicSite();
  return { ok: true, savedAt: Date.now() };
}
