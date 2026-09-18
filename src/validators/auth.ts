import { z } from "zod";

// Compartilhados entre client (React) e server (actions) — validação client
// é só UX, a autoridade é sempre a revalidação aqui no server (prompt
// Fase 3 §30).

export const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  password: z.string().min(1, "Informe sua senha."),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
});

// Mínimo razoável, não exagerado (prompt Fase 3 §17) — alinhado ao mínimo
// padrão do próprio Supabase Auth.
const PASSWORD_MIN_LENGTH = 8;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const invitePatientSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo do paciente."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InvitePatientInput = z.infer<typeof invitePatientSchema>;
