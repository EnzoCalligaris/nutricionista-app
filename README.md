# Método EM — Plataforma Enzo Mangili Nutricionista

Plataforma completa (site público, dashboard do nutricionista e portal do
paciente) para o acompanhamento nutricional de Enzo Mangili — o **Método EM**.

> **Status**: Fases 1 e 2 concluídas (fundação do projeto + banco de dados
> Supabase local com RLS). Ainda não há autenticação real nem funcionalidades
> de produto — ver `docs/ROADMAP.md`.

## Documentação do produto e da arquitetura

Antes de mexer no código, leia (nessa ordem):

1. [`CLAUDE.md`](./CLAUDE.md) — regras inegociáveis do projeto.
2. [`docs/PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md) — o produto e as regras de negócio.
3. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — como o código é organizado.
4. [`docs/DATABASE.md`](./docs/DATABASE.md) — schema implementado (39 tabelas, RLS, ERD).
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
- [Supabase](https://supabase.com) local (Postgres 17, Auth, Storage, RLS) via
  CLI (`supabase` como devDependency) + Docker — schema em
  `supabase/migrations/`, testes em `supabase/tests/database/` (pgTAP)
- Planejado para as próximas fases: React Hook Form, Recharts, TipTap,
  Resend + React Email — ver `docs/ARCHITECTURE.md`.

## Requisitos

- Node.js 20+ (usado em desenvolvimento: Node 26)
- npm 11+
- Docker Desktop rodando (só necessário para `npm run db:*` / `npm run test:db*`)

## Como instalar

```bash
npm install
cp .env.example .env.local
```

Para rodar só a Home/shells (Fase 1), `.env.local` só precisa de
`NEXT_PUBLIC_SITE_URL`. Para usar o banco local (Fase 2), veja a seção
seguinte.

## Banco de dados local (Supabase)

```bash
npm run db:start          # sobe Postgres/Auth/Storage/Studio locais (Docker)
npx supabase status -o env  # mostra API_URL, ANON_KEY, SERVICE_ROLE_KEY locais
```

Copie `API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` para `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`
(são as chaves de demonstração padrão do Supabase, iguais em qualquer
instalação local — não são segredo de produção). Supabase Studio fica em
`http://127.0.0.1:55423`.

As portas locais estão deslocadas de 543xx para 5542x
(`supabase/config.toml` documenta o motivo) — evita colidir com outro
projeto Supabase local e com a faixa de portas que o Windows reserva.

`npm run db:reset` reaplica todas as migrations + `supabase/seed.sql`
(dados fictícios — nutricionista e 5 pacientes de exemplo, senha de dev
documentada no próprio arquivo). `npm run db:types` regenera
`src/types/database.ts` a partir do schema.

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
| `npm run db:start` / `db:stop` | Sobe/derruba o Supabase local |
| `npm run db:reset` | Reaplica migrations + seed fictício |
| `npm run db:types` | Regenera `src/types/database.ts` |
| `npm run test:db` | Testes pgTAP (constraints, RLS, IDOR, financeiro) |
| `npm run test:db:concurrency` | Teste real de concorrência (double-booking) |

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
  lib/                 # utils, env.ts, supabase/ (client/server/admin)
  types/               # database.ts (gerado — nunca editar à mão)
e2e/                   # testes Playwright
supabase/              # migrations, seed.sql, tests/database (pgTAP), config.toml
scripts/               # scripts de dev fora do Next.js (ex.: teste de concorrência)
docs/                  # especificação, arquitetura, banco, segurança, decisões, roadmap
references/            # material original fornecido por Enzo — local apenas, fora do Git
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
