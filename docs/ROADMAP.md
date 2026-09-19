# ROADMAP

Ordem definida pelo usuário. Cada fase só inicia com autorização explícita.
Critérios de entrada da Fase 1 estão no fim deste documento.

- **FASE 0 — Descoberta e arquitetura.** ✅ Concluída (este conjunto de docs).
- **FASE 1 — Fundação do projeto.** ✅ Concluída. Next.js 16.3.5 (App Router,
  TS strict, Tailwind v4, `src/`), shadcn/ui, design tokens (paleta + tipografia
  Fraunces/Manrope), shells do site público/dashboard/portal do paciente,
  validação de env centralizada, Vitest + Playwright, lint/typecheck/build
  passando. Correção de arquitetura registrada em `DECISIONS.md`
  (`/dashboard` e `/paciente` viraram segmentos de rota reais, não route
  groups). Não inclui: Supabase real, autenticação, dados, RLS — isso é
  Fase 2/3.
- **FASE 2 — Banco de dados.** ✅ Concluída. Supabase local (CLI via npm,
  Docker), 20 migrations (39 tabelas + 2 views + 5 buckets), RLS em 100% das
  tabelas com funções auxiliares `SECURITY DEFINER`, anti-double-booking via
  exclusion constraint (validado com teste real de concorrência entre duas
  conexões), idempotência financeira testada, seed fictício, clientes
  Supabase (browser/server/admin) e tipos gerados. 30 testes pgTAP + 1 teste
  de concorrência, todos passando. Login/autenticação real continuam de fora
  — isso é Fase 3.
- **FASE 3 — Autenticação e autorização.** ✅ Concluída. Supabase Auth via
  `@supabase/ssr`, `src/proxy.ts` (Next.js 16 renomeou `middleware.ts` para
  `proxy.ts` — ver `docs/DECISIONS.md`) + helpers server-side
  (`requireNutritionist`/`requirePatient`) como camadas independentes de
  proteção de rota, provisionamento automático de `profiles` via trigger
  (role default sempre `PATIENT`, nunca lida de metadata do client), login/
  logout/esqueci-senha/redefinir-senha, onboarding mínimo de paciente por
  convite (sem tela completa de gestão — isso é Fase 5), sanitização central
  de redirect testada contra 6 vetores de ataque, rate limiting em memória
  (login/esqueci-senha/convite), CSRF coberto pela proteção nativa de Server
  Actions do Next.js (verificação de `Origin`). 47 testes unitários + 36
  pgTAP (6 novos de provisionamento/role escalation) + 13 checks de
  integração contra Auth/PostgREST reais + 15 E2E Playwright, todos
  passando. Duas correções de bug descobertas só ao testar o fluxo real
  (nunca antes exercitado) documentadas em `docs/DECISIONS.md`.
- **FASE 4 — Site público.** ✅ Concluída. 12 páginas públicas definitivas
  (`/`, `/metodo-em`, `/sobre`, `/acompanhamento`, `/planos`, `/resultados`,
  `/blog`, `/blog/[slug]`, `/contato`, `/agendar`, `/politica-de-privacidade`,
  `/termos`) com header/menu mobile e footer definitivos, narrativa
  antes/durante/depois, 4 pilares válidos (grupo exclusivo removido,
  Comunidade VIP fora até definição), planos/preços/benefícios lidos do
  banco via cliente anônimo (ANUAL nunca aparece; trimestral/semestral sem
  preço principal inventado), blog e resultados respeitando RLS pública,
  contato que valida mas não finge envio, SEO (metadataBase, OG, sitemap,
  robots, canonical, JSON-LD só com dados reais), ISR de 10 min. 5 fotos
  reais + logo recortado + monograma em `public/`. 86 testes unitários +
  21 checks de integração de conteúdo público + 27 E2E (12 novos). Copy e
  assets documentados em `DECISIONS.md`.
- **FASE 5 — Pacientes e contratos.** ✅ Concluída. `/dashboard/pacientes`
  real (cards de pacientes ativos / ticket médio / total, busca e filtros
  server-side por query param, paginação, tabela ≥ 1024 px e cards abaixo),
  criar/editar/desativar/reativar paciente (sem hard delete), cadastro sem
  conta + convite opcional reutilizando o onboarding da Fase 3, perfil
  `/dashboard/pacientes/[id]` (visão geral, acesso ao portal, contrato
  atual com contratado/recebido/pendente/previsto da view financeira,
  timeline real, histórico de contratos com parcelas, pagamentos existentes
  só-leitura, seções futuras com resumo real + "Disponível em uma próxima
  etapa"), novo contrato (plano + condição de preço do banco, ANUAL com
  badge "Não disponível no site", datas sugeridas, parcelas determinísticas
  com remainder de centavos e regra do dia 31, pré-visualização),
  cancelar/encerrar contrato com confirmação e histórico preservado.
  Camadas `src/data`, `src/services`, `src/actions`, `src/validators`,
  `src/domain/{patients,contracts}`, erros de domínio, auditoria escrita
  pela aplicação, 1 migration (view `patient_overview`, funções SQL
  transacionais, índice único de e-mail, `patient_contracts.notes`).
  Testes unitários, pgTAP (34 novos), 37 checks de integração de
  pacientes/contratos (ownership entre dois nutricionistas, ids
  adulterados), 14 E2E novos, screenshots reais em 1440/768/390
  (+375/430/1024/1280) revisadas e corrigidas. Registro manual de pagamento
  fica para a Fase 7.
- **FASE 6 — Agenda.** ✅ Concluída. `/dashboard/agenda` real (dia/semana/
  mês, grade por minutos no fuso, disponibilidade e bloqueios no fundo,
  próximas sessões com filtro), detalhe da consulta com máquina de estados
  (confirmar/realizada/faltou/cancelar com motivo/reagendar com histórico/
  editar), nova consulta (autocomplete de paciente server-side, slots
  livres, contrato opcional, override administrativo), bloqueios (horário,
  intervalo, dia inteiro, vários dias), `/dashboard/agenda/configuracoes`
  (disponibilidade semanal com múltiplos intervalos, duração/granularidade/
  antecedências/horizonte/permissões — tudo configurável, nada real
  inventado), portal do paciente (`/paciente/consultas` com próxima/futuras/
  histórico, `/paciente/agendar` mobile-first data → horário → tipo →
  confirmar, reagendar/cancelar próprias consultas), `/agendar` público com
  CTA + `next` seguro. Slots por domínio puro + validação no banco
  (`book_appointment`/`reschedule_appointment`), `busy_intervals` sem vazar
  pacientes, triggers de ownership/status do paciente/bloqueio x consulta,
  eventos internos de notificação sem entrega. 46 testes unitários novos
  (rodam em `TZ=UTC` e `TZ=Asia/Tokyo`), 36 pgTAP novos, 36 checks de
  integração, 12 de concorrência real (2 pacientes, nutri+paciente, 2
  reagendamentos), 17 E2E novos, screenshots em 1440/1024/768/390/375/430.
- **FASE 7 — Financeiro.** Lançamentos manuais + automáticos a partir de
  consulta/pagamento, previsão de recebimentos, relatórios (contratado/
  recebido/pendente/previsto).
- **FASE 8 — Cardápios.** CRUD de plano alimentar, versionamento, visão do
  paciente.
- **FASE 9 — Bioimpedância/evolução.** Registro de avaliação, gráficos no
  portal do paciente.
- **FASE 10 — Suplementos, feedbacks e materiais.** CRUD + notificação in-app.
- **FASE 11 — IA de refeições.** `FoodAnalysisProvider`, upload de foto,
  estimativa, fluxo de confirmação/correção pelo paciente.
- **FASE 12 — Notificações.** E-mail (Resend/React Email), WhatsApp oficial,
  lembrete de 5 dias, idempotência.
- **FASE 13 — Pagamentos.** `PaymentProvider`, checkout, webhook, idempotência,
  retry.
- **FASE 14 — CMS, resultados e configurações.** Blog completo no dashboard,
  antes/depois com consentimento, tela de configurações (horários, dados do
  profissional, textos do site).
- **FASE 15 — Segurança, testes, acessibilidade, performance e SEO.** Testes de
  RLS/IDOR, concorrência de agenda, webhooks, timezone; auditoria WCAG;
  Lighthouse/performance; sitemap/robots/structured data.
- **FASE 16 — Produção e deploy.** Ambiente de produção, domínio, monitoramento,
  backups, runbook de incidentes.

## Critérios para iniciar a Fase 1

1. Usuário revisou este conjunto de documentos (`PROJECT_SPEC`, `ARCHITECTURE`,
   `DATABASE`, `SECURITY`, `DECISIONS`) e aprovou explicitamente.
2. Pendências de preço dos planos trimestral/semestral (`DECISIONS.md`) foram
   esclarecidas ou o usuário aceitou seguir com placeholder configurável.
3. Usuário confirmou (ou aceitou adiar) decisão sobre "Comunidade VIP" e
   periodicidade de presencial no semestral.
4. Nenhuma instalação de dependência, criação de projeto Next.js ou escrita de
   código de aplicação acontece antes do item 1.

Todos os 4 itens foram cumpridos em 2026-09-13 (aprovação explícita do
usuário) — ver histórico da conversa.

## Critérios para iniciar a Fase 2

1. Usuário revisou o resultado da Fase 1 (shells, design system, testes) e
   aprovou explicitamente.
2. Nenhuma tabela, migration, RLS policy ou conexão real ao Supabase é criada
   antes dessa aprovação.
3. Credenciais reais do Supabase (projeto criado por Enzo ou pelo usuário)
   disponíveis para preencher `.env.local` quando a Fase 2 precisar conectar
   de verdade — até lá, o schema pode ser desenhado/migrado localmente.

Todos os 3 itens foram cumpridos (schema desenhado e validado 100% contra
Supabase local; nenhuma credencial de produção foi necessária ou usada).

## Critérios para iniciar a Fase 3

1. Usuário revisou o schema, RLS e testes de banco da Fase 2 e aprovou
   explicitamente.
2. Um projeto Supabase real (hospedado) existe quando chegar a hora de
   implantar em produção — não bloqueia começar a Fase 3 em ambiente local.
3. Nenhuma tela de login/cadastro funcional, middleware de autorização ou
   fluxo de sessão é implementado antes dessa aprovação.

Todos os 3 itens foram cumpridos (aprovação explícita em 2026-09-17;
projeto Supabase hospedado real fica para antes da Fase 16).

## Critérios para iniciar a Fase 4

1. Usuário revisou o resultado da Fase 3 (autenticação, autorização, testes)
   e aprovou explicitamente.
2. Pendências de conteúdo do site público (`docs/DECISIONS.md`: preço
   principal de trimestral/semestral, CRN, telefone, endereço, redes
   sociais, "Comunidade VIP", identidade visual definitiva) esclarecidas ou
   o usuário aceitou seguir com `PENDENTE DE DEFINIÇÃO` visível no conteúdo.
3. Aprovação explícita da Fase 3 recebida em 2026-09-17; pendências de
   conteúdo aceitas como `PENDENTE DE DEFINIÇÃO` (o site simplesmente não
   renderiza o que não existe).

Todos os itens cumpridos; Fase 4 concluída em 2026-09-18.

## Critérios para iniciar a Fase 5

1. Usuário revisou o site público (copy, fotos, planos, páginas legais) e
   aprovou explicitamente.
2. Confirmar com Enzo, antes ou durante a Fase 5, o preço "principal" de
   trimestral/semestral (`is_primary`) e o status de "Comunidade VIP" — o
   site já reage a essas decisões sem deploy (banco/`plan_benefits`).
3. Aprovação técnica explícita da Fase 4 recebida em 2026-09-18 (a revisão
   visual definitiva do site público continua sujeita a screenshots em
   múltiplos breakpoints, sem bloquear a Fase 5). Fase 5 concluída em
   2026-09-18.

## Critérios para iniciar a Fase 6

1. Usuário revisou o módulo de pacientes/contratos (listagem, perfil,
   formulários, contratos/parcelas, screenshots) e aprovou explicitamente.
2. Pendências que a agenda pode precisar: periodicidade default de consultas
   presenciais por plano (`docs/DECISIONS.md`, inconsistência 1), formato da
   consulta online, horários de trabalho de Enzo — podem seguir como
   `PENDENTE DE DEFINIÇÃO` configurável.
3. Aprovação formal da Fase 5 recebida em 2026-09-18. Fase 6 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 7

1. Usuário revisou a agenda (dashboard e portal), a configuração de
   disponibilidade e os fluxos de agendamento/reagendamento/cancelamento e
   aprovou explicitamente.
2. Definições que o financeiro vai precisar: categorias reais de receita/
   despesa, política de baixa manual, se consulta avulsa gera lançamento na
   criação ou na realização — podem entrar como configuração/`PENDENTE`.
3. **Aguardando aprovação explícita do usuário** — não iniciar financeiro
   completo, cardápios, notificações externas ou IA sem sinal verde
   (prompt Fase 6 §107).
