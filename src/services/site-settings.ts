import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { DomainError, domainErrorFromDatabase } from "@/lib/errors/domain";
import { recordAudit } from "@/services/audit";
import {
  resolveIsPublic,
  settingDefinition,
  settingsOfGroup,
  type SettingGroupId,
} from "@/domain/site-settings/registry";
import { parseSettingInput, siteAssetFileSchema, type SettingValue } from "@/validators/site-settings";
import { getAllSiteSettings } from "@/data/site-settings";
import type { Json } from "@/types/database";

/**
 * Casos de uso das configurações do site (prompt Fase 14 §1–§12).
 *
 * Invariantes:
 * - só chave do registry é gravada (`SETTING_UNKNOWN_KEY` caso contrário);
 * - `is_public` é DERIVADO no servidor (`resolveIsPublic`) — nunca vem do
 *   formulário (§56);
 * - `updated_by` é sempre o nutricionista autenticado;
 * - campo em branco APAGA a linha (volta ao fallback versionado), em vez de
 *   gravar string vazia que o site teria de tratar como "existe mas vazio".
 */

export const SITE_ASSETS_BUCKET = "site-assets";

export type SettingsSaveResult = {
  changedKeys: string[];
  removedKeys: string[];
};

/**
 * Grava um GRUPO de configurações de uma vez (§59: formulários por seção).
 * `raw` traz o valor cru de cada campo do formulário, já mapeado por chave.
 */
export async function saveSettingsGroup(
  nutritionistId: string,
  group: SettingGroupId,
  raw: Record<string, string>,
): Promise<SettingsSaveResult> {
  const definitions = settingsOfGroup(group);
  const parsed = new Map<string, SettingValue>();
  const fieldErrors: Record<string, string> = {};

  for (const definition of definitions) {
    // Checkbox ausente do FormData significa "desligado".
    const value = raw[definition.key] ?? (definition.kind === "boolean" ? "" : undefined);
    if (value === undefined) continue;
    const result = parseSettingInput(definition.key, value);
    if (!result.ok) fieldErrors[definition.key] = result.message;
    else parsed.set(definition.key, result.value);
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new SettingsValidationError(fieldErrors);
  }

  // `address.show_public` define a visibilidade das linhas de endereço. Quando
  // o grupo salvo não é o de endereço, o valor atual do banco é o que vale.
  const current = await getAllSiteSettings();
  const showPublicAddress =
    parsed.has("address.show_public") ? parsed.get("address.show_public") === true : current["address.show_public"] === true;

  const supabase = await createClient();
  const rowsToUpsert: { key: string; value: Json; is_public: boolean; updated_by: string }[] = [];
  const keysToRemove: string[] = [];

  for (const [key, value] of parsed) {
    const definition = settingDefinition(key)!;
    if (value === null) {
      if (key in current) keysToRemove.push(key);
      continue;
    }
    rowsToUpsert.push({
      key,
      value: value as Json,
      is_public: resolveIsPublic(definition, showPublicAddress),
      updated_by: nutritionistId,
    });
  }

  // Ligar/desligar a flag muda a visibilidade das linhas de endereço já
  // gravadas — e isso precisa valer na mesma operação, senão o endereço
  // continuaria legível por `anon` depois de o admin pedir para esconder.
  if (group === "address") {
    for (const definition of settingsOfGroup("address")) {
      if (definition.visibility !== "address") continue;
      if (parsed.has(definition.key)) continue;
      if (!(definition.key in current)) continue;
      rowsToUpsert.push({
        key: definition.key,
        value: current[definition.key] as Json,
        is_public: showPublicAddress,
        updated_by: nutritionistId,
      });
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await supabase.from("site_settings").upsert(rowsToUpsert, { onConflict: "key" });
    if (error) throw domainErrorFromDatabase(error);
  }
  if (keysToRemove.length > 0) {
    const { error } = await supabase.from("site_settings").delete().in("key", keysToRemove);
    if (error) throw domainErrorFromDatabase(error);
  }

  const changedKeys = rowsToUpsert.map((row) => row.key);
  await recordAudit({
    actorId: nutritionistId,
    action: group === "home" || group === "seo" ? "PUBLIC_PROFILE_UPDATED" : "SETTINGS_UPDATED",
    entityType: "site_settings",
    entityId: null,
    // Metadata sem CONTEÚDO (§53): só o grupo e os nomes das chaves.
    metadata: { group, changed_keys: changedKeys, removed_keys: keysToRemove, address_public: showPublicAddress },
  });

  return { changedKeys, removedKeys: keysToRemove };
}

export class SettingsValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("VALIDATION_ERROR");
    this.name = "SettingsValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function isSettingsValidationError(error: unknown): error is SettingsValidationError {
  return error instanceof SettingsValidationError;
}

/** Assinaturas de imagem aceitas — o MIME do browser não é confiável (§87). */
function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const MIME_TO_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/**
 * Sobe um asset INSTITUCIONAL (foto profissional, logo, OG) para o bucket
 * público `site-assets` e grava o path na chave correspondente. Nenhuma foto
 * de paciente passa por aqui (§45/§46): esse bucket só recebe imagem
 * institucional, e o nome do arquivo original nunca é usado no path.
 */
export async function uploadSiteAsset(nutritionistId: string, key: string, file: File): Promise<{ path: string }> {
  const definition = settingDefinition(key);
  if (!definition || definition.kind !== "asset") throw new DomainError("SETTING_UNKNOWN_KEY");

  const meta = siteAssetFileSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (!meta.success) throw new DomainError("SITE_ASSET_INVALID");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) throw new DomainError("SITE_ASSET_INVALID");

  const folder = key.replace(/\./g, "-");
  const path = `${folder}/${randomUUID()}.${MIME_TO_EXT[mime]}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("[site-settings] upload de asset falhou:", uploadError.message);
    throw new DomainError("SITE_ASSET_UPLOAD_FAILED");
  }

  const current = await getAllSiteSettings();
  const previousPath = typeof current[key] === "string" ? (current[key] as string) : null;

  const { error } = await supabase.from("site_settings").upsert(
    { key, value: path as unknown as Json, is_public: true, updated_by: nutritionistId },
    { onConflict: "key" },
  );
  if (error) throw domainErrorFromDatabase(error);

  // Só remove o anterior depois de o novo estar gravado.
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(SITE_ASSETS_BUCKET).remove([previousPath]);
  }

  await recordAudit({
    actorId: nutritionistId,
    action: "SITE_ASSET_UPLOADED",
    entityType: "site_settings",
    entityId: null,
    metadata: { group: definition.group, changed_keys: [key], asset_mime: mime, asset_bytes: file.size },
  });

  return { path };
}

/** Remove um asset institucional e a chave que aponta para ele. */
export async function removeSiteAsset(nutritionistId: string, key: string): Promise<void> {
  const definition = settingDefinition(key);
  if (!definition || definition.kind !== "asset") throw new DomainError("SETTING_UNKNOWN_KEY");

  const current = await getAllSiteSettings();
  const path = typeof current[key] === "string" ? (current[key] as string) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").delete().eq("key", key);
  if (error) throw domainErrorFromDatabase(error);
  if (path) await supabase.storage.from(SITE_ASSETS_BUCKET).remove([path]);

  await recordAudit({
    actorId: nutritionistId,
    action: "SITE_ASSET_REMOVED",
    entityType: "site_settings",
    entityId: null,
    metadata: { group: definition.group, removed_keys: [key] },
  });
}

/** URL pública de um asset institucional (o bucket é público de propósito). */
export async function siteAssetPublicUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
}
