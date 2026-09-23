// Ambiente da suíte de integração (Supabase LOCAL, providers FAKE). Definido
// ANTES de qualquer import de src/lib/env.ts. Nenhuma credencial real.
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:55421";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
process.env.EMAIL_PROVIDER = "fake";
process.env.WHATSAPP_PROVIDER = "fake";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
process.env.NOTIFICATIONS_TOKEN_SECRET = "integration-test-pepper-not-secret";
// Fase 13: gateway fake (nenhuma rede, nenhum dado de cartão) e segredo de
// webhook claramente de teste.
process.env.PAYMENT_PROVIDER = "fake";
process.env.PAYMENT_PROVIDER_ENVIRONMENT = "simulated";
process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET = "integration-test-payment-webhook-secret";
delete process.env.PAYMENT_PROVIDER_SECRET_KEY;
