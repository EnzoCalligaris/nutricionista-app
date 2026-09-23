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
- **FASE 7 — Financeiro.** ✅ Concluída. `/dashboard/financeiro` real
  (cards Receita/Despesas/Saldo + Recebido/Pendente/Previsto com definições
  em tooltip, períodos este mês/mês passado/3/6 meses/ano/personalizado,
  tabela de lançamentos paginada e filtrada no servidor por tipo/status/
  categoria/método/busca por descrição ou paciente, origem visível),
  lançamento manual (criar/editar/cancelar — nunca apagar; gerados por
  pagamento são somente leitura), registrar pagamento manual (função SQL
  atômica: pagamento + baixa da parcela + lançamento de receita; parcial
  permitido, a maior recusado, idempotente por chave gerada no servidor),
  estorno com histórico, parcelas com Recebido/Restante/Status derivado
  (Parcial/Em atraso), `/dashboard/financeiro/previsao` por contrato, home
  do dashboard com cards reais (faturamento do mês, consultas de hoje,
  pacientes ativos, previsão de rendimento) e gráficos Recharts com tabela
  equivalente para leitor de tela, aba Financeiro do paciente funcional.
  Consulta nunca gera receita automática (política de cobrança da avulsa
  continua `PENDENTE DE DEFINIÇÃO`, constante configurável). 36 testes
  unitários novos, 42 pgTAP novos, 46 checks de integração
  (`test:financial:integration`), E2E `e2e/finance.spec.ts`, screenshots
  em 1440/1280/1024/768/390. Sem gateway, PIX automático, cartão, webhook,
  e-mail/WhatsApp ou exportação (Fases 12–13).
- **FASE 8 — Cardápios.** ✅ Concluída. Plano alimentar real por paciente:
  aba Cardápio (`/dashboard/pacientes/[id]?tab=cardapio` — plano atual,
  status, versão publicada/rascunho, conteúdo, ações, histórico de versões,
  planos arquivados), `/cardapio/novo` (paciente do contexto, plano anterior
  como base), `/cardapio/dados`, editor por versão
  `/cardapio/[versionId]` (dias seg–dom opcionais em abas, refeições com nome
  livre/horário/ordem explícita, alimentos com quantidade + unidade
  controlada, observações em plano/versão/dia/refeição/alimento,
  substituições explícitas, subir/descer, duplicar refeição e dia com
  confirmação, salvar explícito, concorrência otimista por `updated_at`),
  versionamento DRAFT → PUBLISHED → ARCHIVED com publicação atômica
  (`publish_meal_plan_version`, lock no plano, nunca duas publicadas,
  histórico imutável por trigger), `/dashboard/cardapios` (visão por
  paciente), portal `/paciente/cardapio` (só a versão publicada, abas de
  dia, cards de refeição, substituições expansíveis, mobile-first) e
  "Cardápio do dia" no início do portal. Sem cálculo nutricional, IA,
  templates globais ou PDF. 1 migration nova, 37 testes unitários, 54
  pgTAP, 48 checks de integração (`test:meal-plans:integration`, incl.
  duas publicações simultâneas), 17 E2E, screenshots em
  1440/1280/1024/768/390/375/430.
- **FASE 9 — Bioimpedância/evolução.** ✅ Concluída. Aba Avaliações do
  paciente (evolução com variação vs anterior, gráficos Recharts, histórico,
  comparação, relatórios), `/avaliacoes/nova` e `/[assessmentId]` (+
  `/editar`, `/comparar`, `/relatorio`), `/dashboard/avaliacoes` (visão por
  paciente), portal `/paciente/evolucao` (+ detalhe e download) e card
  "Última avaliação" no início. Catálogo flexível da Fase 2 mantido
  (medidas por `measurement_types`, nenhuma obrigatória, ranges técnicos —
  nunca clínicos), data civil em America/Sao_Paulo (sem futuro),
  observação visível x nota interna, visibilidade por avaliação (paciente
  só vê liberada e não arquivada — RLS de tabela e de bucket), relatório
  PDF/JPG/PNG no bucket privado `bioimpedance-reports` com assinatura de
  arquivo conferida, path seguro e URL assinada de 60 s server-side,
  arquivamento (histórico) e exclusão só de avaliação nunca exibida,
  comparação A→B com deltas em kg/cm/p.p. e direção descritiva (sem
  "melhorou/piorou"), IMC derivado só como valor. Sem OCR, IA, protocolos
  de dobras, PDF de evolução ou CSV. 1 migration nova, 31 testes unitários,
  43 pgTAP (incl. RLS do storage), 43 checks de integração com upload/
  download reais (`test:assessments:integration`), 15 E2E, screenshots em
  1440/1280/1024/768/390/375/430.
- **FASE 10 — Suplementos, feedbacks e materiais.** ✅ Concluída. Aba
  Suplementos do paciente (`?tab=suplementos`, `/suplementos/novo`,
  `/[supplementId]/editar`: produto/marca, orientação, dose e frequência em
  texto livre, período opcional, link de compra só http(s) validado por
  helper central + check no banco; status derivado ATIVA/ENCERRADA/
  ARQUIVADA, encerrar/reativar explícitos, arquivar irreversível, nunca
  hard delete), aba Feedbacks (`?tab=feedbacks`, `/feedbacks/novo`,
  `/[feedbackId]/editar`: título/data de referência opcionais, textarea,
  "Salvar rascunho" x "Disponibilizar ao paciente" — definitivo —, edição
  auditada mesmo após disponibilizar, arquivar, excluir só rascunho; não é
  chat), `/dashboard/materiais` (biblioteca reutilizável: arquivo PDF/JPG/
  PNG até 10 MB no bucket privado `patient-documents` com assinatura
  conferida e path `<material_id>/<uuid>.<ext>`, OU link externo; detalhe
  com quem recebeu, atribuir por autocomplete server-side, remover
  atribuição, substituir arquivo, arquivar) e aba Materiais do paciente
  (atribuir da biblioteca, histórico de revogados/arquivados). Portal:
  `/paciente/suplementos` (só ativas), `/paciente/feedbacks` (só
  disponibilizados), `/paciente/materiais` (só atribuídos, não revogados,
  material não arquivado; download por route handler com URL assinada de
  60 s) e cards resumidos no início. Eventos internos
  `SUPPLEMENT_RECOMMENDATION_CREATED`/`FEEDBACK_PUBLISHED`/
  `MATERIAL_ASSIGNED` sem entrega. 1 migration, 31 testes unitários, 75
  pgTAP (incl. RLS do bucket), 76 checks de integração
  (`test:patient-content:integration`), 17 E2E, screenshots em
  1440/1280/1024/768/390/375/430. Sem IA, notificações externas, gateway ou CMS.
- **FASE 11 — IA de refeições.** ✅ Concluída. Portal `/paciente/refeicoes`
  (histórico: foto, data/hora, total confirmado, status), `/nova` (câmera
  `capture="environment"` OU galeria, preview, trocar/remover, data/hora
  ajustável), `/[analysisId]` (uma tela para todos os estados: analisar →
  "Analisando sua refeição..." → "Revise sua refeição" com edição de
  alimento/quantidade/unidade/preparo/macros, remover/restaurar, adições
  rápidas de óleo/molho/acompanhamento, totais recalculados ao vivo →
  confirmar → leitura com "O que a IA estimou inicialmente" e diff →
  corrigir depois, ajustar data, arquivar), `/consentimento` (texto
  versionado `meal_photo_ai_v1`, aceite persistido em `patient_consents`,
  revogação para análises futuras). Foto processada no servidor (assinatura
  JPEG/PNG/WebP, ≤ 12 MB, orientação EXIF aplicada, ≤ 1600 px, WebP sem
  EXIF/GPS; só a processada é guardada) no bucket privado `meal-photos`
  (`<patient_id>/<analysis_id>/<uuid>.webp`), entregue por route handler com
  URL assinada de 60 s. `FoodAnalysisProvider` (interface + prompt
  restrito + factory por env) com `FakeFoodAnalysisProvider` determinístico;
  vendor/modelo real `PENDENTE DE DEFINIÇÃO`; resposta validada por Zod e
  normalizada (totais recalculados, texto puro); original da IA imutável
  no banco, versão confirmada à parte. Claim atômico (idempotência),
  timeout com FAILED + "Tentar novamente", rate limit técnico por paciente,
  auditoria só com ids/provider. Nutricionista: aba Refeições
  (confirmadas; em revisão à parte) e detalhe com foto, original x
  correções e CTA "Escrever feedback" — sem nota/score/meta/cardápio. 1
  migration, 27 testes unitários, 57 pgTAP (incl. RLS do bucket), 53 checks
  de integração (`test:food-analysis:integration`), 10 E2E, screenshots em
  1440/1024/768/390/375/430. Sem OCR, reconhecimento facial, notificação
  externa, gateway ou fornecedor real.
- **FASE 12 — Notificações.** ✅ Concluída. Outbox transacional no banco:
  triggers AFTER em `appointments`/`feedback_messages`/`material_assignments`/
  `supplement_recommendations` enfileiram `notification_events` na MESMA
  transação da operação (idempotente por `dedupe_key`; lembrete de 5 dias
  civis em America/Sao_Paulo já nasce com `scheduled_for` via
  `appointment_reminder_due_at`; criada a < 5 dias não tem lembrete;
  reagendar cancela CREATED da nova + lembrete da antiga e gera RESCHEDULED
  + lembrete novo; cancelar/concluir/faltar cancelam o lembrete; editar
  horário move o lembrete). Worker (`src/services/notifications/service.ts`):
  eventos devidos → entregas por canal (IN_APP sempre — item em
  `notifications` com link relativo; EMAIL/WHATSAPP conforme default
  técnico + preferências do nutricionista por evento/canal + preferências
  do paciente; SKIPPED `MISSING_EMAIL`/`MISSING_PHONE`/canal desligado),
  idempotentes por `<event_id>:<canal>:<patient_id>`; claim atômico
  `claim_notification_deliveries` (`FOR UPDATE SKIP LOCKED`, lote limitado,
  recuperação de PROCESSING travado), provider com timeout, resposta
  normalizada, retry com backoff 1/5/30/120 min até 5 tentativas para
  transitório (timeout/429/5xx), FAILED imediato para permanente
  (destinatário inválido, config), reprocessamento manual pelo nutricionista
  (relê o contato atual; audita `NOTIFICATION_RETRY_REQUESTED`).
  `EmailProvider` (`fake` determinístico + `resend` escrito pela doc
  oficial: `resend.emails.send` com `Idempotency-Key`; `EMAIL_PROVIDER=resend`
  sem `RESEND_API_KEY`/`EMAIL_FROM` = erro de configuração, nunca cai no
  fake) e `WhatsAppProvider` (`fake`; BSP oficial `PENDENTE` — template key +
  variáveis posicionais, mapa `WHATSAPP_TEMPLATE_MAP`). 9 templates React
  Email em `src/emails/` (identidade Método EM, pt-BR, "24/09/2026 às
  14:30", links de `NEXT_PUBLIC_SITE_URL`, sem conteúdo clínico). Confirmação
  de presença: portal (`confirm_appointment_presence`, SCHEDULED → CONFIRMED
  só junto com `patient_confirmed_at`) e link tokenizado
  `/confirmar/[token]` (32 bytes aleatórios, só hash no banco, propósito
  único, expira até a consulta/7 dias, uso único atômico, GET não consome,
  rate limit por IP, "Este link expirou. Entre no portal para continuar.").
  "Pedir confirmação" no detalhe da consulta (evento
  `APPOINTMENT_CONFIRMATION_REQUEST`, um por dia). Job
  `/api/cron/notifications` (`Authorization: Bearer CRON_SECRET`,
  comparação em tempo constante, fail closed em produção, `?task=generate|
  process`, `vercel.json` a cada 15 min — Hobby só permite 1×/dia,
  documentado). Portal: `/paciente/notificacoes` (lista, lida/não lida,
  marcar uma/todas, preferências e-mail/WhatsApp), sino com contador no
  header, "Confirmar presença" no card da consulta. Dashboard:
  `/dashboard/notificacoes` (contadores, filtros, destinatário mascarado,
  tentativas, erro sanitizado, Reenviar, "Processar fila agora", próximos
  lembretes), `/dashboard/configuracoes/notificacoes` (status dos providers
  Configurado/Simulado/Não configurado sem valores de chave, matriz evento
  × canal com auditoria `NOTIFICATION_SETTINGS_UPDATED`). RLS: eventos/
  entregas só do nutricionista dono; paciente só `notifications` próprias;
  tokens sem policy (service role). 2 migrations, 38 testes unitários
  novos, 88 pgTAP, 16 checks de integração (`test:notifications:integration`
  — worker real em Node com providers fake), 9 E2E, previews de e-mail
  (`npm run emails:preview`), screenshots em 1440/1024/768/390/375/430.
  Sem gateway, checkout, PIX, marketing, newsletter, chatbot ou automação
  de WhatsApp Web.
- **FASE 13 — Pagamentos online.** ✅ Concluída. **Cobrança ≠ pagamento**:
  `payment_charges` (intenção, com provider/método/expiração) não é receita;
  só o `payments` CONFIRMED vinculado entra no financeiro da Fase 7. Uma
  migration nova: cobranças (uma ATIVA por parcela, índice único parcial),
  `payment_webhook_events` (idempotente por provider + event_id, só resumo
  sanitizado), `payment_reconciliation_items` (divergências que exigem
  decisão humana) e `apply_payment_effects` — a ÚNICA implementação de
  "baixar parcela + lançar receita", para a qual `record_manual_payment`
  (Fase 7) passou a delegar. `create_installment_charge` deriva o VALOR do
  saldo da parcela (o cliente só manda a referência e o método), confere
  autorização (paciente dono ou nutricionista) e reaproveita a cobrança
  ativa; `record_online_payment` confirma tudo numa transação (payment +
  parcela + lançamento + status + evento `PAYMENT_CONFIRMED` da Fase 12).
  `PaymentProvider` (`src/services/payments/`) com `FakePaymentProvider`
  determinístico — checkout, Pix (QR + copia e cola claramente fictícios) e
  cartão SIMULADOS, sem rede e **sem jamais pedir número de cartão/CVV**;
  gateway real `PENDENTE DE DEFINIÇÃO` e identificador sem adapter =
  erro de configuração (nunca fallback). Webhook
  `/api/webhooks/payments/[provider]` verifica a assinatura sobre o BODY
  BRUTO antes de qualquer parsing; evento duplicado (10×) = 1 efeito,
  evento fora de ordem não rebaixa PAID, status desconhecido nunca vira
  PAID, valor/moeda divergentes e parcela já quitada no caixa abrem
  reconciliação em vez de duplicar receita. Job `/api/cron/payments`
  (mesmo `CRON_SECRET`) expira cobranças e reconcilia pendentes
  ("webhook perdido"). Portal: `/paciente/pagamentos` (plano, parcelas,
  saldo, cobranças), resumo antes de pagar, checkout com Pix/cartão e
  "estamos confirmando" até a confirmação server-side, cobrança expirada
  com nova cobrança. Dashboard: cobranças no financeiro,
  `/dashboard/financeiro/reconciliacao` (resolver com auditoria),
  `/dashboard/configuracoes/pagamentos` (provedor, ambiente, métodos,
  webhook — nunca segredo) e "Gerar cobrança Pix" na parcela. 1 migration,
  15 testes unitários novos, 72 pgTAP, 15 checks de integração
  (`test:payments-online:integration`), 11 E2E, screenshots em
  1440/1024/768/390/375/430. Sem nota fiscal, split, recorrência de cartão,
  juros/multa, chargeback além do que o provider informar ou credencial real.
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
3. Aprovação formal da Fase 6 recebida em 2026-09-19. Fase 7 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 8

1. Usuário revisou o financeiro (dashboard, lançamentos, pagamentos,
   previsão, aba do paciente, screenshots) e aprovou explicitamente.
2. Pendências que continuam configuráveis: categorias reais de receita/
   despesa (o seed só tem exemplos), política de cobrança da consulta
   avulsa (`APPOINTMENT_CHARGE_POLICY`, hoje `MANUAL`), política de
   parcela em atraso (juros/multa não existem — `PENDENTE DE DEFINIÇÃO`).
3. Aprovação formal da Fase 7 recebida em 2026-09-19. Fase 8 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 9

1. Usuário revisou o cardápio (aba do paciente, editor, versionamento,
   portal, screenshots) e aprovou explicitamente.
2. Pendências que continuam configuráveis/`PENDENTE`: nomes padrão de
   refeição do Enzo (hoje nome livre, sem lista fixa), lista de unidades
   real, se o paciente pode ver versões anteriores (hoje só a atual),
   templates globais (hoje duplicação/plano anterior como base).
3. Aprovação formal da Fase 8 recebida em 2026-09-19. Fase 9 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 10

1. Usuário revisou avaliações/evolução (aba, formulário, comparação,
   gráficos, relatório, portal, screenshots) e aprovou explicitamente.
2. Pendências configuráveis/`PENDENTE`: quais métricas o Enzo usa de fato
   (o catálogo é ampliável por migration), protocolo/dobras cutâneas (não
   modelado), histórico de versões de avaliação (edição administrativa só
   auditada), PDF/CSV de evolução.
3. Aprovação formal da Fase 9 recebida em 2026-09-19. Fase 10 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 11

1. Usuário revisou suplementos, feedbacks e materiais (abas do paciente,
   formulários, biblioteca, atribuições, portal, screenshots) e aprovou
   explicitamente.
2. Pendências configuráveis/`PENDENTE`: limite de tamanho de material
   (hoje 10 MB técnico), tipos além de PDF/JPG/PNG, categorias de material
   (não modeladas), contexto/consulta vinculada ao feedback (não modelado),
   resposta do paciente ao feedback (chat — fora de escopo), imagem de
   suplemento (`image_path` existe, sem upload), fornecedor da IA de foto
   (`FoodAnalysisProvider`) e política de consentimento para fotos de
   refeição.
3. Aprovação formal da Fase 10 recebida em 2026-09-19. Fase 11 concluída em
   2026-09-19.

## Critérios para iniciar a Fase 12

1. Usuário revisou o fluxo de foto da refeição + análise por IA (portal
   mobile, consentimento, revisão/confirmação, histórico, visão do
   nutricionista, screenshots) e aprovou explicitamente.
2. Pendências configuráveis/`PENDENTE`: vendor/modelo real do
   `FoodAnalysisProvider` (e a credencial correspondente, só server-side),
   HEIC/HEIF, política de retenção/exclusão das fotos, quota comercial de
   análises (hoje só proteção técnica contra rajada), meta diária (não
   modelada — nada é comparado), store externo de rate limit para produção.
3. Aprovação formal da Fase 11 recebida em 2026-09-20. Fase 12 concluída em
   2026-09-20.

## Critérios para iniciar a Fase 13

1. Usuário revisou notificações (portal, sino, confirmação por portal e por
   link, histórico e configurações do dashboard, previews de e-mail,
   screenshots) e aprovou explicitamente.
2. Pendências configuráveis/`PENDENTE`: BSP oficial de WhatsApp (adapter
   real + nomes de template aprovados + webhook de status), domínio/
   remetente verificados no Resend (`EMAIL_FROM` real), webhook de status
   do Resend (DELIVERED/bounce), plano da Vercel (Hobby = cron 1×/dia →
   scheduler externo), store externo de rate limit, defaults de canal por
   evento confirmados pelo Enzo, endereço do consultório/plataforma online
   nos e-mails, botões interativos de WhatsApp.
3. Aprovação formal da Fase 12 recebida em 2026-09-23. Fase 13 concluída em
   2026-09-23.

## Critérios para iniciar a Fase 14

1. Usuário revisou pagamentos online (portal, checkout, Pix, confirmação,
   expiração, reconciliação, configurações, screenshots) e aprovou
   explicitamente.
2. Pendências configuráveis/`PENDENTE`: gateway real (Mercado Pago / Asaas /
   Pagar.me / outro) + credenciais de sandbox, cartão de DÉBITO (só se o
   gateway suportar), parcelamento no cartão e eventuais juros (nada
   inventado), política de cobrança automática da consulta avulsa
   (`APPOINTMENT_CHARGE_POLICY` continua `MANUAL`), estorno/refund pelo
   provedor, chargeback, recibo/nota fiscal, cobrança do contrato inteiro
   numa transação só, lembrete de cobrança a vencer.
3. **Aguardando aprovação explícita do usuário** — não iniciar CMS do blog,
   resultados antes/depois nem a tela de configurações da Fase 14 sem sinal
   verde (prompt Fase 13 §143).
