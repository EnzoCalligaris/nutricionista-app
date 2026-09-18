"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type Status = "checking" | "invalid" | "ready";

const ACCEPTED_HASH_TYPES = new Set(["recovery", "invite"]);

/**
 * Ponte entre o link de e-mail (convite/recuperação de senha) e a sessão
 * server-side (prompt Fase 3 §15/§16).
 *
 * `inviteUserByEmail`/`resetPasswordForEmail` são chamados a partir do
 * SERVIDOR (server action / script administrativo), não de um browser com
 * PKCE já iniciado — por isso o GoTrue local, ao verificar o link, devolve
 * `access_token`/`refresh_token` no FRAGMENTO da URL (`#...`), não um
 * `?code=` de query string. Fragmento nunca chega ao servidor (o browser
 * não o envia em nenhuma requisição HTTP), então uma Route Handler como
 * `src/app/auth/callback/route.ts` é estruturalmente incapaz de processar
 * esse formato — só o client pode ler `window.location.hash`.
 *
 * `src/app/auth/callback/route.ts` continua existindo para o caso PKCE
 * genuíno (`?code=`) — relevante se um fluxo iniciado pelo próprio browser
 * (ex.: um futuro "Entrar com Google") for adicionado. Para
 * convite/recuperação de senha, o `redirectTo` aponta direto para
 * `/redefinir-senha`, e este componente faz a ponte: lê o token do
 * fragmento, chama `setSession` no cliente browser (que persiste a sessão
 * em cookies via `@supabase/ssr`, os mesmos que o server action de reset
 * volta a ler) e só então libera o formulário.
 */
export function ResetPasswordGate({ initialHasSession }: { initialHasSession: boolean }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function establishSessionFromUrl() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || (type && !ACCEPTED_HASH_TYPES.has(type))) {
        // Sem token de recuperação na URL: só é seguro considerar "pronto"
        // se o SERVER já tinha visto uma sessão válida na primeira
        // renderização (ex.: página recarregada nesta mesma aba depois que
        // o token já tinha sido trocado por sessão). Nunca cai aqui quando
        // HÁ hash — ver o ramo abaixo.
        if (!cancelled) setStatus(initialHasSession ? "ready" : "invalid");
        return;
      }

      // Hash presente: SEMPRE processa e sobrescreve qualquer sessão que já
      // exista no browser, mesmo de outra conta. BUG REAL encontrado
      // testando manualmente este fluxo: reaproveitar uma sessão
      // pré-existente aqui fazia o formulário seguinte alterar a senha de
      // quem já estava logado no browser (ex.: o nutricionista que gerou o
      // convite), não a do paciente dono do link — nunca confiar em sessão
      // pré-existente quando o link traz um token próprio.
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled) return;

      if (error) {
        setStatus("invalid");
        return;
      }

      // Remove o token da URL (histórico do browser, referrers) assim que
      // a sessão já está persistida em cookie — nunca deixamos o token
      // exposto na barra de endereço mais tempo que o necessário.
      window.history.replaceState(null, "", window.location.pathname);
      setStatus("ready");
    }

    void establishSessionFromUrl();

    return () => {
      cancelled = true;
    };
  }, [initialHasSession]);

  if (status === "checking") {
    return <p className="text-sm text-muted-foreground">Verificando link...</p>;
  }

  if (status === "invalid") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Este link de redefinição é inválido ou já expirou.</p>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/esqueci-senha" className="text-primary underline-offset-4 hover:underline">
            Solicitar um novo link
          </Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
