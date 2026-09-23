// Preview LOCAL dos e-mails da Fase 12 (prompt §98): renderiza os templates
// React Email (src/emails) em HTML + texto e captura screenshots em 390 e
// 720 px. Nada é enviado; saída em ./screenshots/fase-12/emails/ (ignorada
// pelo git). Dados de exemplo fictícios; links a partir de
// NEXT_PUBLIC_SITE_URL (default local).
//
// Uso: node scripts/render-email-previews.mjs

import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, "screenshots", "fase-12", "emails");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;

const vite = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  resolve: {
    alias: {
      "@": path.resolve(ROOT, "src"),
      "server-only": path.resolve(ROOT, "tests/integration/server-only-stub.ts"),
    },
  },
});

try {
  const { renderAll } = await vite.ssrLoadModule("/scripts/email-preview-entry.ts");
  const emails = await renderAll(SITE_URL);
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const email of emails) {
    await writeFile(path.join(OUT, `${email.key}.html`), email.html, "utf8");
    await writeFile(path.join(OUT, `${email.key}.txt`), `Assunto: ${email.subject}\n\n${email.text}`, "utf8");
    for (const width of [390, 720]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(email.html, { waitUntil: "load" });
      await page.screenshot({ path: path.join(OUT, `${email.key}-${width}.png`), fullPage: true });
    }
    console.log(`  ${email.key}: "${email.subject}"`);
  }
  await browser.close();
  console.log(`Previews em ${OUT}`);
} finally {
  await vite.close();
}
