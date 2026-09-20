import { describe, expect, it } from "vitest";
import { buildConfirmedResult, computeTotals, diffResults, formatGrams, formatKcal, formatQuantity, type AnalysisResult, type FoodItem } from "@/domain/food-analysis/estimates";
import {
  MEAL_PHOTO_AI_CONSENT_TEXT,
  MEAL_PHOTO_AI_CONSENT_TYPE,
  MEAL_PHOTO_AI_CONSENT_VERSION,
  PROCESSING_STALE_MS,
  analysisUiStatus,
  canArchive,
  canRequestAnalysis,
  canReview,
  isMealTimeAcceptable,
  isProcessing,
  sortByMealDesc,
} from "@/domain/food-analysis/status";

const item = (id: string, name: string, quantity: number, calories: number, proteinG: number, carbsG: number, fatG: number, extra: Partial<FoodItem> = {}): FoodItem => ({
  id,
  name,
  quantity,
  unit: "g",
  preparation: "cozido",
  calories,
  proteinG,
  carbsG,
  fatG,
  confidence: 0.8,
  uncertain: false,
  source: "AI",
  ...extra,
});

const arroz = item("a", "Arroz", 150, 130, 2.5, 28, 0.3);
const frango = item("f", "Frango", 120, 200, 38, 0, 5);
const original: AnalysisResult = { items: [arroz, frango], totals: computeTotals([arroz, frango]), ambiguities: ["Confirme se houve uso de óleo."], assumptions: [] };
let counter = 0;
const newId = () => `new-${++counter}`;

describe("totais (§36/§85)", () => {
  it("soma os itens: 330 kcal, 28 g carbo, 40,5 g proteína, 5,3 g gordura", () => {
    expect(computeTotals([arroz, frango])).toEqual({ calories: 330, proteinG: 40.5, carbsG: 28, fatG: 5.3 });
  });

  it("depois de remover o arroz o total é só o frango", () => {
    const confirmed = buildConfirmedResult(original, [{ id: "f", name: "Frango", quantity: 120, unit: "g", preparation: "cozido", calories: 200, proteinG: 38, carbsG: 0, fatG: 5 }], newId);
    expect(confirmed.totals).toEqual({ calories: 200, proteinG: 38, carbsG: 0, fatG: 5 });
    expect(confirmed.items).toHaveLength(1);
    expect(original.totals.calories).toBe(330);
  });

  it("arredonda: kcal inteiro, macros 1 casa (sem ruído binário)", () => {
    expect(computeTotals([item("x", "x", 1, 10.4, 0.1, 0.2, 0.7), item("y", "y", 1, 10.4, 0.2, 0.1, 0.1)])).toEqual({ calories: 21, proteinG: 0.3, carbsG: 0.3, fatG: 0.8 });
    expect(formatKcal(329.6)).toBe("330 kcal");
    expect(formatGrams(40.46)).toBe("40,5 g");
    expect(formatGrams(28)).toBe("28 g");
    expect(formatQuantity(150, "g")).toBe("150 g");
    expect(formatQuantity(2, "unidade")).toBe("2 unidade(s)");
  });
});

describe("original x confirmado (§33/§86–§87)", () => {
  it("corrigir 150 g → 100 g mantém o original em 150 g", () => {
    const confirmed = buildConfirmedResult(original, [
      { id: "a", name: "Arroz", quantity: 100, unit: "g", preparation: "cozido", calories: 87, proteinG: 1.7, carbsG: 18.7, fatG: 0.2 },
      { id: "f", name: "Frango", quantity: 120, unit: "g", preparation: "cozido", calories: 200, proteinG: 38, carbsG: 0, fatG: 5 },
    ], newId);
    expect(confirmed.items[0]).toMatchObject({ id: "a", quantity: 100, source: "AI", confidence: 0.8 });
    expect(original.items[0]!.quantity).toBe(150);
    const changes = diffResults(original, confirmed);
    expect(changes).toEqual([{ kind: "CHANGED", before: arroz, after: confirmed.items[0], fields: ["quantity", "calories", "proteinG", "carbsG", "fatG"] }]);
  });

  it("item adicionado pelo paciente (azeite) só existe na versão confirmada", () => {
    const confirmed = buildConfirmedResult(original, [
      { id: "a", name: "Arroz", quantity: 150, unit: "g", preparation: "cozido", calories: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3 },
      { id: "f", name: "Frango", quantity: 120, unit: "g", preparation: "cozido", calories: 200, proteinG: 38, carbsG: 0, fatG: 5 },
      { id: null, name: "Azeite", quantity: 1, unit: "colher_sopa", preparation: "nao_informado", calories: 120, proteinG: 0, carbsG: 0, fatG: 13.5 },
    ], newId);
    expect(confirmed.items).toHaveLength(3);
    expect(confirmed.items[2]).toMatchObject({ name: "Azeite", source: "PATIENT", confidence: null });
    expect(original.items.some((entry) => entry.name === "Azeite")).toBe(false);
    expect(confirmed.totals).toEqual({ calories: 450, proteinG: 40.5, carbsG: 28, fatG: 18.8 });
    const changes = diffResults(original, confirmed);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("ADDED");
  });

  it("diff reporta removidos e ids desconhecidos viram itens novos", () => {
    const confirmed = buildConfirmedResult(original, [{ id: "ghost", name: "Salada", quantity: 50, unit: "g", preparation: "cru", calories: 10, proteinG: 1, carbsG: 1, fatG: 0 }], newId);
    expect(confirmed.items[0]!.source).toBe("PATIENT");
    const kinds = diffResults(original, confirmed).map((change) => change.kind);
    expect(kinds).toEqual(["REMOVED", "REMOVED", "ADDED"]);
  });
});

describe("máquina de estados (§23–§27/§40–§41)", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const base = { processingStartedAt: null, archivedAt: null };

  it("mapeia status do banco + claim + arquivamento para a UI", () => {
    expect(analysisUiStatus({ status: "PENDING", ...base }, now)).toBe("UPLOADED");
    expect(analysisUiStatus({ status: "PENDING", processingStartedAt: new Date(now.getTime() - 5_000).toISOString(), archivedAt: null }, now)).toBe("PROCESSING");
    expect(analysisUiStatus({ status: "PENDING", processingStartedAt: new Date(now.getTime() - PROCESSING_STALE_MS - 1).toISOString(), archivedAt: null }, now)).toBe("UPLOADED");
    expect(analysisUiStatus({ status: "ANALYZED", ...base }, now)).toBe("REVIEW_REQUIRED");
    expect(analysisUiStatus({ status: "CONFIRMED", ...base }, now)).toBe("CONFIRMED");
    expect(analysisUiStatus({ status: "FAILED", ...base }, now)).toBe("FAILED");
    expect(analysisUiStatus({ status: "CONFIRMED", processingStartedAt: null, archivedAt: "2026-09-19T00:00:00Z" }, now)).toBe("ARCHIVED");
  });

  it("pode pedir análise só sem claim recente (ou após falha); revisar só analisada; arquivar não enquanto processa", () => {
    expect(canRequestAnalysis({ status: "PENDING", ...base }, now)).toBe(true);
    expect(canRequestAnalysis({ status: "FAILED", ...base }, now)).toBe(true);
    expect(canRequestAnalysis({ status: "PENDING", processingStartedAt: now.toISOString(), archivedAt: null }, now)).toBe(false);
    expect(canRequestAnalysis({ status: "ANALYZED", ...base }, now)).toBe(false);
    expect(canReview({ status: "ANALYZED", ...base })).toBe(true);
    expect(canReview({ status: "CONFIRMED", ...base })).toBe(false);
    expect(isProcessing({ status: "FAILED", processingStartedAt: now.toISOString() }, now)).toBe(false);
    expect(canArchive({ status: "PENDING", processingStartedAt: new Date().toISOString(), archivedAt: null })).toBe(false);
    expect(canArchive({ status: "CONFIRMED", ...base })).toBe(true);
  });

  it("histórico mais recente primeiro pela data da refeição", () => {
    const sorted = sortByMealDesc([
      { id: "a", mealAt: "2026-09-10T12:00:00Z", createdAt: "2026-09-10T12:00:00Z" },
      { id: "b", mealAt: "2026-09-12T08:00:00Z", createdAt: "2026-09-12T08:00:00Z" },
      { id: "c", mealAt: "2026-09-12T08:00:00Z", createdAt: "2026-09-12T09:00:00Z" },
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });
});

describe("consentimento e data da refeição (§19–§22/§58–§59)", () => {
  it("versão e tipo estáveis; texto explica IA, estimativa, fornecedor e opcionalidade sem alegação jurídica", () => {
    expect(MEAL_PHOTO_AI_CONSENT_TYPE).toBe("MEAL_PHOTO_AI");
    expect(MEAL_PHOTO_AI_CONSENT_VERSION).toBe("meal_photo_ai_v1");
    const text = MEAL_PHOTO_AI_CONSENT_TEXT.join(" ");
    expect(text).toMatch(/inteligência artificial/);
    expect(text).toMatch(/estimativa/);
    expect(text).toMatch(/fornecedor/);
    expect(text).toMatch(/opcional/);
    expect(text).not.toMatch(/LGPD|artigo|lei n/i);
  });

  it("refeição até 10 min no futuro é tolerância de relógio; além disso não", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    expect(isMealTimeAcceptable(new Date("2026-09-19T11:00:00Z"), now)).toBe(true);
    expect(isMealTimeAcceptable(new Date("2026-09-19T12:09:00Z"), now)).toBe(true);
    expect(isMealTimeAcceptable(new Date("2026-09-19T12:11:00Z"), now)).toBe(false);
    expect(isMealTimeAcceptable(new Date("x"), now)).toBe(false);
  });
});
