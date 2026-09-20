/**
 * Limites técnicos da foto da refeição (prompt Fase 11 §11–§12), sem I/O —
 * compartilhados entre validadores, UI e o processamento server-side.
 */
export const MEAL_PHOTO_MAX_INPUT_BYTES = 12 * 1024 * 1024;
export const MEAL_PHOTO_MAX_EDGE_PX = 1600;
export const MEAL_PHOTO_OUTPUT_MIME = "image/webp";
/** JPEG/PNG/WebP. HEIC/HEIF não é aceito de forma confiável — pendência documentada. */
export const MEAL_PHOTO_ACCEPTED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MEAL_PHOTO_ACCEPT_ATTR = MEAL_PHOTO_ACCEPTED_MIMES.join(",");
