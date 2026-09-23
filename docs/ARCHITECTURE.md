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
    cardapios/               # Fase 8 — visão por paciente; editor em pacientes/[id]/cardapio/[versionId]
    avaliacoes/              # Fase 9 — visão por paciente; fluxo em pacientes/[id]/avaliacoes/*
    comentarios/
    consultas/
    financeiro/              # Fase 7 — lançamentos, novo/[id]/editar, pagamentos/novo, previsao
    blog/
    resultados/
    materiais/               # Fase 10 — biblioteca; novo, [materialId] (+ editar, arquivo)
    configuracoes/
  paciente/                  # portal do paciente — exige role=PATIENT (Fase 3)
    cardapio/
    evolucao/
    consultas/
    suplementos/             # Fase 10 — só recomendações ativas
    feedbacks/               # Fase 10 — só disponibilizados
    materiais/               # Fase 10 — só atribuídos; [materialId]/arquivo (download server-side)
    refeicoes/               # Fase 11 — histórico; nova, consentimento, [analysisId] (+ foto)
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
                     # timeline) e contracts/ (parcelas, datas, status) desde a Fase 5;
                     # scheduling/ (intervalos, slots, regras de disponibilidade,
                     # máquina de estados, visões/geometria do calendário) desde a Fase 6;
                     # finance/ (definições, saldo de parcela/alocação de pagamento,
                     # períodos, resumos) desde a Fase 7; meal-plans/ (definições/unidades,
                     # estrutura+ordenação+duplicação, versionamento, quantidades) — Fase 8;
                     # assessments/ (métricas/ranges técnicos/IMC, números pt-BR, evolução/
                     # comparação/séries) — Fase 9; patient-content/ (validador de URL externa,
                     # status/visibilidade de suplementos, feedbacks e materiais/atribuições) — Fase 10;
                     # food-analysis/ (estimativas/totais/diff, máquina de estados, consentimento,
                     # limites da foto) — Fase 11
  services/          # casos de uso (Fase 5): patients.ts, contracts.ts, onboarding.ts
                     # (convite, compartilhado com a Fase 3), audit.ts — validam
                     # ownership e chamam data/ + funções SQL transacionais;
                     # scheduling.ts + notifications.ts (eventos internos) desde a Fase 6;
                     # finance.ts (lançamentos manuais, pagamento/estorno via funções SQL) — Fase 7;
                     # meal-plans.ts (plano/versão/dia/refeição/item/substituição, funções SQL) — Fase 8;
                     # assessments.ts (avaliação, medidas, visibilidade, relatório no bucket privado,
                     # URL assinada) — Fase 9; supplements.ts, feedbacks.ts, materials.ts (arquivo no
                     # bucket privado, atribuições, URL assinada) — Fase 10; food-analysis/ (provider.ts
                     # = interface + prompt, fake-provider.ts, schemas.ts = Zod da resposta, index.ts =
                     # factory por env, service.ts = casos de uso) — Fase 11
  data/              # queries Supabase: públicas (plans, blog, results, site-settings,
                     # cliente anônimo — Fase 4) e do dashboard (patients.ts,
                     # contracts.ts, getDashboardPlans — cliente de sessão, Fase 5;
                     # appointments.ts, scheduling.ts — Fase 6; financial.ts,
                     # payments.ts — Fase 7; meal-plans.ts — Fase 8; assessments.ts — Fase 9;
                     # supplements.ts, feedbacks.ts, materials.ts — Fase 10; food-analyses.ts,
                     # patient-consents.ts — Fase 11)
  content/           # conteúdo editorial do site com origem no PDF (Fase 4)
  actions/           # server actions — auth.ts, onboarding.ts (Fase 3), contact.ts
                     # (Fase 4), patients.ts, contracts.ts (Fase 5), scheduling.ts
                     # (nutricionista) e patient-booking.ts (paciente) (Fase 6), finance.ts (Fase 7),
                     # meal-plans.ts (Fase 8), assessments.ts (Fase 9), supplements.ts,
                     # feedbacks.ts, materials.ts (Fase 10), food-analysis.ts (paciente, Fase 11)
  validators/        # schemas Zod, compartilhados client/server — auth.ts, contact.ts,
                     # patients.ts, contracts.ts, scheduling.ts, finance.ts, meal-plans.ts,
                     # assessments.ts, patient-content.ts (Fase 10), food-analysis.ts (Fase 11)
  providers/         # abstrações plugáveis: PaymentProvider, EmailProvider,
                     # WhatsAppProvider — ainda não criado (FoodAnalysisProvider vive em
                     # services/food-analysis/, Fase 11)
  jobs/              # tarefas agendadas (lembretes, retries de notificação) — ainda não criado
  emails/            # templates React Email — ainda não criado
  components/        # UI compartilhada (ui/ = shadcn primitives, layout/ = shells + header/
                     # footer/menu mobile, shared/ = genéricos, auth/ = formulários/gate de auth,
                     # marketing/ = seções do site público, blog/ = card + rich text, seo/ = JSON-LD)
  lib/               # utils, cliente Supabase (server/browser/admin/public), auth/
                     # (session, redirect, errors, rate-limit(er) — Fase 3),
                     # dates (pt-BR, America/Sao_Paulo), calendar (aritmética de
                     # data civil), timezone (relógio de parede <-> instante via Intl,
                     # Fase 6), money (centavos <-> BRL), errors/domain (Fase 5), env
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
  // Implementada na Fase 13 (src/services/payments/provider.ts). Devolve
  // sempre um resultado NORMALIZADO; o status do gateway é traduzido para o
  // domínio (nunca circula texto do provider pela aplicação). A verificação
  // do webhook recebe o BODY BRUTO.
  availableMethods(): readonly OnlinePaymentMethod[]
  createCharge(input: CreateChargeInput): Promise<ProviderResult<ProviderCharge>>
  getCharge(providerChargeId: string, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>
  cancelCharge(providerChargeId: string, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification
  parseWebhook(rawBody: string): ProviderWebhookEvent | null
  refundCharge?(providerChargeId: string, amountCents: number, signal: AbortSignal): Promise<ProviderResult<ProviderCharge>>
}

interface EmailProvider {
  // Implementada na Fase 12 (src/services/notifications/providers.ts): recebe
  // HTML/texto já renderizados + idempotencyKey + AbortSignal e devolve um
  // ProviderResult NORMALIZADO ({ accepted, providerMessageId } |
  // { accepted: false, errorCode, httpStatus, retryable }) — nunca lança
  // para erro de envio. Adapters: fake (determinístico) e resend.
  send(message: EmailMessage): Promise<ProviderResult>
}

interface WhatsAppProvider {
  // Fase 12: chave interna de template + variáveis posicionais (o adapter
  // mapeia para o nome aprovado no BSP). Só o fake existe — BSP PENDENTE.
  send(message: WhatsAppMessage): Promise<ProviderResult>
}

interface FoodAnalysisProvider {
  // Implementada na Fase 11 (src/services/food-analysis/provider.ts): recebe a
  // imagem PROCESSADA + AbortSignal e devolve JSON cru; o service valida (Zod)
  // e normaliza — sempre estimativa, nunca valor exato.
  analyzeMealPhoto(input: { imageBytes: Uint8Array; mime: string; width: number; height: number; signal: AbortSignal }): Promise<{ result: unknown }>
}
```

Implementações concretas (Resend, gateway de pagamento, BSP de WhatsApp, modelo
de visão computacional) ficam junto do respectivo módulo de serviço
(`src/services/notifications/`, `src/services/food-analysis/`), nunca
referenciadas diretamente pelo domínio; a fábrica por env decide qual entra.

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

**Implementado (Fase 6):** o fuso vem de `scheduling_settings.timezone`
(default `America/Sao_Paulo`, nunca da máquina). `src/lib/calendar.ts` faz a
aritmética de datas civis (`YYYY-MM-DD`), `src/lib/timezone.ts` converte
relógio de parede ↔ instante só com `Intl` (offset por instante, DST
suportado), páginas e formulários só trocam data civil + `HH:mm`, a conversão
para instante acontece no service e o banco revalida com `starts_at AT TIME
ZONE settings.timezone` (`validate_booking_window`). Os testes de domínio
passam com `TZ=UTC` e `TZ=Asia/Tokyo`.

## Agenda (Fase 6) — quem decide o quê

- **Domínio puro** (`src/domain/scheduling`): slots livres, validação da
  disponibilidade semanal, máquina de estados, faixas das visões e geometria
  da grade. Sem I/O; testado.
- **Banco** (migration Fase 6): fonte final da verdade — `book_appointment`/
  `reschedule_appointment` validam a janela de disponibilidade e a exclusion
  constraint decide sobreposição; triggers garantem `nutritionist_id`
  coerente com o paciente, restrições do PATIENT e bloqueio sem consulta
  ativa; `busy_intervals` expõe só intervalos.
- **Services** (`src/services/scheduling.ts`): ownership explícito,
  recomputam slots antes da confirmação do paciente, chamam as funções SQL,
  auditam e registram eventos internos de notificação (sem entrega).
- **Actions**: `scheduling.ts` (nutricionista, `requireNutritionist`) e
  `patient-booking.ts` (paciente, `requirePatient`; `patient_id` nunca vem do
  browser). UI nunca acessa Supabase.

## Financeiro (Fase 7) — quem decide o quê

- **Domínio puro** (`src/domain/finance`): definições (contratado/recebido/
  pendente/previsto/atrasado/receita/despesa/saldo), saldo de parcela e
  alocação de pagamento (parcial ok, a maior não), períodos em data civil,
  somas por contrato, editabilidade de lançamentos. Sem I/O; testado
  (inclusive virada de mês em America/Sao_Paulo).
- **Banco** (migration Fase 7): `record_manual_payment` (pagamento + baixa
  + lançamento numa transação, idempotente), `cancel_payment` (estorno com
  histórico), trigger que impede editar lançamento gerado por pagamento e
  valor ≤ 0, views de saldo por parcela/contrato, RPCs de resumo por período
  e série mensal, RLS por `nutritionist_id`, DELETE revogado.
- **Data** (`src/data/financial.ts`, `payments.ts`): queries escopadas ao
  nutricionista e ao período, paginação/filtro no servidor, join em código
  quando a view não tem FK para embed do PostgREST.
- **Services** (`src/services/finance.ts`): ownership, regras (só MANUAL
  edita/cancela), chamada das funções SQL, auditoria. Dinheiro sempre em
  centavos (`parseBRLToCents` na action, nunca float).
- **Actions** (`src/actions/finance.ts`): Zod + `requireNutritionist`,
  `returnTo` só interno, toasts só após confirmação do servidor
  (`?toast=` após redirect). Chave de idempotência gerada na page.
- **UI** (`src/components/finance`): cards com definição em tooltip,
  tabela ≥ `lg` / cards abaixo, gráficos Recharts com tabela `sr-only`,
  estados vazio/carregando, confirmações para cancelar/estornar.

## Cardápios (Fase 8) — quem decide o quê

- **Domínio puro** (`src/domain/meal-plans`): ordenação (dias seg→dom,
  `sort_order` com desempate), subir/descer, dias disponíveis, validação
  para publicar, contagens, cópia estrutural com ids novos, seleção da
  versão publicada/rascunho/atual, transições de status, formatação de
  quantidade/unidade. Sem I/O; testado.
- **Banco** (migration Fase 8): `create_meal_plan`,
  `create_meal_plan_version` (cópia profunda), `publish_meal_plan_version`
  (atômica, lock no plano, nunca duas publicadas), `archive_meal_plan`,
  `discard_meal_plan_version`, `duplicate_meal`, `duplicate_meal_plan_day`;
  triggers de imutabilidade (conteúdo só em DRAFT, transições de status,
  version_number fixo); um plano ativo por paciente; RLS da Fase 2
  (paciente só PUBLISHED).
- **Data** (`src/data/meal-plans.ts`): lista de planos/versões só com
  metadata; conteúdo de UMA versão numa query aninhada (dias → refeições →
  itens → substituições, sem N+1); versão publicada do portal; helpers de
  ownership por `!inner` até o plano; visão geral por paciente.
- **Services** (`src/services/meal-plans.ts`): ownership + só DRAFT edita
  (o banco também recusa), funções SQL para cópias/publicação, concorrência
  otimista por `updated_at`, auditoria só com ids.
- **Actions** (`src/actions/meal-plans.ts`): `requireNutritionist`, Zod
  (patient_id da rota, nunca de input; status/version_number/published_by
  nunca do client), `revalidatePath` do perfil, do editor, de
  `/dashboard/cardapios` e do portal.
- **UI** (`src/components/meal-plans`): aba do paciente com histórico,
  ações de versionamento, editor (abas de dia, refeições colapsáveis,
  formulários inline, confirmações), `MealPlanView` compartilhado entre
  portal e leitura no dashboard (Radix Tabs, substituições expansíveis).

## Avaliações e evolução (Fase 9) — quem decide o quê

- **Domínio puro** (`src/domain/assessments`): grupos/ordem das métricas,
  ranges técnicos, IMC derivado, tipo inferido, parsing/formatação pt-BR
  (p.p. para percentual), ordenação por data civil, tendência (última x
  anterior com a métrica), séries sem zeros fictícios, comparação A→B,
  visibilidade e regra de exclusão. Sem I/O; testado.
- **Banco** (migration Fase 9): data civil sem futuro, visibilidade +
  `published_at`, nota interna, arquivamento, metadados do relatório com
  path validado, `set_assessment_measurements` (transacional), guards de
  valor, RLS do paciente por visibilidade (tabelas + bucket via helper
  SECURITY DEFINER).
- **Data** (`src/data/assessments.ts`): selects distintos para nutricionista
  (`internal_notes`) e portal (sem nota interna), lista/detalhe com medidas
  numa query, versão visível do paciente, visão geral por paciente.
- **Services** (`src/services/assessments.ts`): ownership, criação/edição
  com a função SQL, visibilidade, arquivar/excluir, relatório (assinatura do
  arquivo, path seguro, substituição sem órfão, remoção), URLs assinadas de
  60 s para nutricionista e paciente; auditoria só com ids.
- **Actions** (`src/actions/assessments.ts`): `requireNutritionist`, parsing
  pt-BR por métrica com erro por campo, Zod (data ≤ hoje em
  America/Sao_Paulo), upload multipart via Server Action, revalidação.
- **Route handlers** (`…/relatorio`): download server-side com
  `Cache-Control: no-store` (dashboard: ownership; portal: `patient_id` da
  sessão + avaliação visível).
- **UI** (`src/components/assessments`): formulário por seções (composição e
  medidas colapsáveis, campos sempre no DOM), cards de tendência com ícone +
  texto de direção, gráficos com tabela `sr-only`, histórico tabela/cards,
  comparação, ações (visibilidade, arquivar/excluir, relatório).

## Suplementos, feedbacks e materiais (Fase 10) — quem decide o quê

- **Domínio puro** (`src/domain/patient-content`): validador central de
  URL externa (`urls.ts` — só http(s) absoluto; recusa `javascript:`,
  `data:`, `file:`, `ftp:`, `//host`, credenciais), status derivado e
  visibilidade de suplementos (ATIVA/ENCERRADA/ARQUIVADA), feedbacks
  (RASCUNHO/DISPONIBILIZADO/ARQUIVADO) e materiais (tipo, completude,
  atribuição ativa/revogada/material arquivado), tipos e limite técnico de
  arquivo, nome de arquivo seguro, ordenações. Sem I/O; testado.
- **Banco** (migration Fase 10): triggers `guard_supplement_recommendation`,
  `guard_feedback_message` (+ `prevent_feedback_tampering_by_patient`:
  paciente só `read_at`), `guard_patient_material` (path
  `<material_id>/…`, delete só sem histórico), `guard_material_assignment`
  (mesmo nutricionista, material ativo e completo, reatribuição); checks
  de URL; helper SECURITY DEFINER `material_visible_to_patient` nas policies
  de tabela e do bucket `patient-documents`; DELETE revogado em suplementos e
  atribuições; RLS do paciente restrita a ativo/disponibilizado/atribuído.
- **Data** (`src/data/{supplements,feedbacks,materials}.ts`): selects do
  nutricionista (histórico completo) e do portal (repetem o filtro de
  visibilidade da RLS), biblioteca com contagem de atribuições, atribuições
  com paciente/material por embed.
- **Services** (`src/services/{supplements,feedbacks,materials}.ts`):
  ownership explícito (`requireOwnedPatient`, `requireOwnedMaterial`),
  transições de status via domínio, upload com assinatura conferida +
  compensação, substituição sem órfão, URLs assinadas de 60 s para
  nutricionista e paciente, auditoria só com ids, eventos internos de
  notificação.
- **Actions** (`src/actions/{supplements,feedbacks,materials}.ts`):
  `requireNutritionist`, Zod (`validators/patient-content.ts`; patient_id
  da rota, ids como `z.guid()`; nutritionist_id/author_id/published_at/
  archived_at/storage_path/assigned_by nunca do client), multipart para o
  arquivo, `revalidatePath` do perfil, da biblioteca e do portal. Paciente
  só lê (portal) e baixa (route handler).
- **UI** (`src/components/{supplements,feedbacks,materials,portal}`):
  formulários com `useActionState`, badges com ícone + texto, menus de
  ações com confirmação (encerrar/arquivar/disponibilizar/remover
  atribuição), tabelas ≥ `lg` e cards abaixo, `ExternalLink` compartilhado
  (`noopener noreferrer` + host), cards do portal em texto puro.

## Foto da refeição + análise por IA (Fase 11) — quem decide o quê

- **Domínio puro** (`src/domain/food-analysis`): unidades/preparos, limites
  técnicos, totais (kcal inteiro, macros 1 casa), versão confirmada a
  partir da revisão, diff IA x paciente, máquina de estados sobre o enum da
  Fase 2 (+ claim + arquivamento), texto e versão do consentimento,
  tolerância de relógio da refeição, limites da foto. Sem I/O; testado.
- **Provider** (`src/services/food-analysis/{provider,fake-provider,schemas,index}.ts`):
  interface + prompt restrito, fake determinístico, Zod da resposta +
  normalização, factory por env (vendor real `PENDENTE`).
- **Banco** (migration Fase 11): `patient_consents` (paciente registra/
  revoga; `patient_has_consent` SECURITY DEFINER), guards em
  `food_photo_analyses` (consentimento, path, data, transições, original
  imutável, arquivada só leitura), policy de auditoria do paciente. Bucket
  `meal-photos` e RLS da Fase 2 intactos.
- **Imagem** (`src/lib/images/meal-photo.ts`, server-only): assinatura,
  limite, `sharp` (orientação, ≤ 1600 px, WebP sem EXIF), sha256.
- **Data** (`src/data/food-analyses.ts`, `patient-consents.ts`): selects
  com parsing defensivo dos JSON; histórico do paciente; confirmadas/em
  revisão para o nutricionista; consentimento ativo.
- **Services** (`src/services/food-analysis/service.ts`): consentimento,
  criação (processa → upload → linha; dedupe por sha256), pedido de análise
  (rate limit → claim atômico → download do objeto → provider com timeout →
  Zod → ANALYZED/FAILED), confirmação/correção, data/hora, arquivamento
  (remove o objeto), URLs assinadas para paciente e nutricionista;
  auditoria só com ids/provider.
- **Actions** (`src/actions/food-analysis.ts`): `requirePatient` +
  paciente da sessão, multipart da foto (dois inputs câmera/galeria), Zod
  da revisão (números pt-BR), revalidação. Route handlers de foto para
  paciente e nutricionista.
- **UI** (`src/components/meals`): consentimento, captura com preview,
  painel de análise (aria-live, retry), formulário de revisão (totais ao
  vivo, adições rápidas), leitura com original x confirmado, ações, cards
  do histórico; aba Refeições do perfil e detalhe para o nutricionista com
  CTA de feedback.

## Notificações (Fase 12) — quem decide o quê

```
operação de negócio (Server Action / RPC)  →  trigger AFTER (mesma transação)
  → notification_events (dedupe_key; lembrete com scheduled_for)
  → job "generate": routeEvent() → notification_deliveries por canal
       (IN_APP grava `notifications`; EMAIL/WHATSAPP PENDING; SKIPPED sem contato)
  → job "process": claim_notification_deliveries (SKIP LOCKED) → render →
       provider (timeout) → SENT | PENDING + next_attempt_at | FAILED
```

- **Banco** (migrations `20260925120000/01`): colunas novas em
  `notification_events`/`notification_deliveries`/`notifications`, funções
  `enqueue_notification_event`, `cancel_pending_notification_events`,
  `appointment_reminder_due_at`, `claim_notification_events`,
  `claim_notification_deliveries`, `confirm_appointment_presence`; triggers
  `notify_appointment_changes`, `notify_feedback_published`,
  `notify_material_assigned`, `notify_supplement_created`;
  `appointments.patient_confirmed_at`; `notification_action_tokens`;
  `notification_preferences`; `patient_notification_preferences`.
- **Domínio puro** (`src/domain/notifications/`): catálogo de eventos,
  defaults de canal, roteamento (`routeEvent`), chave de idempotência,
  lembrete de 5 dias civis (`reminderDueAt`/`decideReminder`),
  classificação transitório × permanente, backoff, `decideAfterFailure`,
  `canRetryManually`, telefone E.164 + máscaras, variáveis de template
  (pt-BR no fuso), in-app/assunto/variáveis de WhatsApp, regras do token.
  Sem I/O; 24 testes.
- **Providers** (`src/services/notifications/{providers,fake-providers,
  resend-email-provider,index}.ts`): interfaces + `ProviderResult`, fakes,
  adapter Resend, fábricas por env que recusam configuração incompleta,
  `getProviderConfigStatus()` para a UI (nunca valores de chave).
- **Templates** (`src/emails/`): layout base + 9 templates React Email;
  `renderNotificationEmail` (HTML + texto) em
  `src/services/notifications/render.ts` (sem `server-only`, usado pelo
  preview local e pelos testes).
- **Worker** (`src/services/notifications/service.ts`, admin client):
  `generateDeliveries`, `processDeliveries`, `runNotificationCycle`. Logs só
  com ids/canal/código.
- **Tokens** (`src/services/notifications/tokens.ts`): geração, hash com
  pimenta, consumo atômico de uso único.
- **Casos de uso de pessoas** (`src/services/notifications/management.ts`,
  sessão): marcar lida/todas, preferências (paciente e nutricionista +
  auditoria), reprocessar FAILED (relê contato; audita; processa), confirmar
  presença pelo portal (RPC), pedir confirmação (enfileira evento), confirmar
  por token.
- **Data** (`src/data/notifications.ts`): lista/contador do portal (só
  `notifications`), entregas do dashboard com destinatário mascarado e nome
  do paciente lido à parte, contadores por status, próximos eventos
  agendados, matriz de preferências resolvida.
- **Actions** (`src/actions/notifications.ts`): `requirePatient`/
  `requireNutritionist`, Zod só com ids/flags, rate limit em reenvio/ciclo
  manual/ação tokenizada por IP; `confirmByTokenAction` é a única pública.
- **Job** (`src/app/api/cron/notifications/route.ts` + `src/lib/auth/cron.ts`):
  autenticação própria por `CRON_SECRET` (testada), `?task=`, `?limit=`.
- **UI**: portal (`/paciente/notificacoes`, sino no `PatientHeader`,
  `ConfirmPresenceButton` no card da consulta), público
  (`/confirmar/[token]`), dashboard (`/dashboard/notificacoes`,
  `/dashboard/configuracoes/notificacoes`, hub `/dashboard/configuracoes`,
  `RequestConfirmationButton` no detalhe da consulta).

## Pagamentos online (Fase 13) — quem decide o quê

```
paciente escolhe a parcela + método
  → create_installment_charge (RPC): autoriza, DERIVA o valor do saldo,
     reaproveita a cobrança ativa, cria `payment_charges` CREATED
  → PaymentProvider.createCharge: Pix (QR + copia e cola) ou checkout do cartão
  → cobrança PENDING; a tela diz "estamos confirmando" (nunca "aprovado")
  → provider → webhook assinado → verifica (body bruto) → idempotência por
     (provider, event_id) → decideChargeTransition
       PAID  → record_online_payment: payments + parcela + lançamento +
               status + evento PAYMENT_CONFIRMED, tudo numa transação
       divergência → payment_reconciliation_items (decisão humana)
  → job /api/cron/payments: expira vencidas, reconcilia pendentes
```

- **Domínio puro** (`src/domain/payments/`): status e rótulos da cobrança,
  expiração derivada, elegibilidade e VALOR da parcela, reuso/nova cobrança,
  chave de idempotência, mapper provider → domínio, transições (fora de
  ordem, terminal, desconhecido), conferência de valor/moeda, resumo
  sanitizado do evento e tipos de reconciliação. Sem I/O; 15 testes.
- **Banco** (migration `20260926120000`): `payment_charges`,
  `payment_webhook_events`, `payment_reconciliation_items`;
  `apply_payment_effects` (baixa única, usada também pelo pagamento manual),
  `create_installment_charge`, `cancel_payment_charge`,
  `record_online_payment`, `expire_payment_charges`, view
  `installment_active_charge`; policy nova de SELECT de `payments` para o
  próprio paciente.
- **Providers** (`src/services/payments/{provider,fake-provider,index}.ts`):
  interface + `ProviderResult`, fake determinístico (sem rede, sem dado de
  cartão), fábrica por env que recusa configuração incompleta e
  `getPaymentProviderStatus()` para a UI (nunca segredo).
- **Services**: `checkout.ts` (criar/cancelar cobrança, com timeout e
  auditoria), `webhook.ts` (processar evento, expirar, reconciliar),
  `reconciliation.ts` (resolver item, rodar conferência, detectar PAID sem
  pagamento).
- **Data** (`src/data/payment-charges.ts`): cobrança por id, do paciente, do
  nutricionista, cobrança ativa por parcela (view) e itens de reconciliação.
- **Actions** (`src/actions/payments.ts`): `requirePatient`/
  `requireNutritionist`, Zod só com referência + método, rate limit no que é
  acionável por pessoa (o webhook não passa por lá).
- **Rotas**: `/api/webhooks/payments/[provider]` (assinatura sobre o corpo
  bruto), `/api/cron/payments` (`CRON_SECRET`), `/api/dev/payments/simulate`
  (só fora de produção, com sessão e ownership).
- **UI**: portal (`/paciente/pagamentos`, `/paciente/pagamentos/[installmentId]`,
  `/paciente/pagamentos/checkout/[chargeId]`) e dashboard (cobranças no
  financeiro, `/dashboard/financeiro/reconciliacao`,
  `/dashboard/configuracoes/pagamentos`, botão de cobrança na parcela).
