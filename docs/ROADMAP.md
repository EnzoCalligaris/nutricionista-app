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
- **FASE 3 — Autenticação e autorização.** Supabase Auth, `profiles`, papéis,
  RLS base, middlewares de rota por papel.
- **FASE 4 — Site público.** Home, Método EM, Sobre Mim, pilares, planos
  (com preços reais confirmados — ver `DECISIONS.md` pendências), blog
  (listagem/detalhe), contato, login. SEO básico.
- **FASE 5 — Pacientes e contratos.** CRUD de paciente, planos, contratos,
  parcelas — sem pagamento online ainda (lançamento manual de pagamento).
- **FASE 6 — Agenda.** Disponibilidade, bloqueios, agendamento do paciente,
  constraint anti-overlap, próximas sessões, status de consulta.
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
