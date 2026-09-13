import { z } from "zod";

/**
 * Ponto único de acesso a environment variables. Nenhum outro arquivo deve ler
 * `process.env.*` diretamente — importe `env` (client-safe) ou `getServerEnv()`
 * (server-only) daqui.
 *
 * Fase 1: só `NEXT_PUBLIC_SITE_URL` é exigida (com default local). As variáveis
 * de integrações futuras (Supabase, Resend, WhatsApp, pagamento, IA) são
 * opcionais agora e passam a ser obrigatórias quando cada fase as integrar de
 * verdade — ver docs/ROADMAP.md.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

function parseClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Environment variables públicas inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}

/** Variáveis seguras para uso em Client Components. */
export const env = parseClientEnv();

// Variáveis server-only. Nenhuma delas é NEXT_PUBLIC_* — nunca podem ser
// importadas por um Client Component nem embutidas no bundle do browser.
const serverOnlySchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  PAYMENT_PROVIDER_SECRET_KEY: z.string().min(1).optional(),
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().min(1).optional(),
  FOOD_ANALYSIS_PROVIDER_API_KEY: z.string().min(1).optional(),
});

type ServerEnv = z.infer<typeof serverOnlySchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Retorna as variáveis server-only, validadas e cacheadas. Lança em runtime se
 * chamada no browser — proteção contra vazamento acidental de secret para o
 * client bundle (ex.: SUPABASE_SERVICE_ROLE_KEY nunca deve chegar ao browser).
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() não pode ser chamado no browser. Use apenas em Server Components, Server Actions ou Route Handlers.",
    );
  }

  if (!cachedServerEnv) {
    const parsed = serverOnlySchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Environment variables de servidor inválidas:\n${z.prettifyError(parsed.error)}`,
      );
    }
    cachedServerEnv = parsed.data;
  }

  return cachedServerEnv;
}
