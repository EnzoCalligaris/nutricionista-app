# Método EM — Plataforma Enzo Mangili Nutricionista

Plataforma completa (site público, dashboard do nutricionista e portal do
paciente) para o acompanhamento nutricional de Enzo Mangili — o **Método EM**.

> **Status**: Fases 1 a 4 concluídas (fundação, banco de dados Supabase local
> com RLS, autenticação/autorização real e site público definitivo do Método
> EM). Ainda não há funcionalidades de produto no dashboard (pacientes,
> agenda, financeiro, cardápios) — ver `docs/ROADMAP.md`.

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

- `/`, `/metodo-em`, `/sobre`, `/acompanhamento`, `/planos`, `/resultados`,
  `/blog`, `/contato`, `/agendar`, `/politica-de-privacidade`, `/termos` —
  site público definitivo (Fase 4); planos, blog e resultados vêm do banco
- `/login`, `/esqueci-senha`, `/redefinir-senha` — autenticação (Fase 3)
- `/dashboard` — área do nutricionista, exige login com role `NUTRITIONIST`
- `/dashboard/pacientes`, `/dashboard/pacientes/novo`,
  `/dashboard/pacientes/[id]` (+ `/editar`, `/contratos/novo`) — gestão de
  pacientes, planos e contratos com parcelas (Fase 5); os demais módulos do
  dashboard ainda são shells (Comentários/Feedbacks/Materiais = Fase 10, Blog/Resultados/Configurações = Fase 14)
- `/dashboard/pacientes/convidar` — convite de paciente por e-mail (Fase 3;
  a mesma lógica é usada por "Novo paciente + convite" e pelo perfil)
- `/dashboard/agenda` (dia/semana/mês, próximas sessões), `/dashboard/agenda/nova`,
  `/dashboard/agenda/[id]` (+ `/editar`, `/reagendar`), `/dashboard/agenda/bloqueios/novo`,
  `/dashboard/agenda/configuracoes` — agenda, disponibilidade e bloqueios (Fase 6)
- `/paciente/consultas`, `/paciente/agendar` — consultas e agendamento online do
  paciente (Fase 6); `/agendar` público leva ao login com `next` seguro
- `/dashboard/cardapios` (visão por paciente), `/dashboard/pacientes/[id]?tab=cardapio`
  (plano atual + histórico), `/dashboard/pacientes/[id]/cardapio/novo`, `/cardapio/dados`,
  `/cardapio/[versionId]` (editor do rascunho / leitura da versão publicada) e
  `/paciente/cardapio` (versão publicada, mobile-first) — cardápio versionado (Fase 8)
- `/dashboard/avaliacoes` (visão por paciente), `/dashboard/pacientes/[id]?tab=avaliacoes`
  (evolução, gráficos, histórico), `/avaliacoes/nova`, `/avaliacoes/[assessmentId]` (+ `/editar`,
  `/relatorio`), `/avaliacoes/comparar` e `/paciente/evolucao` (+ `/[assessmentId]`,
  `/relatorio`) — avaliações físicas, bioimpedância e evolução (Fase 9)
- `/dashboard/financeiro` (lançamentos, filtros, cards), `/dashboard/financeiro/novo`,
  `/dashboard/financeiro/[id]/editar`, `/dashboard/financeiro/pagamentos/novo`,
  `/dashboard/financeiro/previsao` — financeiro completo sem gateway (Fase 7);
  `/dashboard` com cards e gráficos reais
- `/paciente` — portal do paciente, exige login com role `PATIENT`

Login local (dados fictícios de `supabase/seed.sql`, senha `NutricaoDev123`):
`dev-nutricionista@example.test` (nutricionista) ou
`fulana.detal@example.test` (paciente).

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
| `npm run test:db` | Testes pgTAP (constraints, RLS, IDOR, financeiro, provisionamento de auth) |
| `npm run test:db:concurrency` | Teste real de concorrência (double-booking) |
| `npm run test:auth:integration` | Testes de integração de auth contra Supabase local real (login, RLS, role escalation) |
| `npm run test:public:integration` | Testes de integração do conteúdo público (plano anual invisível, DRAFT oculto, consentimento de resultados) |
| `npm run test:patients:integration` | Testes de integração de pacientes/contratos contra Supabase local real (RLS via API, ownership entre dois nutricionistas, ids adulterados, funções SQL de contrato, e-mail único) |
| `npm run screenshots:fase-5` | Gera as screenshots reais de QA visual da Fase 5 em `screenshots/fase-5/` (app rodando em :3000; `--extra` para 375/430/1024/1280 px) |
| `npm run test:scheduling:integration` | Integração da agenda contra Supabase local real (ownership paciente x paciente e nutri x nutri, disponibilidade/bloqueio negados no servidor, status pelo paciente, busy_intervals) |
| `npm run test:scheduling:concurrency` | Concorrência real de agendamento via API (2 pacientes, nutri + paciente, 2 reagendamentos): sempre 1 sucesso e 1 recusa |
| `npm run screenshots:fase-6` | Screenshots reais da agenda (dashboard) e do agendamento (portal) em `screenshots/fase-6/` |
| `npm run test:financial:integration` | Integração do financeiro contra Supabase local real (lançamento manual, pagamento parcial/total/a maior/idempotente, estorno, previsão, ownership nutri x nutri e paciente, auditoria) |
| `npm run screenshots:fase-7` | Screenshots reais do financeiro (dashboard, lançamentos, pagamento, previsão, aba do paciente) em `screenshots/fase-7/` |
| `npm run test:meal-plans:integration` | Integração do cardápio contra Supabase local real (estrutura, duplicação com ids novos, versionamento, publicação atômica + duas publicações simultâneas, concorrência otimista, imutabilidade, ownership nutri/paciente, auditoria) |
| `npm run screenshots:fase-8` | Screenshots reais do cardápio (aba do paciente, editor, histórico, publicação, portal) em `screenshots/fase-8/` |
| `npm run test:assessments:integration` | Integração das avaliações contra Supabase local real (medidas/ranges, data futura, visibilidade, mass assignment, upload/download no bucket privado com acesso cruzado negado, arquivar/excluir, auditoria) |
| `npm run screenshots:fase-9` | Screenshots reais de avaliações/evolução (aba, formulário, detalhe com relatório, comparação, portal) em `screenshots/fase-9/` |
| `npm run bootstrap:nutritionist` | Convida e promove o primeiro NUTRITIONIST (uso administrativo — ver `scripts/bootstrap-nutritionist.mjs`) |

## Estrutura do projeto (resumo)

```
src/
  proxy.ts             # proteção de rota (Next 16 renomeou middleware.ts)
  app/
    (public)/          # site público definitivo (12 páginas) + login/esqueci-senha/redefinir-senha
    auth/callback/     # troca de código PKCE por sessão (server-side)
    dashboard/         # área do nutricionista — exige login + role NUTRITIONIST
    paciente/          # portal do paciente — exige login + role PATIENT
  actions/             # server actions (auth, onboarding, contact, patients, contracts)
  validators/          # schemas Zod (auth, contact, patients, contracts)
  services/            # casos de uso (patients, contracts, onboarding, audit, scheduling, notifications) — ownership + regras
  data/                # queries: públicas (plans, blog, results, site-settings) e do dashboard (patients, contracts)
  domain/              # regras puras (planos, blog, contato; pacientes: idade/status/ticket/timeline;
                       # contratos: parcelas/datas/status; agenda: slots/intervalos/regras/estados/calendário)
  content/             # conteúdo editorial do site (origem: PDF de referência)
  components/
    ui/                # primitivos shadcn/ui
    layout/            # headers, sidebars, shells
    shared/            # genéricos (Container, ComingSoon, Breadcrumbs, Pagination, FlashToast)
    auth/              # formulários de login/senha, gate de reset, menu de logout
    patients/          # listagem, cards de métricas, filtros, formulário, perfil, timeline, ações
    contracts/         # formulário de contrato (pré-visualização de parcelas), card, ações
    scheduling/        # agenda do nutricionista (toolbar, grade semana/dia, mês, próximas sessões, formulários)
    portal/            # portal do paciente (cards de consulta, fluxo de agendamento)
    marketing/         # seções do site público (hero, fases, pilares, planos, CTA...)
    blog/              # card de post e renderizador de rich text
    seo/               # JSON-LD
  config/              # siteConfig (nome, locale, timezone)
  hooks/               # hooks compartilhados
  lib/                 # utils, env.ts, supabase/ (client/server/admin/public), auth/ (session,
                       # redirect, errors, rate-limit(er)), calendar.ts, money.ts, errors/domain.ts
  types/               # database.ts (gerado — nunca editar à mão)
e2e/                   # testes Playwright (smoke, auth, public-site, patients, scheduling)
public/                # brand/ (logo recortado, monograma) e images/enzo/ (5 fotos WebP selecionadas)
supabase/              # migrations, seed.sql, tests/database (pgTAP), config.toml
scripts/               # scripts fora do Next.js (concorrência, integrações, bootstrap do nutricionista, screenshots)
screenshots/           # QA visual local por fase (ignorado pelo git — ver CLAUDE.md)
docs/                  # especificação, arquitetura, banco, segurança, decisões, roadmap
references/            # material original fornecido por Enzo — local apenas, fora do Git
```

`providers/`, `jobs/`, `emails/` ainda não existem — nascem nas fases que os
justificam (ver `docs/ARCHITECTURE.md`). `actions/` e `validators/`
nasceram na Fase 3; `data/`, `domain/` e `content/` na Fase 4; `services/`
na Fase 5.

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
