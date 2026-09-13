# Método EM — Plataforma Enzo Mangili Nutricionista

Plataforma completa (site público, dashboard do nutricionista e portal do
paciente) para o acompanhamento nutricional de Enzo Mangili — o **Método EM**.

> **Status**: Fase 1 (Fundação do projeto) concluída. Ainda não há banco de
> dados real, autenticação nem funcionalidades — ver `docs/ROADMAP.md`.

## Documentação do produto e da arquitetura

Antes de mexer no código, leia (nessa ordem):

1. [`CLAUDE.md`](./CLAUDE.md) — regras inegociáveis do projeto.
2. [`docs/PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md) — o produto e as regras de negócio.
3. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — como o código é organizado.
4. [`docs/DATABASE.md`](./docs/DATABASE.md) — modelo de dados (ainda não implementado).
5. [`docs/SECURITY.md`](./docs/SECURITY.md) — segurança, LGPD, RLS.
6. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — conflitos entre o PDF de referência e o
   prompt do produto, pendências, decisões técnicas.
7. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — ordem das fases.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, TypeScript strict, `src/`)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (estilo Nova, ícones Lucide)
- [Zod](https://zod.dev) para validação (formulários e environment variables)
- [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) (unit/component)
- [Playwright](https://playwright.dev) (E2E)
- Planejado para as próximas fases: Supabase (Postgres, Auth, Storage, RLS),
  React Hook Form, Recharts, TipTap, Resend + React Email — ver
  `docs/ARCHITECTURE.md`.

## Requisitos

- Node.js 20+ (usado em desenvolvimento: Node 26)
- npm 11+

## Como instalar

```bash
npm install
cp .env.example .env.local
```

`.env.local` só precisa de `NEXT_PUBLIC_SITE_URL` preenchido nesta fase — as
demais variáveis (Supabase, Resend, WhatsApp, pagamento, IA) são opcionais até
as fases que as integram de verdade (ver comentários em `.env.example`).

## Como rodar

```bash
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000):

- `/` — home provisória (valida o design system; site institucional real é Fase 4)
- `/dashboard` — shell do dashboard do nutricionista (só layout, sem dados reais)
- `/paciente` — shell do portal do paciente (só layout, sem dados reais)

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest em modo watch |
| `npm run test:run` | Vitest uma vez (CI) |
| `npm run test:e2e` | Playwright (builda e sobe o app antes de testar) |

## Estrutura do projeto (resumo)

```
src/
  app/
    (public)/        # site público — home provisória
    dashboard/        # shell do dashboard do nutricionista
    paciente/          # shell do portal do paciente
  components/
    ui/                # primitivos shadcn/ui
    layout/            # headers, sidebars, shells
    shared/            # genéricos (Container, ComingSoon)
  config/              # siteConfig (nome, locale, timezone)
  hooks/               # hooks compartilhados
  lib/                 # utils, env.ts (validação central de env vars)
e2e/                   # testes Playwright
docs/                  # especificação, arquitetura, banco, segurança, decisões, roadmap
references/            # material original fornecido por Enzo (não editar)
```

`domain/`, `services/`, `data/`, `actions/`, `validators/`, `providers/`,
`jobs/`, `emails/` ainda não existem — nascem nas fases que os justificam (ver
`docs/ARCHITECTURE.md`).

## Environment variables

Ver [`.env.example`](./.env.example) para a lista completa e comentada. Todo
acesso a `process.env` passa por [`src/lib/env.ts`](./src/lib/env.ts) — nunca
leia `process.env.*` diretamente em outro arquivo. `SUPABASE_SERVICE_ROLE_KEY`
e as demais variáveis server-only nunca podem ser importadas por um Client
Component.

## Fases do projeto

Ver [`docs/ROADMAP.md`](./docs/ROADMAP.md) para a lista completa (Fase 0 a
Fase 16). Cada fase só começa com aprovação explícita — não avançamos fases
sozinhos.
