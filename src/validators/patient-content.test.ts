import { describe, expect, it } from "vitest";
import { feedbackSchema, materialFileMetaSchema, materialSchema, materialUpdateSchema, supplementSchema } from "@/validators/patient-content";

describe("supplementSchema (§5–§9)", () => {
  it("aceita só nome; textos vazios viram null; link https válido passa", () => {
    const parsed = supplementSchema.safeParse({ name: "Whey", brand: "", instructions: "", doseText: "", scheduleText: "", startsOn: "", endsOn: "", notes: "", purchaseUrl: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ name: "Whey", brand: null, instructions: null, doseText: null, scheduleText: null, startsOn: null, endsOn: null, notes: null, purchaseUrl: null });
    }
    const withUrl = supplementSchema.safeParse({ name: "Whey", purchaseUrl: " https://loja.example.com/whey " });
    expect(withUrl.success && withUrl.data.purchaseUrl).toBe("https://loja.example.com/whey");
  });

  it("recusa link inseguro, nome curto e período invertido", () => {
    const bad = supplementSchema.safeParse({ name: "W", purchaseUrl: "javascript:alert(1)" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const paths = bad.error.issues.map((issue) => String(issue.path[0]));
      expect(paths).toEqual(expect.arrayContaining(["name", "purchaseUrl"]));
    }
    const inverted = supplementSchema.safeParse({ name: "Whey", startsOn: "2026-09-10", endsOn: "2026-09-01" });
    expect(inverted.success).toBe(false);
    if (!inverted.success) expect(inverted.error.issues[0]?.path).toEqual(["endsOn"]);
    for (const url of ["data:text/html,x", "//evil.example", "ftp://x.example/a", "example.com"]) {
      expect(supplementSchema.safeParse({ name: "Whey", purchaseUrl: url }).success).toBe(false);
    }
  });

  it("descarta campos privilegiados (mass assignment, §60)", () => {
    const parsed = supplementSchema.safeParse({ name: "Whey", patient_id: "x", created_by: "y", archived_at: "z", active: false });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(Object.keys(parsed.data)).not.toEqual(expect.arrayContaining(["patient_id", "created_by", "archived_at", "active"]));
  });
});

describe("feedbackSchema (§20–§22)", () => {
  it("exige mensagem; título/data opcionais; publish default false", () => {
    expect(feedbackSchema.safeParse({ content: "ok" }).success).toBe(false);
    const parsed = feedbackSchema.safeParse({ title: "", content: "  Bom trabalho na semana.  ", referenceDate: "2026-09-10" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ title: null, content: "Bom trabalho na semana.", referenceDate: "2026-09-10", publish: false });
    expect(feedbackSchema.safeParse({ content: "abc", referenceDate: "10/09/2026" }).success).toBe(false);
  });
});

describe("materialSchema (§34–§35/§48)", () => {
  it("link exige URL segura; arquivo não aceita URL; tipo desconhecido recusado", () => {
    expect(materialSchema.safeParse({ kind: "LINK", title: "Guia", externalUrl: "https://example.com/guia" }).success).toBe(true);
    expect(materialSchema.safeParse({ kind: "LINK", title: "Guia", externalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(materialSchema.safeParse({ kind: "LINK", title: "Guia", externalUrl: "" }).success).toBe(false);
    const file = materialSchema.safeParse({ kind: "FILE", title: "PDF", externalUrl: "https://example.com" });
    expect(file.success && "externalUrl" in file.data).toBe(false);
    expect(materialSchema.safeParse({ kind: "EXE", title: "x" }).success).toBe(false);
  });

  it("edição: link opcional mas validado; descrição limitada", () => {
    expect(materialUpdateSchema.safeParse({ title: "Guia", description: "", externalUrl: "" }).success).toBe(true);
    expect(materialUpdateSchema.safeParse({ title: "Guia", externalUrl: "ftp://x.example/a" }).success).toBe(false);
    expect(materialUpdateSchema.safeParse({ title: "Guia", description: "x".repeat(1001) }).success).toBe(false);
  });

  it("metadados do arquivo: só PDF/JPG/PNG até 10 MB, nunca vazio", () => {
    expect(materialFileMetaSchema.safeParse({ name: "a.pdf", type: "application/pdf", size: 10 }).success).toBe(true);
    expect(materialFileMetaSchema.safeParse({ name: "a.exe", type: "application/x-msdownload", size: 10 }).success).toBe(false);
    expect(materialFileMetaSchema.safeParse({ name: "a.pdf", type: "application/pdf", size: 0 }).success).toBe(false);
    expect(materialFileMetaSchema.safeParse({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});
