import { describe, expect, it } from "vitest";
import { EXTERNAL_LINK_REL, EXTERNAL_URL_MAX_LENGTH, externalUrlHost, validateExternalUrl } from "@/domain/patient-content/urls";

describe("validateExternalUrl (§61/§82)", () => {
  it("aceita https e http absolutos (https marcado como seguro)", () => {
    expect(validateExternalUrl("https://example.com")).toEqual({ ok: true, url: "https://example.com", secure: true });
    expect(validateExternalUrl("http://example.com/produto?x=1")).toEqual({ ok: true, url: "http://example.com/produto?x=1", secure: false });
    expect(validateExternalUrl("  https://loja.example.com/whey  ")).toMatchObject({ ok: true, url: "https://loja.example.com/whey" });
  });

  it("recusa javascript:, data:, file:, ftp: e protocol-relative", () => {
    expect(validateExternalUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
    expect(validateExternalUrl("JavaScript:alert(1)")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
    expect(validateExternalUrl("data:text/html,<script>alert(1)</script>")).toMatchObject({ ok: false });
    expect(validateExternalUrl("file:///etc/passwd")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
    expect(validateExternalUrl("ftp://example.com/a.pdf")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
    expect(validateExternalUrl("//evil.example")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
    expect(validateExternalUrl("vbscript:msgbox(1)")).toEqual({ ok: false, reason: "UNSAFE_PROTOCOL" });
  });

  it("recusa vazio, relativo, sem host, com espaço/controle e com credenciais", () => {
    expect(validateExternalUrl("")).toEqual({ ok: false, reason: "EMPTY" });
    expect(validateExternalUrl("   ")).toEqual({ ok: false, reason: "EMPTY" });
    expect(validateExternalUrl(null)).toEqual({ ok: false, reason: "EMPTY" });
    expect(validateExternalUrl("example.com/sem-protocolo")).toEqual({ ok: false, reason: "INVALID" });
    expect(validateExternalUrl("/caminho/interno")).toEqual({ ok: false, reason: "INVALID" });
    expect(validateExternalUrl("https://")).toEqual({ ok: false, reason: "INVALID" });
    expect(validateExternalUrl("https://semponto")).toEqual({ ok: false, reason: "MISSING_HOST" });
    expect(validateExternalUrl("https://exa mple.com")).toEqual({ ok: false, reason: "INVALID" });
    expect(validateExternalUrl("https://example.com/a\nb")).toEqual({ ok: false, reason: "INVALID" });
    expect(validateExternalUrl("https://user:pass@example.com")).toEqual({ ok: false, reason: "CREDENTIALS" });
    expect(validateExternalUrl(`https://example.com/${"a".repeat(EXTERNAL_URL_MAX_LENGTH)}`)).toEqual({ ok: false, reason: "TOO_LONG" });
  });

  it("nunca reescreve o link aceito e expõe o host para identificação", () => {
    const result = validateExternalUrl("http://example.com/Produto");
    expect(result.ok && result.url).toBe("http://example.com/Produto");
    expect(externalUrlHost("https://loja.example.com/x")).toBe("loja.example.com");
    expect(externalUrlHost("lixo")).toBe("");
    expect(EXTERNAL_LINK_REL).toBe("noopener noreferrer");
  });
});
