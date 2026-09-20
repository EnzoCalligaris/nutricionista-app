import type { FoodAnalysisInput, FoodAnalysisOutput, FoodAnalysisProvider } from "@/services/food-analysis/provider";

/**
 * Provider FAKE para desenvolvimento e testes (prompt Fase 11 §3/§93):
 * determinístico (o prato é escolhido pelo conteúdo da imagem), rápido e
 * sem rede. Nunca produz valores "reais" — a UI marca a estimativa como
 * simulada. Como a imagem chega já processada (WebP sem metadados), os
 * cenários de falha dos testes (§88–§89) são sinalizados por DIMENSÕES
 * mínimas que nenhuma foto real tem (largura × altura em pixels):
 *   2×1 → TIMEOUT   (nunca responde; respeita o AbortSignal)
 *   3×1 → INVALID   (JSON com calorias negativas — o schema recusa)
 *   4×1 → MALFORMED (resposta que nem é objeto)
 *   5×1 → ERROR     (erro genérico do fornecedor)
 *   6×1 → EMPTY     (nenhum alimento identificado)
 */

const PLATES = [
  {
    foods: [
      { name: "Arroz branco cozido", estimated_quantity: 150, unit: "g", preparation_method: "cozido", estimated_calories: 195, estimated_protein_g: 4, estimated_carbs_g: 42, estimated_fat_g: 0.5, confidence: 0.86, uncertain: false },
      { name: "Feijão carioca", estimated_quantity: 100, unit: "g", preparation_method: "cozido", estimated_calories: 77, estimated_protein_g: 4.8, estimated_carbs_g: 13.6, estimated_fat_g: 0.5, confidence: 0.82, uncertain: false },
      { name: "Filé de frango grelhado", estimated_quantity: 120, unit: "g", preparation_method: "grelhado", estimated_calories: 198, estimated_protein_g: 37, estimated_carbs_g: 0, estimated_fat_g: 4.8, confidence: 0.78, uncertain: false },
      { name: "Salada de folhas", estimated_quantity: 60, unit: "g", preparation_method: "cru", estimated_calories: 12, estimated_protein_g: 1, estimated_carbs_g: 2, estimated_fat_g: 0.1, confidence: 0.7, uncertain: false },
    ],
    notes: { ambiguities: ["Confirme se houve uso de óleo ou azeite no preparo ou na salada.", "Molho, se houver, não é visível na foto."], assumptions: ["Porção de arroz estimada pelo volume no prato."] },
  },
  {
    foods: [
      { name: "Pão francês", estimated_quantity: 1, unit: "unidade", preparation_method: "nao_informado", estimated_calories: 135, estimated_protein_g: 4, estimated_carbs_g: 28, estimated_fat_g: 1.5, confidence: 0.9, uncertain: false },
      { name: "Ovo mexido", estimated_quantity: 2, unit: "unidade", preparation_method: "refogado", estimated_calories: 180, estimated_protein_g: 12, estimated_carbs_g: 1, estimated_fat_g: 13, confidence: 0.8, uncertain: false },
      { name: "Café com leite", estimated_quantity: 200, unit: "ml", preparation_method: "nao_informado", estimated_calories: 80, estimated_protein_g: 4, estimated_carbs_g: 6, estimated_fat_g: 4, confidence: 0.6, uncertain: true },
    ],
    notes: { ambiguities: ["Não é possível ver se o café tem açúcar ou adoçante.", "Confirme se o ovo foi preparado com manteiga ou óleo."], assumptions: ["Leite integral considerado na estimativa."] },
  },
  {
    foods: [
      { name: "Macarrão ao molho de tomate", estimated_quantity: 200, unit: "g", preparation_method: "cozido", estimated_calories: 262, estimated_protein_g: 9, estimated_carbs_g: 50, estimated_fat_g: 2.5, confidence: 0.75, uncertain: false },
      { name: "Queijo ralado", estimated_quantity: 1, unit: "colher_sopa", preparation_method: "nao_informado", estimated_calories: 36, estimated_protein_g: 3, estimated_carbs_g: 0.3, estimated_fat_g: 2.6, confidence: 0.55, uncertain: true },
    ],
    notes: { ambiguities: ["O tipo de molho e a quantidade de azeite não são visíveis."], assumptions: ["Molho de tomate simples considerado."] },
  },
] as const;

export const FAKE_SCENARIO_BY_WIDTH: Record<number, "TIMEOUT" | "INVALID" | "MALFORMED" | "ERROR" | "EMPTY"> = { 2: "TIMEOUT", 3: "INVALID", 4: "MALFORMED", 5: "ERROR", 6: "EMPTY" };

function markerIn(input: FoodAnalysisInput): string | null {
  return input.height === 1 ? (FAKE_SCENARIO_BY_WIDTH[input.width] ?? null) : null;
}

function hashBytes(bytes: Uint8Array): number {
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index]!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export class FakeFoodAnalysisProvider implements FoodAnalysisProvider {
  readonly id = "fake";
  readonly model = "fake-deterministic-v1";
  readonly simulated = true;

  async analyzeMealPhoto(input: FoodAnalysisInput): Promise<FoodAnalysisOutput> {
    const marker = markerIn(input);
    if (marker === "TIMEOUT") {
      await new Promise<void>((_, reject) => {
        input.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    if (marker === "ERROR") throw new Error("fake provider error");
    if (marker === "MALFORMED") return { result: "isto não é um objeto JSON válido para o schema", requestId: "fake-malformed" };
    if (marker === "INVALID") {
      return { result: { foods: [{ name: "Arroz", estimated_quantity: 100, unit: "g", estimated_calories: -500, estimated_protein_g: 2, estimated_carbs_g: 28, estimated_fat_g: 0.3 }] }, requestId: "fake-invalid" };
    }
    if (marker === "EMPTY") return { result: { foods: [], notes: { ambiguities: ["Nenhum alimento identificado com clareza na imagem."], assumptions: [] } }, requestId: "fake-empty" };

    const plate = PLATES[hashBytes(input.imageBytes) % PLATES.length]!;
    return {
      result: { foods: plate.foods.map((food) => ({ ...food })), notes: { ambiguities: [...plate.notes.ambiguities], assumptions: [...plate.notes.assumptions] } },
      requestId: `fake-${hashBytes(input.imageBytes).toString(16)}`,
      usage: null,
    };
  }
}
