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
  (public)/                  # site público — layout próprio, SEO, sem auth
    page.tsx                 # home
    metodo/                  # Método EM
    sobre/
    planos/
    resultados/
    blog/[slug]/
    contato/
    agendar/
    (auth)/login/
  dashboard/                 # área do nutricionista — middleware exige role=NUTRITIONIST
    agenda/
    pacientes/[id]/
    cardapios/
    avaliacoes/
    comentarios/
    consultas/
    financeiro/
    blog/
    resultados/
    materiais/
    configuracoes/
  paciente/                  # portal do paciente — middleware exige role=PATIENT
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
  domain/            # entidades, regras de negócio puras, sem I/O
    patients/ plans/ contracts/ appointments/ meal-plans/ assessments/ ...
  services/          # orquestração de casos de uso (usa domain + data access)
  data/              # queries/repositories Supabase, um módulo por agregado
  actions/           # server actions (mutações chamadas pela UI)
  validators/        # schemas Zod, compartilhados client/server
  providers/         # abstrações plugáveis: PaymentProvider, EmailProvider,
                     # WhatsAppProvider, FoodAnalysisProvider (+ implementações)
  jobs/              # tarefas agendadas (lembretes, retries de notificação)
  emails/            # templates React Email
  components/        # UI compartilhada (ui/ = shadcn primitives, layout/ = shells, shared/ = genéricos)
  lib/               # utils, cliente Supabase (server/browser), datas/timezone, env
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
> parenteses), o que também simplifica o middleware de autorização da Fase 3
> (basta checar `pathname.startsWith("/dashboard")`, sem visibilidade especial
> sobre route groups).
>
> `domain/`, `services/`, `data/`, `actions/`, `validators/`, `providers/`,
> `jobs/`, `emails/` **ainda não foram criados** — não há regra de negócio real
> para colocar neles na Fase 1. Eles nascem nas fases que os justificam (Fase 2
> em diante), em vez de existirem vazios agora.

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
