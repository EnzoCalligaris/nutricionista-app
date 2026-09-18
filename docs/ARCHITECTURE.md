# ARCHITECTURE — Método EM

## Stack proposta (avaliação da stack sugerida pelo usuário)

| Camada | Escolha | Avaliação |
|---|---|---|
| Framework | Next.js 16 (App Router), React, TypeScript strict | Adequado. App Router permite route groups separando site público, dashboard e portal do paciente sob o mesmo deploy, com layouts e middlewares distintos por área. |
| UI | Tailwind CSS + shadcn/ui + Radix | Adequado para o visual "clean, premium, minimalista" pedido — shadcn não impõe estética de template, dá controle total de design tokens. |
| Dados | PostgreSQL via Supabase | Adequado — Postgres dá constraints/transactions fortes (essencial para não-double-booking e integridade financeira), Supabase dá Auth + Storage + RLS prontos, reduzindo infra própria. |
| Auth | Supabase Auth | Adequado, com papéis (`NUTRITIONIST`/`PATIENT`/`ADMIN`) modelados em tabela `profiles`, não em claims exclusivamente. |
| Storage | Supabase Storage, buckets privados + signed URLs | Obrigatório para fotos de refeição, materiais e resultados não publicados. |
| Realtime | Supabase Realtime | Uso pontual (ex.: notificação in-app, status de consulta) — não é base de nenhum fluxo crítico. |
| Validação | Zod | Validação de schema compartilhada entre client (React Hook Form) e server actions. |
| Formulários | React Hook Form + Zod | Adequado. |
| Gráficos | Recharts | Adequado para evolução do paciente e dashboards financeiros. |
| Editor de conteúdo | TipTap | Adequado para blog e cardápios com texto rico (instruções/observações). |
| Datas | date-fns + date-fns-tz | Necessário por causa da regra de fuso America/Sao_Paulo. |
| Deploy | Vercel | Adequado para Next.js. |
| E-mail | Resend + React Email | Adequado, abstrair atrás de `EmailProvider`. |
| Testes | Vitest (unit/integration) + Playwright (E2E) | Adequado — Playwright é essencial para testar fluxo de agendamento com concorrência real via múltiplas requisições. |

Nenhuma dependência adicional deve ser instalada "porque é popular" — cada nova
lib entra só quando uma necessidade concreta aparecer numa fase futura (ex.: fila
de jobs para notificações, se o volume justificar).

## Estrutura de pastas proposta (a criar na Fase 1)

```
app/
  (public)/                  # site público — layout próprio, ISR 10 min (Fase 4)
    page.tsx                 # home
    login/                   # Fase 3
    esqueci-senha/           # Fase 3
    redefinir-senha/         # Fase 3
    metodo-em/               # Fase 4 — antes/durante/depois, pilares
    sobre/
    acompanhamento/
    planos/                  # lê plans/plan_prices/plan_benefits
    resultados/              # lê before_after_results (RLS pública)
    blog/ blog/[slug]/       # lê blog_posts PUBLISHED
    contato/                 # valida, não envia (Fase 12 conecta e-mail)
    agendar/                 # porta de entrada; agenda real é Fase 6
    politica-de-privacidade/ termos/
  sitemap.ts robots.ts       # Fase 4
  auth/
    callback/route.ts        # Fase 3 — troca de código PKCE por sessão (server-side)
  dashboard/                 # área do nutricionista — exige role=NUTRITIONIST (Fase 3)
    agenda/
    pacientes/[id]/
    pacientes/convidar/      # Fase 3 — núcleo mínimo de onboarding, não gestão completa
    cardapios/
    avaliacoes/
    comentarios/
    consultas/
    financeiro/
    blog/
    resultados/
    materiais/
    configuracoes/
  paciente/                  # portal do paciente — exige role=PATIENT (Fase 3)
    cardapio/
    evolucao/
    consultas/
    suplementos/
    feedbacks/
    materiais/
    perfil/
  api/
    webhooks/{payments,whatsapp}/
    cron/{notification-reminders,...}/
src/
  proxy.ts           # Fase 3 — proteção de rota (Next 16 renomeou middleware.ts;
                     # ver docs/DECISIONS.md)
  domain/            # regras puras, sem I/O — plans/ (preço, visibilidade),
                     # blog/ (visibilidade), site-settings/ (contato) desde a Fase 4;
                     # patients/ (idade, status, ticket médio, acesso ao portal,
                     # timeline) e contracts/ (parcelas, datas, status) desde a Fase 5
  services/          # casos de uso (Fase 5): patients.ts, contracts.ts, onboarding.ts
                     # (convite, compartilhado com a Fase 3), audit.ts — validam
                     # ownership e chamam data/ + funções SQL transacionais
  data/              # queries Supabase: públicas (plans, blog, results, site-settings,
                     # cliente anônimo — Fase 4) e do dashboard (patients.ts,
                     # contracts.ts, getDashboardPlans — cliente de sessão, Fase 5)
  content/           # conteúdo editorial do site com origem no PDF (Fase 4)
  actions/           # server actions — auth.ts, onboarding.ts (Fase 3), contact.ts
                     # (Fase 4), patients.ts, contracts.ts (Fase 5)
  validators/        # schemas Zod, compartilhados client/server — auth.ts, contact.ts,
                     # patients.ts, contracts.ts
  providers/         # abstrações plugáveis: PaymentProvider, EmailProvider,
                     # WhatsAppProvider, FoodAnalysisProvider (+ implementações) — ainda não criado
  jobs/              # tarefas agendadas (lembretes, retries de notificação) — ainda não criado
  emails/            # templates React Email — ainda não criado
  components/        # UI compartilhada (ui/ = shadcn primitives, layout/ = shells + header/
                     # footer/menu mobile, shared/ = genéricos, auth/ = formulários/gate de auth,
                     # marketing/ = seções do site público, blog/ = card + rich text, seo/ = JSON-LD)
  lib/               # utils, cliente Supabase (server/browser/admin/public), auth/
                     # (session, redirect, errors, rate-limit(er) — Fase 3),
                     # dates (pt-BR, America/Sao_Paulo), calendar (aritmética de
                     # data civil), money (centavos <-> BRL), errors/domain (Fase 5), env
  config/            # configuração pública (siteConfig, timezone)
  hooks/             # hooks compartilhados (ex.: use-mobile)
  types/             # tipos compartilhados gerados/derivados do banco
```

> **Correção feita na Fase 1** (registrada em `DECISIONS.md`): o desenho original
> desta fase (Fase 0) usava `(dashboard)/` e `(patient)/paciente/` como *route
> groups* puros — que não adicionam segmento à URL. Isso faria `/blog` e
> `/resultados` do dashboard colidirem com as páginas públicas de mesmo nome
> (mesma URL, duas páginas — Next.js recusa o build). A estrutura implementada
> usa `dashboard/` e `paciente/` como segmentos de rota reais (não
> parenteses), o que também simplificou a proteção de rota da Fase 3 (basta
> checar `pathname.startsWith("/dashboard")` em `src/proxy.ts`, sem
> visibilidade especial sobre route groups).
>
> **Correção feita na Fase 3**: `/login` foi implementado como rota própria
> dentro de `(public)/`, não aninhada em `(auth)/login/` como o desenho
> original da Fase 0 sugeria — um route group a mais aqui não adicionava
> nenhum benefício (nenhum layout específico só para `/login`).
>
> `providers/`, `jobs/`, `emails/` **ainda não foram criados** — não há
> regra de negócio real para colocar neles ainda. `actions/` e
> `validators/` nasceram na Fase 3 (auth); `domain/`, `data/` e `content/`
> nasceram na Fase 4 (site público); `services/` nasceu na Fase 5
> (pacientes/contratos); o resto nasce nas fases que os justificam.
>
> **Dashboard (Fase 5) — fluxo de uma mutação**: página (Server Component,
> `requireNutritionist()`) → formulário/botão (client) → Server Action em
> `actions/` (Zod + `requireNutritionist()` + mapeamento de erro +
> `revalidatePath`) → `services/` (ownership explícito por
> `nutritionist_id`, regra de negócio, auditoria) → `data/` ou função SQL
> (`create_contract_with_installments`, `cancel_contract`,
> `complete_contract` — SECURITY INVOKER, transacionais) → RLS como última
> camada. Leituras: página → `data/` (cliente de sessão, escopado por
> `nutritionist_id`, views `patient_overview` e
> `contract_financial_summary`, sem N+1). Dados administrativos são sempre
> dinâmicos (`force-dynamic`), nunca ISR; após mutação, `revalidatePath`.
> Erros de domínio (`lib/errors/domain.ts`) são a única coisa que chega à
> UI — nunca a mensagem crua do banco.
>
> **Conteúdo público (Fase 4)**: páginas do site usam `src/data/*` (que usam
> `src/lib/supabase/public.ts`, cliente anônimo sem cookies) e nunca o
> Supabase direto. Isso mantém as páginas estáticas com ISR e garante que só
> o que a RLS `to anon` libera chega ao visitante — nunca service role para
> renderizar conteúdo público.

Regra: **domain não importa de data/services**; **UI não acessa `data/` direto**,
sempre via `actions/` ou `services/`. Isso evita regra de negócio duplicada entre
dashboard e portal do paciente quando os dois tocam a mesma entidade (ex.:
consultas, notificações).

## Abstrações externas (obrigatórias antes de integrar qualquer fornecedor)

```ts
interface PaymentProvider {
  createCharge(input: ChargeInput): Promise<ChargeResult>
  handleWebhook(payload: unknown, signature: string): Promise<PaymentEvent>
}

interface EmailProvider {
  send(template: EmailTemplate, to: string, data: Record<string, unknown>): Promise<void>
}

interface WhatsAppProvider {
  sendTemplate(to: string, template: string, params: Record<string, string>): Promise<void>
}

interface FoodAnalysisProvider {
  analyzeMealImage(photo: Blob): Promise<MealAnalysisEstimate> // sempre estimativa, nunca valor exato
}
```

Implementações concretas (Resend, gateway de pagamento, BSP de WhatsApp, modelo
de visão computacional) ficam em `src/providers/<nome>/`, nunca referenciadas
diretamente pelo domínio.

## Multi-tenant / autorização

Um único nutricionista neste momento (Enzo), mas o modelo já separa
`nutritionist_id` em tabelas relevantes (pacientes, planos, agenda) para não
travar uma eventual expansão para mais de um profissional — sem construir UI
multi-tenant agora (YAGNI), só não hardcodar "1 nutricionista" nas queries.

## Timezone

Todo horário de agenda é armazenado em `timestamptz` (UTC) no banco; conversão
para `America/Sao_Paulo` acontece só na camada de apresentação e nas regras de
disponibilidade (ex.: "10h" significa 10h em São Paulo, não no fuso do servidor).
Nunca usar `new Date()` do servidor para decidir "hoje" sem converter
explicitamente para o fuso do negócio.
