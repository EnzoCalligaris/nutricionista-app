# Método EM — Plataforma Enzo Mangili Nutricionista

Este arquivo orienta qualquer sessão futura do Claude Code neste repositório.

## Status do projeto

**FASES 0 a 13 concluídas.** Next.js rodando (`src/app`), design system,
banco Postgres/Supabase local completo (RLS em 100% das tabelas,
anti-double-booking, tipos gerados — `supabase/migrations/`), autenticação e
autorização reais (Fase 3), site público definitivo (Fase 4), o módulo de
**Pacientes + Planos + Contratos** (Fase 5), a **Agenda + agendamento do
paciente** (Fase 6: `/dashboard/agenda`, disponibilidade/bloqueios/
configuração, `/paciente/consultas`, `/paciente/agendar`; slots por domínio
puro + validação no banco, fuso da configuração) e o **Financeiro completo
sem gateway** (Fase 7: `/dashboard/financeiro` + novo/editar/pagamentos/
previsão, home do dashboard com cards e gráficos reais, aba Financeiro do
paciente; pagamento manual atômico e idempotente via `record_manual_payment`,
estorno com histórico, lançamentos nunca apagados) e os **Cardápios /
plano alimentar** (Fase 8: aba Cardápio do paciente, editor por versão em
`/dashboard/pacientes/[id]/cardapio/[versionId]`, `/dashboard/cardapios`,
portal `/paciente/cardapio`; versionamento DRAFT → PUBLISHED → ARCHIVED com
publicação atômica e histórico imutável por trigger — conteúdo só muda em
rascunho; paciente só vê a versão publicada; sem cálculo nutricional) e as
**Avaliações físicas + bioimpedância + evolução** (Fase 9: aba Avaliações
do paciente, `/dashboard/pacientes/[id]/avaliacoes/*`, `/dashboard/avaliacoes`,
portal `/paciente/evolucao`; catálogo flexível de métricas — nenhuma
obrigatória, ranges técnicos e nunca clínicos, IMC só derivado; visibilidade
por avaliação — paciente só vê liberada e não arquivada; relatório no bucket
privado `bioimpedance-reports` entregue por URL assinada server-side; sem
OCR/IA/diagnóstico) e os **Suplementos + feedbacks + materiais** (Fase
10: abas Suplementos/Feedbacks/Materiais do paciente,
`/dashboard/materiais`, portal `/paciente/{suplementos,feedbacks,
materiais}`; suplemento ATIVA/ENCERRADA/ARQUIVADA derivado de
`active`+`archived_at`, feedback rascunho → disponibilizado (definitivo) →
arquivado — não é chat —, material reutilizável arquivo-OU-link no bucket
privado `patient-documents` (`<material_id>/<uuid>.<ext>`) com atribuição
por paciente revogável; paciente só vê ativo/disponibilizado/atribuído;
link externo só via `validateExternalUrl` + `ExternalLink`; download por
URL assinada server-side) e a **Foto da refeição + análise por IA** (Fase
11: portal `/paciente/refeicoes` (+ `/nova`, `/consentimento`,
`/[analysisId]`), aba Refeições do paciente no dashboard;
`FoodAnalysisProvider` em `src/services/food-analysis/` com provider
`fake` determinístico por padrão — vendor/modelo real `PENDENTE DE
DEFINIÇÃO`, nunca inventar credencial; resposta da IA validada por Zod e
tratada como entrada não confiável; original da IA imutável x versão
confirmada pelo paciente; consentimento versionado `meal_photo_ai_v1` em
`patient_consents`; foto processada (WebP sem EXIF) no bucket privado
`meal-photos`; sempre "estimativa", nunca nota/score/meta) e as
**Notificações + e-mail + WhatsApp + lembretes** (Fase 12: outbox
transacional por trigger em `notification_events` → entregas idempotentes
em `notification_deliveries` → `notifications` in-app; worker em
`src/services/notifications/` com claim `SKIP LOCKED`, retry/backoff,
`EmailProvider` `fake`/`resend` e `WhatsAppProvider` `fake` (BSP oficial
`PENDENTE`; nunca automação de WhatsApp Web); lembrete 5 dias civis em
America/Sao_Paulo agendado no banco; confirmação de presença pelo portal
e por link tokenizado `/confirmar/[token]`; job `/api/cron/notifications`
com `CRON_SECRET`; portal `/paciente/notificacoes` + sino; dashboard
`/dashboard/notificacoes` e `/dashboard/configuracoes/notificacoes`;
provider real sem credencial = erro de configuração, nunca fallback
silencioso; segredos só server-side) e os **Pagamentos online**
(Fase 13: `payment_charges` (cobrança ≠ pagamento — cobrança pendente NÃO é
receita) → webhook assinado → `record_online_payment` confirma
`payments` + parcela + lançamento + evento numa transação; a baixa é uma
única função (`apply_payment_effects`), usada também pelo pagamento manual
da Fase 7; valor SEMPRE derivado do saldo da parcela no servidor; uma
cobrança ativa por parcela; divergências viram
`payment_reconciliation_items` (nunca corrigidas em silêncio);
`PaymentProvider` com `FakePaymentProvider` (Pix/cartão SIMULADOS, sem rede
e sem jamais pedir número de cartão/CVV) — gateway real `PENDENTE DE
DEFINIÇÃO` e identificador sem adapter é erro de configuração; portal
`/paciente/pagamentos` + checkout, dashboard com cobranças, reconciliação e
`/dashboard/configuracoes/pagamentos`; job `/api/cron/payments`). CMS do
blog, resultados antes/depois e configurações do profissional ainda não
existem — começam na Fase 14 (`docs/ROADMAP.md`). Regras comerciais da agenda (horários reais,
duração, antecedências, plataforma online), categorias financeiras reais e
a política de cobrança da consulta avulsa (`APPOINTMENT_CHARGE_POLICY`) são
configuráveis e continuam `PENDENTE DE DEFINIÇÃO` — nunca hardcodar um
valor real. Consulta nunca gera receita automática; dinheiro é sempre
inteiro em centavos.

Comandos do dia a dia para o banco local: `npm run db:start` (sobe
Supabase local via Docker), `npm run db:reset` (reaplica migrations +
seed), `npm run test:db` (pgTAP), `npm run test:db:concurrency` (teste real
de concorrência), `npm run db:types` (regenera `src/types/database.ts`).
Integração contra o Supabase local: `npm run test:auth:integration`,
`npm run test:public:integration`, `npm run test:patients:integration`,
`npm run test:scheduling:integration`, `npm run test:scheduling:concurrency`,
`npm run test:financial:integration`, `npm run test:meal-plans:integration`,
`npm run test:assessments:integration`,
`npm run test:patient-content:integration`,
`npm run test:food-analysis:integration`,
`npm run test:notifications:integration` e
`npm run test:payments-online:integration` (vitest em Node — rodam worker e
gateway reais com providers fake). Preview local dos e-mails:
`npm run emails:preview`.

Antes de escrever qualquer código, releia:
- `docs/PROJECT_SPEC.md` — o que construir (produto, planos, regras de negócio)
- `docs/ARCHITECTURE.md` — como estruturar o código
- `docs/DATABASE.md` — modelo de dados proposto
- `docs/ROADMAP.md` — ordem das fases
- `docs/DECISIONS.md` — decisões já tomadas, pendências, e regras que o prompt do
  usuário sobrepôs ao material em `./references`
- `docs/SECURITY.md` — segurança, LGPD, RLS

**Não avance de fase sem autorização explícita do usuário.** Ao final de cada fase,
pare e aguarde confirmação antes de iniciar a próxima.

## Regras inegociáveis

1. **Nunca invente** formação, CRN, telefone, endereço, preços, depoimentos ou
   resultados. Quando a informação não existir em `./references` nem neste prompt,
   registre como `PENDENTE DE DEFINIÇÃO` — não preencha com suposições.
2. **Este prompt tem prioridade sobre o PDF** quando houver conflito explícito
   (ex.: consulta avulsa R$230, sem grupo exclusivo, trimestral = 3 presenciais + 2
   online, semestral = 6 presenciais + 5 online, plano anual não é vendido publicamente).
   Veja `docs/DECISIONS.md` para a lista completa.
3. **Service role key do Supabase nunca chega ao browser.** Uso exclusivo server-side.
4. **RLS obrigatória** em toda tabela com dado clínico/financeiro/pessoal. Nunca
   `USING (true)` em tabela sensível.
5. **Fuso horário America/Sao_Paulo** sempre — nunca depender do timezone da máquina.
6. **Double booking é proibido** — a prevenção de conflito de agenda deve existir no
   banco (constraint/transação), não só no frontend.
7. **Pagamento só é confirmado por webhook server-side** (assinatura conferida
   sobre o corpo bruto) ou por consulta server-side ao provider, nunca pela
   resposta do frontend. O valor cobrado é sempre derivado do banco, nunca do
   cliente; divergência de valor/moeda não quita nada — vira reconciliação.
   A aplicação nunca recebe, guarda ou loga número de cartão, CVV ou senha.
8. **Análise de foto de refeição pela IA é sempre estimativa** ("aproximadamente",
   faixa de calorias) — nunca apresentar como valor exato. A IA nunca prescreve
   (não altera dieta, meta, suplementação ou tratamento).
9. Fotos de refeições e de pacientes ficam em storage privado, nunca em bucket
   público. Resultados antes/depois só publicam com consentimento de imagem
   registrado (`media_consents`) — o bucket `before-after` é privado mesmo
   para resultados publicados; entrega ao público é server-side (Fase 14).
10. **Dado real de produto (planos, preços, catálogo de métricas) entra por
    migration; dado fictício de desenvolvimento entra só por
    `supabase/seed.sql`** — nunca misturar os dois (`docs/DECISIONS.md`).
11. Nova policy de RLS que precisa checar outra tabela com RLS própria: use
    (ou crie) uma função `SECURITY DEFINER` com `search_path = ''` em vez de
    um `EXISTS` direto — um `EXISTS` comum herda a RLS da tabela referenciada
    e pode falhar silenciosamente para `anon`/outro papel (aconteceu com
    `before_after_results` na Fase 2; ver `docs/DECISIONS.md`).

## QA visual obrigatório com screenshots reais (regra permanente)

Toda fase futura que alterar interface deve gerar screenshots REAIS da
aplicação rodando no navegador (Playwright, nunca mock/imagem fictícia) em:

```
./screenshots/fase-X/
  desktop/   (1440px)
  tablet/    (768px)
  mobile/    (390px)
```

- Para cada tela relevante criada/alterada: viewport (sem scroll) e
  full-page — ex.: `pacientes-1440-viewport.png`, `pacientes-1440-full.png`.
- Quando houver risco específico de responsividade, validar também 375, 430,
  1024 e 1280 px.
- Depois de gerar, **analisar visualmente cada imagem** (espaçamento,
  alinhamento, overflow/scroll horizontal, tabelas, textos cortados, ações
  acessíveis, empty/loading states, modais, mobile) — se houver problema:
  corrigir, gerar de novo, comparar, e só então considerar a interface
  concluída.
- `screenshots/` está no `.gitignore` (uso exclusivo de QA local) — nunca
  commitar. Screenshots complementam, não substituem, lint/typecheck/testes/
  E2E/build.
- Referência de script: `scripts/screenshots-fase-5.mjs` a
  `scripts/screenshots-fase-13.mjs` (`npm run screenshots:fase-N`, com
  `--extra` para as larguras adicionais). Em Playwright, `getByText` é
  substring case-insensitive e `count()` não espera: prefira
  `exact: true`/`waitFor` (Fase 9, `docs/DECISIONS.md`). Tabelas do
  dashboard: com a sidebar aberta, 768 px sobra ~490 px de conteúdo —
  tabela só a partir de `lg`, cards abaixo (Fase 10). `CardTitle` é `div`,
  não `heading`; `FlashToast` limpa `?toast=` da URL logo após mostrar —
  assertar o toast, não a URL (Fase 12).
- Validação final sempre em sequência e contra o build:
  `npm run db:reset` → `npm run build` →
  `E2E_SKIP_BUILD=1 npx playwright test --workers=1` (nunca reutiliza um
  servidor em `:3000`; `E2E_DEV_SERVER=1` é só para iterar um spec local).
- Views do Postgres não expõem FK para o PostgREST: não use embed
  (`view!inner(tabela(...))`) a partir de uma view — leia e una no
  `src/data` (Fase 7, `docs/DECISIONS.md`).

## Marca

**Método EM** (iniciais de Enzo Mangili) — metodologia de acompanhamento nutricional
completa (pré-consulta, consulta, pós-consulta, evolução), não uma "dieta".
Identidade visual em `./references`: paleta escura azul-petróleo + preto sobre fundo
off-white, tipografia serifada/script para o nome, monograma "EM". Ver
`docs/DECISIONS.md` para status (confirmar com Enzo antes de finalizar design system).
