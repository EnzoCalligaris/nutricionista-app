import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

/**
 * Callback de autenticação (prompt Fase 3 §15-16) — destino de
 * `redirectTo` para signup/convite/recuperação de senha do Supabase Auth
 * (fluxo PKCE: recebe um `code` de uso único e troca por uma sessão
 * server-side, nunca expõe access/refresh token na URL nem em logs).
 *
 * Sempre server-side: o `code` nunca chega a nenhum componente client, e
 * nada aqui é logado (prompt Fase 3 §16/§29).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeRedirectPath(url.searchParams.get("next"), "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}
