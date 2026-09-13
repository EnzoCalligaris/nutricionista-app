# Método EM — Plataforma Enzo Mangili Nutricionista

Este arquivo orienta qualquer sessão futura do Claude Code neste repositório.

## Status do projeto

**FASE 0, 1 e 2 concluídas.** Next.js rodando (`src/app`), design system
inicial, e um banco Postgres/Supabase local completo (39 tabelas, RLS em
100% delas, anti-double-booking, tipos gerados) — ver `supabase/migrations/`.
Autenticação real, telas funcionais e dados de produção ainda não existem —
isso começa na Fase 3.

Comandos do dia a dia para o banco local: `npm run db:start` (sobe
Supabase local via Docker), `npm run db:reset` (reaplica migrations +
seed), `npm run test:db` (pgTAP), `npm run test:db:concurrency` (teste real
de concorrência), `npm run db:types` (regenera `src/types/database.ts`).

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

## Marca

**Método EM** (iniciais de Enzo Mangili) — metodologia de acompanhamento nutricional
completa (pré-consulta, consulta, pós-consulta, evolução), não uma "dieta".
Identidade visual em `./references`: paleta escura azul-petróleo + preto sobre fundo
off-white, tipografia serifada/script para o nome, monograma "EM". Ver
`docs/DECISIONS.md` para status (confirmar com Enzo antes de finalizar design system).
