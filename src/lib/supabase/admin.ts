import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente com a service role key — IGNORA RLS por completo. Uso restrito a
 * rotinas server-side que precisam mesmo bypassar RLS (ex.: webhooks,
 * jobs de notificação). `import "server-only"` impede que este módulo seja
 * incluído em qualquer bundle client, e `getServerEnv()` lança em runtime se
 * chamado no browser de qualquer forma — dupla proteção (docs/SECURITY.md:
 * "service role key nunca chega ao browser").
 *
 * Nunca use este cliente para responder diretamente a uma requisição de
 * usuário sem antes validar autorização por conta própria — ele não aplica
 * nenhuma política de RLS.
 */
export function createAdminClient() {
  const serverEnv = getServerEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Admin client do Supabase requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
