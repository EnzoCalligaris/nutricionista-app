"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/validators/auth";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { authErrorMessage } from "@/lib/auth/errors";
import { loginRateLimiter, forgotPasswordRateLimiter, getClientIp } from "@/lib/auth/rate-limit";

export type LoginState = { error?: string };

/**
 * Login por e-mail/senha (prompt Fase 3 §9-11). Toda revalidação de
 * credenciais e sessão é feita aqui, server-side — o form só coleta input
 * para UX (prompt Fase 3 §31).
 */
export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: authErrorMessage("VALIDATION_ERROR") };
  }

  const { email, password, next } = parsed.data;

  const ip = await getClientIp();
  const rate = await loginRateLimiter.consume(`${ip}:${email.toLowerCase()}`);
  if (!rate.success) {
    return { error: authErrorMessage("RATE_LIMITED") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Mensagem genérica em qualquer falha — nunca revela se o e-mail existe
  // (prompt Fase 3 §10).
  if (error || !data.user) {
    return { error: authErrorMessage("INVALID_CREDENTIALS") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const roleHome = profile?.role === "NUTRITIONIST" ? "/dashboard" : "/paciente";
  const safeNext = sanitizeRedirectPath(next, roleHome);

  redirect(safeNext);
}

/**
 * Logout real via Supabase (prompt Fase 3 §13) — invalida a sessão
 * server-side (cookies limpos pelo adapter de `src/lib/supabase/server.ts`).
 * Qualquer requisição subsequente a uma rota protegida passa a cair no
 * proxy/`requireUser()` como anônima, mesmo que o browser ainda mostre uma
 * página em cache ao navegar "Voltar".
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ForgotPasswordState = { message?: string; error?: string };

const NEUTRAL_FORGOT_PASSWORD_MESSAGE =
  "Se existir uma conta associada a este e-mail, enviaremos as instruções.";

/**
 * "Esqueci minha senha" (prompt Fase 3 §14) — resposta SEMPRE neutra,
 * independentemente de o e-mail existir ou não, para não permitir
 * enumeração de contas.
 */
export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { message: NEUTRAL_FORGOT_PASSWORD_MESSAGE };
  }

  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const rate = await forgotPasswordRateLimiter.consume(`${ip}:${email}`);
  if (!rate.success) {
    return { error: authErrorMessage("RATE_LIMITED") };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    // Chamado a partir do servidor (não de um browser com PKCE já
    // iniciado) — o GoTrue devolve o token no fragmento da URL, então o
    // destino é /redefinir-senha diretamente, não /auth/callback (uma
    // Route Handler nunca vê fragmento — ver
    // src/components/auth/reset-password-gate.tsx).
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/redefinir-senha`,
  });

  return { message: NEUTRAL_FORGOT_PASSWORD_MESSAGE };
}

export type ResetPasswordState = { error?: string; success?: boolean };

/**
 * Define a nova senha (prompt Fase 3 §15/§17) — só funciona com uma sessão
 * de recuperação ativa (estabelecida por /auth/callback a partir do link de
 * e-mail). Sem sessão válida, retorna SESSION_EXPIRED em vez de deixar
 * `updateUser` falhar de forma pouco clara.
 */
export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? authErrorMessage("VALIDATION_ERROR") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: authErrorMessage("SESSION_EXPIRED") };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: authErrorMessage("UNKNOWN") };
  }

  // Encerra a sessão de recuperação — o usuário precisa entrar de novo com
  // a senha nova, evitando reaproveitar uma sessão de link de e-mail como
  // sessão "normal" de longa duração.
  await supabase.auth.signOut();

  return { success: true };
}
