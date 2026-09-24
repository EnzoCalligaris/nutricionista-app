import { describe, expect, it } from "vitest";
import { parseSettingInput, siteAssetFileSchema } from "@/validators/site-settings";

/** Validação/normalização das configurações (prompt Fase 14 §57/§58/§65). */
describe("parseSettingInput", () => {
  it("recusa chave desconhecida (mass assignment, §56)", () => {
    expect(parseSettingInput("professional.salary", "10000")).toEqual({ ok: false, message: "Configuração desconhecida." });
  });

  it("campo em branco apaga a configuração (null), não grava string vazia", () => {
    expect(parseSettingInput("professional.name", "   ")).toEqual({ ok: true, value: null });
    expect(parseSettingInput("home.headline", "\n\n")).toEqual({ ok: true, value: null });
  });

  describe("telefone (reutiliza a normalização E.164 da Fase 12, §58)", () => {
    it("normaliza formatos brasileiros comuns", () => {
      expect(parseSettingInput("contact.phone", "(11) 99999-0001")).toEqual({ ok: true, value: "+5511999990001" });
      expect(parseSettingInput("contact.whatsapp", "11 9 9999 0001")).toEqual({ ok: true, value: "+5511999990001" });
      expect(parseSettingInput("contact.phone", "+55 (11) 99999-0001")).toEqual({ ok: true, value: "+5511999990001" });
    });

    it("recusa número implausível", () => {
      const result = parseSettingInput("contact.phone", "123");
      expect(result.ok).toBe(false);
    });
  });

  describe("URL (reutiliza validateExternalUrl da Fase 10, §57)", () => {
    it("aceita https", () => {
      expect(parseSettingInput("social.linkedin", "https://www.linkedin.com/in/exemplo")).toEqual({
        ok: true,
        value: "https://www.linkedin.com/in/exemplo",
      });
    });

    it("recusa javascript:, data: e protocol-relative", () => {
      for (const attack of ["javascript:alert(1)", "data:text/html,<script>", "//evil.example.com"]) {
        expect(parseSettingInput("social.linkedin", attack).ok, attack).toBe(false);
      }
    });

    it("recusa URL com credencial embutida", () => {
      expect(parseSettingInput("attendance.online_base_url", "https://user:pass@meet.example.com").ok).toBe(false);
    });
  });

  describe("Instagram", () => {
    it("aceita @handle e monta a URL canônica", () => {
      expect(parseSettingInput("social.instagram", "@exemplo_nutri")).toEqual({
        ok: true,
        value: "https://instagram.com/exemplo_nutri",
      });
    });

    it("aceita a URL completa", () => {
      expect(parseSettingInput("social.instagram", "https://instagram.com/exemplo")).toEqual({
        ok: true,
        value: "https://instagram.com/exemplo",
      });
    });

    it("recusa handle com caractere inválido", () => {
      expect(parseSettingInput("social.instagram", "@ex emplo").ok).toBe(false);
      expect(parseSettingInput("social.instagram", "@exemplo/../admin").ok).toBe(false);
    });
  });

  it("e-mail é normalizado para minúsculas e validado", () => {
    expect(parseSettingInput("contact.email", "  Contato@Exemplo.COM ")).toEqual({ ok: true, value: "contato@exemplo.com" });
    expect(parseSettingInput("contact.email", "contato@").ok).toBe(false);
  });

  it("UF exige 2 letras e sobe para maiúsculas", () => {
    expect(parseSettingInput("address.state", "sp")).toEqual({ ok: true, value: "SP" });
    expect(parseSettingInput("address.state", "São Paulo").ok).toBe(false);
  });

  it("CEP é normalizado para 00000-000", () => {
    expect(parseSettingInput("address.postal_code", "01234567")).toEqual({ ok: true, value: "01234-567" });
    expect(parseSettingInput("address.postal_code", "01234-567")).toEqual({ ok: true, value: "01234-567" });
    expect(parseSettingInput("address.postal_code", "123").ok).toBe(false);
  });

  it("boolean vem do checkbox", () => {
    expect(parseSettingInput("address.show_public", "on")).toEqual({ ok: true, value: true });
    expect(parseSettingInput("address.show_public", "")).toEqual({ ok: true, value: false });
  });

  it("inteiro aceita faixa plausível e recusa texto", () => {
    expect(parseSettingInput("professional.experience_years", "2")).toEqual({ ok: true, value: 2 });
    expect(parseSettingInput("professional.experience_years", "")).toEqual({ ok: true, value: null });
    expect(parseSettingInput("professional.experience_years", "abc").ok).toBe(false);
    expect(parseSettingInput("professional.experience_years", "-1").ok).toBe(false);
  });

  it("lista vira array de linhas não vazias", () => {
    expect(parseSettingInput("professional.specialties", "Emagrecimento\n\n  Hipertrofia  \n")).toEqual({
      ok: true,
      value: ["Emagrecimento", "Hipertrofia"],
    });
    expect(parseSettingInput("professional.specialties", "   ")).toEqual({ ok: true, value: null });
  });

  it("texto longo é recusado pelo limite do campo", () => {
    expect(parseSettingInput("home.headline", "x".repeat(161)).ok).toBe(false);
    expect(parseSettingInput("seo.default_description", "x".repeat(181)).ok).toBe(false);
  });

  it("multiline preserva parágrafos", () => {
    const result = parseSettingInput("home.subheadline", "Primeira linha\n\nSegunda linha");
    expect(result).toEqual({ ok: true, value: "Primeira linha\n\nSegunda linha" });
  });

  describe("asset", () => {
    it("aceita um path gerado pela aplicação", () => {
      expect(parseSettingInput("professional.photo_path", "professional-photo_path/abc.webp")).toEqual({
        ok: true,
        value: "professional-photo_path/abc.webp",
      });
    });

    it("recusa path traversal e extensão estranha", () => {
      expect(parseSettingInput("professional.photo_path", "../../etc/passwd.webp").ok).toBe(false);
      expect(parseSettingInput("professional.photo_path", "foto/arquivo.svgz").ok).toBe(false);
    });
  });

  it("imagem institucional respeita tipo e tamanho (§87)", () => {
    expect(siteAssetFileSchema.safeParse({ name: "a.webp", type: "image/webp", size: 1000 }).success).toBe(true);
    expect(siteAssetFileSchema.safeParse({ name: "a.gif", type: "image/gif", size: 1000 }).success).toBe(false);
    expect(siteAssetFileSchema.safeParse({ name: "a.webp", type: "image/webp", size: 6 * 1024 * 1024 }).success).toBe(false);
  });
});
