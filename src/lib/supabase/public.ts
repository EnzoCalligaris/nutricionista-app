import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase ANÔNIMO para conteúdo público (site institucional —
 * Fase 4). Usa só a anon key e NÃO lê cookies de sessão, de propósito:
 *
 * - o conteúdo público (planos, blog, resultados publicados, site settings)
 *   é o mesmo para qualquer visitante — a RLS `to anon` já filtra o que pode
 *   ser exposto (docs/SECURITY.md), então não faz sentido personalizar por
 *   sessão nem abrir mão de cache/prerender por causa de `cookies()`;
 * - nunca usa service role para "contornar" policy (prompt Fase 4 §57): o
 *   que a RLS não libera para `anon`, o site público simplesmente não vê.
 *
 * Para tudo que depende do usuário logado continue usando
 * `src/lib/supabase/server.ts`.
 */
export function createPublicClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (ver .env.example).",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
