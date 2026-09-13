import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a anon key (RLS continua valendo — este cliente representa o usuário
 * autenticado via cookies de sessão, não um bypass). Para operações que
 * precisam ignorar RLS deliberadamente, use `createAdminClient` em
 * `src/lib/supabase/admin.ts`.
 */
export async function createClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (ver .env.example).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado de um Server Component (não pode escrever cookies).
            // Inofensivo quando a sessão é renovada por middleware — ver
            // padrão recomendado pelo Supabase para Next.js (Fase 3).
          }
        },
      },
    },
  );
}
