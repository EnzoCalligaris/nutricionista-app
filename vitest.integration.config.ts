import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Suíte de INTEGRAÇÃO da Fase 12 (`npm run test:notifications:integration`):
 * roda o worker de notificações de verdade (src/services/notifications) em
 * Node contra o Supabase LOCAL (service role + PostgREST), com os providers
 * FAKE — sem rede externa. Separada da suíte unitária (jsdom) porque precisa
 * de ambiente Node, de banco de pé e do stub de `server-only` (o pacote
 * lança fora do runtime do Next).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/integration/server-only-stub.ts", import.meta.url)),
    },
  },
});
