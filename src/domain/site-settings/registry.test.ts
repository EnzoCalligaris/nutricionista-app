import { describe, expect, it } from "vitest";
import {
  LEGACY_PUBLIC_KEYS,
  SETTING_DEFINITIONS,
  isKnownSettingKey,
  resolveIsPublic,
  settingDefinition,
  settingsOfGroup,
} from "@/domain/site-settings/registry";

/** Registry fechado das configurações (prompt Fase 14 §8/§56/§65). */
describe("registry de site_settings", () => {
  it("não tem chave duplicada", () => {
    const keys = SETTING_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("toda chave respeita o formato aceito pelo banco (site_settings_key_format)", () => {
    const pattern = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition.key, definition.key).toMatch(pattern);
      expect(definition.key.length).toBeLessThanOrEqual(120);
    }
  });

  it("mantém as chaves que a Fase 4 já lia (compatibilidade do site público)", () => {
    for (const key of Object.values(LEGACY_PUBLIC_KEYS)) {
      // `contact.address` é legada de leitura: continua sendo respeitada pelo
      // resolver, mas o formulário grava os campos estruturados.
      if (key === "contact.address") continue;
      expect(isKnownSettingKey(key), key).toBe(true);
    }
  });

  it("recusa chave fora do registry", () => {
    expect(isKnownSettingKey("qualquer.coisa")).toBe(false);
    expect(settingDefinition("professional.salary")).toBeUndefined();
  });

  it("instruções e link da consulta online NUNCA são públicos", () => {
    for (const key of ["attendance.online_instructions", "attendance.online_base_url"]) {
      const definition = settingDefinition(key)!;
      expect(definition.visibility).toBe("private");
      expect(resolveIsPublic(definition, true)).toBe(false);
      expect(resolveIsPublic(definition, false)).toBe(false);
    }
  });

  it("endereço só é público quando a flag show_public está ligada (§6)", () => {
    const street = settingDefinition("address.street")!;
    expect(resolveIsPublic(street, true)).toBe(true);
    expect(resolveIsPublic(street, false)).toBe(false);
  });

  it("a própria flag de endereço é pública (o site precisa saber o estado)", () => {
    expect(resolveIsPublic(settingDefinition("address.show_public")!, false)).toBe(true);
  });

  it("agrupa os campos sem deixar grupo vazio", () => {
    for (const group of ["professional", "contact", "address", "attendance", "home", "seo"] as const) {
      expect(settingsOfGroup(group).length, group).toBeGreaterThan(0);
    }
  });

  it("não declara nenhum valor real de contato/CRN/plataforma (regra inegociável nº 1)", () => {
    const serialized = JSON.stringify(SETTING_DEFINITIONS);
    // Nenhum telefone, e-mail, CRN ou @handle embutido no registry.
    expect(serialized).not.toMatch(/\d{4,}-\d{4}/);
    expect(serialized).not.toMatch(/@[a-z0-9_.]+\.(com|br)/i);
    expect(serialized).not.toMatch(/CRN\s*\d/i);
  });
});
