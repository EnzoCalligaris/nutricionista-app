# Método EM — Plataforma Enzo Mangili Nutricionista

Este arquivo orienta qualquer sessão futura do Claude Code neste repositório.

## Status do projeto

**FASES 0 a 5 concluídas.** Next.js rodando (`src/app`), design system,
banco Postgres/Supabase local completo (RLS em 100% das tabelas,
anti-double-booking, tipos gerados — `supabase/migrations/`), autenticação e
autorização reais (Fase 3), site público definitivo (Fase 4) e o módulo de
**Pacientes + Planos + Contratos** funcional no dashboard (Fase 5:
`/dashboard/pacientes`, `/dashboard/pacientes/[id]`, contratos com parcelas,
`src/data` + `src/services` + `src/actions`). Agenda, financeiro completo,
cardápios etc. ainda não existem — começam na Fase 6 em diante
(`docs/ROADMAP.md`).

Comandos do dia a dia para o banco local: `npm run db:start` (sobe
Supabase local via Docker), `npm run db:reset` (reaplica migrations +
seed), `npm run test:db` (pgTAP), `npm run test:db:concurrency` (teste real
de concorrência), `npm run db:types` (regenera `src/types/database.ts`).
Integração contra o Supabase local: `npm run test:auth:integration`,
`npm run test:public:integration`, `npm run test:patients:integration`.

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
7. **Pagamento só é confirmado por webhook server-side**, nunca pela resposta do
   frontend.
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
- Referência de script: `scripts/screenshots-fase-5.mjs`
  (`npm run screenshots:fase-5`, com `--extra` para as larguras adicionais).

## Marca

**Método EM** (iniciais de Enzo Mangili) — metodologia de acompanhamento nutricional
completa (pré-consulta, consulta, pós-consulta, evolução), não uma "dieta".
Identidade visual em `./references`: paleta escura azul-petróleo + preto sobre fundo
off-white, tipografia serifada/script para o nome, monograma "EM". Ver
`docs/DECISIONS.md` para status (confirmar com Enzo antes de finalizar design system).
