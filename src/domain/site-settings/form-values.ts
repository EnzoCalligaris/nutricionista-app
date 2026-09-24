/**
 * Valor de cada campo do formulário a partir do que está gravado. Puro, para
 * a página não ter lógica de apresentação de tipo (prompt Fase 14 §59).
 *
 * Importante: NÃO usa os fallbacks de conteúdo. Um campo de conteúdo ainda
 * não personalizado aparece VAZIO, com o texto atual mostrado como
 * "texto atual do site" ao lado — assim o nutricionista vê o que está no ar
 * sem que a aplicação grave silenciosamente a copy de fallback no banco
 * (§12: depois de salvar, o banco é a fonte).
 */

import type { SettingDefinition } from "@/domain/site-settings/registry";
import type { SiteSettingsMap } from "@/domain/site-settings/resolve";

export type SettingFieldValue = { value: string; checked: boolean };

function toFieldValue(definition: SettingDefinition, raw: unknown): SettingFieldValue {
  if (definition.kind === "boolean") return { value: "", checked: raw === true };
  if (definition.kind === "integer") {
    return { value: typeof raw === "number" && Number.isFinite(raw) ? String(Math.trunc(raw)) : "", checked: false };
  }
  if (definition.kind === "list") {
    const items = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
    return { value: items.join("\n"), checked: false };
  }
  return { value: typeof raw === "string" ? raw : "", checked: false };
}

export function toFieldValues(definitions: SettingDefinition[], settings: SiteSettingsMap): Record<string, SettingFieldValue> {
  const values: Record<string, SettingFieldValue> = {};
  for (const definition of definitions) values[definition.key] = toFieldValue(definition, settings[definition.key]);
  return values;
}
