import { describe, expect, it } from "vitest";
import {
  customizedContentFields,
  formatAddressLine,
  hasAddress,
  publicAddressLine,
  resolveAddress,
  resolveOnlineAttendance,
  resolveProfessionalProfile,
  resolveSeoDefaults,
  resolveSiteContent,
} from "@/domain/site-settings/resolve";
import { SITE_CONTENT_FALLBACK } from "@/content/site-content";

/** Resolução das configurações (prompt Fase 14 §12/§93/§65). */
describe("resolveSiteContent", () => {
  it("usa o fallback versionado enquanto nada foi salvo (§12)", () => {
    expect(resolveSiteContent({})).toEqual(SITE_CONTENT_FALLBACK);
  });

  it("o banco vence o fallback campo por campo", () => {
    const content = resolveSiteContent({ "home.headline": "Nova headline" });
    expect(content.headline).toBe("Nova headline");
    // Os demais continuam no texto atual do site.
    expect(content.subheadline).toBe(SITE_CONTENT_FALLBACK.subheadline);
  });

  it("string vazia não conta como personalização", () => {
    const content = resolveSiteContent({ "home.headline": "   " });
    expect(content.headline).toBe(SITE_CONTENT_FALLBACK.headline);
    expect(customizedContentFields({ "home.headline": "   " })).toEqual([]);
  });

  it("lista quais textos já foram personalizados", () => {
    expect(customizedContentFields({ "home.headline": "A", "home.mission": "B" }).sort()).toEqual(["headline", "mission"]);
  });
});

describe("resolveProfessionalProfile", () => {
  it("devolve tudo vazio quando nada está configurado — nada é inventado", () => {
    const profile = resolveProfessionalProfile({});
    expect(profile.name).toBeUndefined();
    expect(profile.crn).toBeUndefined();
    expect(profile.specialties).toEqual([]);
    expect(profile.experienceYears).toBeUndefined();
  });

  it("ignora tipo errado em vez de quebrar a página (§93)", () => {
    const profile = resolveProfessionalProfile({
      "professional.name": 42,
      "professional.specialties": "não é lista",
      "professional.experience_years": "dois",
    });
    expect(profile.name).toBeUndefined();
    expect(profile.specialties).toEqual([]);
    expect(profile.experienceYears).toBeUndefined();
  });

  it("lê as áreas de atuação como lista de strings", () => {
    const profile = resolveProfessionalProfile({ "professional.specialties": ["Emagrecimento", "  ", 7, "Hipertrofia"] });
    expect(profile.specialties).toEqual(["Emagrecimento", "Hipertrofia"]);
  });
});

describe("endereço", () => {
  const full = {
    "address.place_name": "Consultório",
    "address.street": "Rua Exemplo",
    "address.number": "100",
    "address.complement": "Sala 5",
    "address.district": "Centro",
    "address.city": "Cidade",
    "address.state": "SP",
    "address.postal_code": "01234-567",
  };

  it("monta a linha só com o que existe", () => {
    expect(formatAddressLine(resolveAddress({ "address.city": "Cidade" }))).toBe("Cidade");
    expect(formatAddressLine(resolveAddress(full))).toBe("Consultório · Rua Exemplo, 100 — Sala 5 · Centro · Cidade/SP · 01234-567");
  });

  it("sem endereço configurado não há linha", () => {
    expect(hasAddress(resolveAddress({}))).toBe(false);
    expect(formatAddressLine(resolveAddress({}))).toBeUndefined();
  });

  it("não expõe publicamente sem a flag show_public (§6)", () => {
    expect(publicAddressLine(resolveAddress(full))).toBeUndefined();
    expect(publicAddressLine(resolveAddress({ ...full, "address.show_public": true }))).toContain("Rua Exemplo");
  });
});

describe("resolveOnlineAttendance", () => {
  it("vem vazio até ser configurado — nenhuma plataforma é sugerida (§7/§91)", () => {
    expect(resolveOnlineAttendance({})).toEqual({
      platform: undefined,
      instructions: undefined,
      baseUrl: undefined,
    });
  });

  it("lê o que está configurado", () => {
    const online = resolveOnlineAttendance({
      "attendance.online_platform": "Plataforma X",
      "attendance.online_instructions": "Entre 5 minutos antes.",
      "attendance.online_base_url": "https://sala.example.com/consulta",
    });
    expect(online.platform).toBe("Plataforma X");
    expect(online.instructions).toBe("Entre 5 minutos antes.");
    expect(online.baseUrl).toBe("https://sala.example.com/consulta");
  });
});

describe("resolveSeoDefaults", () => {
  it("vazio quando não configurado", () => {
    expect(resolveSeoDefaults({})).toEqual({ title: undefined, description: undefined, ogImagePath: undefined });
  });
});
