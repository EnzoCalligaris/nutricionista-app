import { z } from "zod";
import { isValidISODate, todayISO } from "@/lib/calendar";

// Schemas Zod da gestão de pacientes (prompt Fase 5 §47). Compartilháveis
// com o client para UX, mas a autoridade é sempre a revalidação no server.

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome completo do paciente.")
  .max(120, "Nome muito longo (máximo 120 caracteres).");

const emailSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.email({ error: "Informe um e-mail válido." }));

const optionalEmailSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .pipe(z.email({ error: "Informe um e-mail válido." }).nullable());

// Telefone é texto livre com validação leve: o formato definitivo (E.164
// para WhatsApp oficial) é preocupação da Fase 12.
const phoneSchema = optionalTrimmed(30).refine(
  (value) => value === null || value === undefined || /^[\d\s()+\-.]{8,30}$/.test(value),
  { message: "Informe um telefone válido." },
);

const birthDateSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => value == null || isValidISODate(value), { message: "Data de nascimento inválida." })
  .refine((value) => value == null || value <= todayISO(), {
    message: "A data de nascimento não pode estar no futuro.",
  })
  .refine((value) => value == null || value >= "1900-01-01", { message: "Data de nascimento inválida." });

export const createPatientSchema = z
  .object({
    fullName: fullNameSchema,
    email: optionalEmailSchema.optional(),
    phone: phoneSchema,
    birthDate: birthDateSchema,
    // Checkbox "Enviar convite para acesso ao portal" — exige e-mail.
    sendInvite: z.boolean().default(false),
  })
  .refine((data) => !data.sendInvite || !!data.email, {
    message: "Para enviar o convite, informe o e-mail do paciente.",
    path: ["email"],
  });

export const updatePatientSchema = z.object({
  fullName: fullNameSchema,
  email: optionalEmailSchema.optional(),
  phone: phoneSchema,
  birthDate: birthDateSchema,
});

export const patientListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(50).catch(20),
});

export const patientIdSchema = z.guid({ error: "Identificador de paciente inválido." });

export const invitePatientToPortalSchema = z.object({
  email: emailSchema,
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
