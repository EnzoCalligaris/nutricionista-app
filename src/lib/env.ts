import { z } from "zod";

/**
 * Ponto único de acesso a environment variables. Nenhum outro arquivo deve ler
 * `process.env.*` diretamente — importe `env` (client-safe) ou `getServerEnv()`
 * (server-only) daqui.
 *
 * Só `NEXT_PUBLIC_SITE_URL` é exigida (com default local). As variáveis do
 * Supabase (Fase 2) são opcionais aqui de propósito — o app builda e a Home
 * provisória roda sem elas — mas os clientes em `src/lib/supabase/*` lançam
 * erro claro em runtime se forem chamados sem `NEXT_PUBLIC_SUPABASE_URL`/
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas. Resend/WhatsApp/pagamento/IA
 * continuam opcionais até as fases que as integram de verdade — ver
 * docs/ROADMAP.md.
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
  // Fase 13: gateway de pagamento. Default `fake` (determinístico, sem rede,
  // sem dado de cartão) enquanto o fornecedor real for PENDENTE DE DEFINIÇÃO.
  // Um identificador sem adapter, ou um adapter real sem credencial, é erro
  // de configuração — nunca cai no fake em silêncio.
  PAYMENT_PROVIDER: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/, "PAYMENT_PROVIDER: identificador inválido")
    .default("fake"),
  PAYMENT_PROVIDER_ENVIRONMENT: z.enum(["simulated", "sandbox", "production"]).default("simulated"),
  PAYMENT_PROVIDER_SECRET_KEY: z.string().min(1).optional(),
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().min(16).optional(),
  FOOD_ANALYSIS_PROVIDER_API_KEY: z.string().min(1).optional(),
  // Fase 11: fornecedor de análise de foto. Default `fake` (determinístico,
  // sem rede) enquanto vendor/modelo reais forem PENDENTE DE DEFINIÇÃO.
  FOOD_ANALYSIS_PROVIDER: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/, "FOOD_ANALYSIS_PROVIDER: identificador inválido")
    .default("fake"),
  FOOD_ANALYSIS_MODEL: z.string().trim().max(120).optional(),
  FOOD_ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(45_000),
  // Fase 12: providers de notificação. Default `fake` (determinístico, sem
  // rede). `resend` sem RESEND_API_KEY/EMAIL_FROM é erro de configuração —
  // nunca cai no fake em silêncio (validado em src/services/notifications).
  EMAIL_PROVIDER: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/, "EMAIL_PROVIDER: identificador inválido")
    .default("fake"),
  EMAIL_FROM: z.string().trim().min(3).max(200).optional(),
  EMAIL_REPLY_TO: z.string().trim().email().max(200).optional(),
  WHATSAPP_PROVIDER: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,40}$/, "WHATSAPP_PROVIDER: identificador inválido")
    .default("fake"),
  WHATSAPP_TEMPLATE_MAP: z.string().trim().max(4000).optional(),
  // Segredo do scheduler (Authorization: Bearer <CRON_SECRET>). Nunca NEXT_PUBLIC_,
  // nunca logado; ausente em produção = job recusa (fail closed).
  CRON_SECRET: z.string().trim().min(16).optional(),
  NOTIFICATIONS_TOKEN_SECRET: z.string().trim().min(16).optional(),
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
