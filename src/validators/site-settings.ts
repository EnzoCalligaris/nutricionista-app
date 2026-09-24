import { z } from "zod";
import { validateExternalUrl } from "@/domain/patient-content/urls";
import { normalizePhoneE164 } from "@/domain/notifications/phone";
import { settingDefinition, type SettingDefinition, type SettingKind } from "@/domain/site-settings/registry";

/**
 * Validação e NORMALIZAÇÃO por tipo de configuração (prompt Fase 14 §57/§58).
 * URL reutiliza o validador da Fase 10 (`validateExternalUrl`) e telefone a
 * normalização E.164 da Fase 12 (`normalizePhoneE164`) — nenhuma regra nova
 * e paralela.
 *
 * O resultado é o valor JSON que vai para `site_settings.value`:
 * string, número, booleano, lista de strings — ou `null` para "apagar a
 * configuração" (campo deixado em branco).
 */

export type SettingValue = string | number | boolean | string[] | null;

export type SettingParse = { ok: true; value: SettingValue } | { ok: false; message: string };

const UF = /^[A-Z]{2}$/;
const CEP = /^\d{5}-?\d{3}$/;
/** Storage path do bucket `site-assets` gravado pela própria aplicação. */
const ASSET_PATH = /^[a-z0-9][a-z0-9/_-]{0,180}\.(webp|png|jpg|jpeg|svg)$/i;

function tooLong(definition: SettingDefinition): string {
  return `Use no máximo ${definition.maxLength} caracteres.`;
}

function parseText(raw: string, definition: SettingDefinition): SettingParse {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (definition.maxLength && value.length > definition.maxLength) return { ok: false, message: tooLong(definition) };
  return { ok: true, value };
}

function parseMultiline(raw: string, definition: SettingDefinition): SettingParse {
  // Preserva parágrafos, normaliza quebras e remove espaço à direita.
  const value = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!value) return { ok: true, value: null };
  if (definition.maxLength && value.length > definition.maxLength) return { ok: false, message: tooLong(definition) };
  return { ok: true, value };
}

function parseUrl(raw: string, definition: SettingDefinition): SettingParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (definition.maxLength && trimmed.length > definition.maxLength) return { ok: false, message: tooLong(definition) };
  const check = validateExternalUrl(trimmed);
  if (!check.ok) {
    return {
      ok: false,
      message:
        check.reason === "UNSAFE_PROTOCOL"
          ? "Use um endereço que comece com https://."
          : "Informe um endereço válido, começando com https://.",
    };
  }
  return { ok: true, value: check.url };
}

/** `@usuario`, `usuario` ou a URL completa → URL canônica do perfil. */
function parseInstagram(raw: string, definition: SettingDefinition): SettingParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    const handle = candidate.replace(/^@/, "");
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
      return { ok: false, message: "Informe o @usuario ou o endereço completo do perfil." };
    }
    candidate = `https://instagram.com/${handle}`;
  }
  return parseUrl(candidate, definition);
}

function parsePhone(raw: string): SettingParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalized = normalizePhoneE164(trimmed);
  if (!normalized.ok) return { ok: false, message: "Informe um telefone válido com DDD, ex.: (11) 99999-0001." };
  return { ok: true, value: normalized.e164 };
}

function parseEmail(raw: string, definition: SettingDefinition): SettingParse {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { ok: true, value: null };
  if (definition.maxLength && trimmed.length > definition.maxLength) return { ok: false, message: tooLong(definition) };
  if (!z.string().email().safeParse(trimmed).success) return { ok: false, message: "Informe um e-mail válido." };
  return { ok: true, value: trimmed };
}

function parseInteger(raw: string): SettingParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = z.coerce.number().int().min(0).max(80).safeParse(trimmed);
  if (!parsed.success) return { ok: false, message: "Informe um número inteiro entre 0 e 80." };
  return { ok: true, value: parsed.data };
}

function parseList(raw: string, definition: SettingDefinition): SettingParse {
  if (definition.maxLength && raw.length > definition.maxLength) return { ok: false, message: tooLong(definition) };
  const items = raw
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0);
  if (items.length === 0) return { ok: true, value: null };
  if (items.length > 20) return { ok: false, message: "Use no máximo 20 itens." };
  if (items.some((item) => item.length > 120)) return { ok: false, message: "Cada item deve ter no máximo 120 caracteres." };
  return { ok: true, value: items };
}

function parseAsset(raw: string): SettingParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  // O path é gerado pela aplicação ao subir o arquivo; aqui é só a barreira
  // contra um valor adulterado no formulário (§56).
  if (!ASSET_PATH.test(trimmed)) return { ok: false, message: "Imagem inválida — envie o arquivo novamente." };
  if (trimmed.includes("..")) return { ok: false, message: "Imagem inválida — envie o arquivo novamente." };
  return { ok: true, value: trimmed };
}

function parseSpecial(key: string, raw: string, definition: SettingDefinition): SettingParse | null {
  if (key === "address.state") {
    const value = raw.trim().toUpperCase();
    if (!value) return { ok: true, value: null };
    if (!UF.test(value)) return { ok: false, message: "Use a sigla do estado com 2 letras, ex.: SP." };
    return { ok: true, value };
  }
  if (key === "address.postal_code") {
    const value = raw.trim();
    if (!value) return { ok: true, value: null };
    if (!CEP.test(value)) return { ok: false, message: "Informe um CEP no formato 00000-000." };
    const digits = value.replace(/\D/g, "");
    return { ok: true, value: `${digits.slice(0, 5)}-${digits.slice(5)}` };
  }
  void definition;
  return null;
}

const PARSERS: Record<SettingKind, (raw: string, definition: SettingDefinition) => SettingParse> = {
  text: parseText,
  multiline: parseMultiline,
  email: parseEmail,
  phone: (raw) => parsePhone(raw),
  url: parseUrl,
  handle: parseInstagram,
  boolean: (raw) => ({ ok: true, value: raw === "on" || raw === "true" }),
  integer: (raw) => parseInteger(raw),
  list: parseList,
  asset: (raw) => parseAsset(raw),
};

/**
 * Valida um par chave/valor cru vindo do formulário. Chave fora do registry
 * é recusada — nunca gravada (§56).
 */
export function parseSettingInput(key: string, raw: string): SettingParse {
  const definition = settingDefinition(key);
  if (!definition) return { ok: false, message: "Configuração desconhecida." };
  const special = parseSpecial(key, raw, definition);
  if (special) return special;
  return PARSERS[definition.kind](raw, definition);
}

/** Imagem institucional aceita no bucket `site-assets` (§87). */
export const siteAssetFileSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["image/webp", "image/png", "image/jpeg"], { message: "Envie uma imagem WEBP, PNG ou JPG." }),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, { message: "A imagem deve ter no máximo 5 MB." }),
});
