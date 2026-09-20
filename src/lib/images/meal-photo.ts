import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Processamento da foto da refeição (prompt Fase 11 §11–§13/§54–§55):
 * - tipo conferido pela ASSINATURA (JPEG/PNG/WebP), nunca pelo MIME do browser;
 * - limite técnico de entrada (12 MB) — nunca mandamos o original ao provider;
 * - orientação EXIF aplicada, redimensionamento para no máximo 1600 px no
 *   maior lado (legibilidade preservada), conversão para WebP;
 * - `sharp` NÃO copia metadados por padrão (só com `.withMetadata()`): o WebP
 *   sai sem EXIF/GPS/ICC do original;
 * - só a imagem processada é guardada (o original é descartado após o
 *   processamento) e o sha256 dela identifica reenvios idênticos.
 * HEIC/HEIF não é aceito: o `sharp` embutido no Next não traz libheif de
 * forma confiável — documentado como pendência (docs/DECISIONS.md).
 */

import { MEAL_PHOTO_ACCEPTED_MIMES, MEAL_PHOTO_MAX_EDGE_PX, MEAL_PHOTO_MAX_INPUT_BYTES, MEAL_PHOTO_OUTPUT_MIME } from "@/domain/food-analysis/photo";

export { MEAL_PHOTO_ACCEPTED_MIMES, MEAL_PHOTO_MAX_EDGE_PX, MEAL_PHOTO_MAX_INPUT_BYTES, MEAL_PHOTO_OUTPUT_MIME };

export function sniffImageMime(bytes: Uint8Array): (typeof MEAL_PHOTO_ACCEPTED_MIMES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export type ProcessedMealPhoto = { bytes: Uint8Array; mime: typeof MEAL_PHOTO_OUTPUT_MIME; width: number; height: number; sha256: string };

export class MealPhotoError extends Error {
  constructor(readonly code: "MEAL_PHOTO_INVALID" | "MEAL_PHOTO_TOO_LARGE") {
    super(code);
    this.name = "MealPhotoError";
  }
}

export async function processMealPhoto(input: Uint8Array): Promise<ProcessedMealPhoto> {
  if (input.byteLength === 0) throw new MealPhotoError("MEAL_PHOTO_INVALID");
  if (input.byteLength > MEAL_PHOTO_MAX_INPUT_BYTES) throw new MealPhotoError("MEAL_PHOTO_TOO_LARGE");
  if (!sniffImageMime(input)) throw new MealPhotoError("MEAL_PHOTO_INVALID");
  try {
    // `rotate()` sem argumento aplica a orientação EXIF antes de o metadado ser descartado.
    const { data, info } = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize({ width: MEAL_PHOTO_MAX_EDGE_PX, height: MEAL_PHOTO_MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return { bytes, mime: MEAL_PHOTO_OUTPUT_MIME, width: info.width, height: info.height, sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch {
    throw new MealPhotoError("MEAL_PHOTO_INVALID");
  }
}
