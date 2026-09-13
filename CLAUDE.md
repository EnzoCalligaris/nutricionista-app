# Método EM — Plataforma Enzo Mangili Nutricionista

Este arquivo orienta qualquer sessão futura do Claude Code neste repositório.

## Status do projeto

**FASE 0 (Descoberta e Arquitetura) concluída.** Nenhum código de aplicação foi criado.
Não há `package.json`, não há Next.js instalado, não há banco de dados criado.

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
   registrado (`media_consents`).

## Marca

**Método EM** (iniciais de Enzo Mangili) — metodologia de acompanhamento nutricional
completa (pré-consulta, consulta, pós-consulta, evolução), não uma "dieta".
Identidade visual em `./references`: paleta escura azul-petróleo + preto sobre fundo
off-white, tipografia serifada/script para o nome, monograma "EM". Ver
`docs/DECISIONS.md` para status (confirmar com Enzo antes de finalizar design system).
