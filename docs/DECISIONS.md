# DECISIONS — Conflitos, sobreposições e pendências

Fonte de verdade sobre o que já foi decidido, o que o prompt do usuário
sobrepôs explicitamente ao material em `./references`, e o que continua em
aberto. Consultar antes de tomar qualquer decisão de produto em fases futuras.

## Prioridade: prompt > PDF, quando explícito

O PDF (`Meu acompanhamento apresentação.pdf`) descreve a oferta comercial
**antiga** de Enzo (nomeada "Consultoria PREMIUM/SEMESTRAL/TRIMESTRAL de
acompanhamento", com um único pacote de 12 meses, 6 meses e 3 meses, todos com
o mesmo conjunto de benefícios). O prompt do usuário redesenha essa oferta.
Onde os dois conflitam **explicitamente**, o prompt vale:

| Item | PDF (antigo) | Prompt (vigente) |
|---|---|---|
| Consulta avulsa | "Consulta com nutricionista — R$ 350,00" | **R$ 230**, sem consulta online adicional, sem feedback |
| Trimestral — consultas | "3 consultas com o nutricionista" (sem split) | **3 presenciais + 2 online** |
| Semestral — consultas | "6 consultas com o nutricionista" (sem split) | **6 presenciais + 5 online** |
| Plano anual (12 meses) | Vendido publicamente como "Consultoria PREMIUM", com bônus de indicação/cashback e garantia de 12 meses | **Não vender publicamente.** Existe no sistema para histórico/clientes antigos/reativação futura/previsão financeira (`active`, `publicly_visible`, `available_for_sale` independentes) |
| Grupo exclusivo com a equipe | Listado como pilar 5 e como benefício de todos os planos | **Removido.** Não oferecer em lugar nenhum do produto novo |

Esses itens **não são inconsistência a resolver** — são substituições
deliberadas do usuário e já estão aplicadas em `PROJECT_SPEC.md`.

## Inconsistências encontradas (dentro do próprio material, não resolvidas pelo prompt)

1. **Periodicidade do semestral incompatível.** O PDF menciona em outro ponto do
   funil "consulta presencial a cada 2 meses", mas o plano semestral tem 6
   consultas presenciais em 6 meses (ou seja, mensal, não bimestral). O prompt
   é explícito: não transformar a frequência "a cada 2 meses" em regra fixa.
   **Decisão:** duração 6 meses + 6 presenciais + 5 online são dados
   confirmados; a periodicidade exata (mensal vs. outro intervalo) fica
   **configurável** por contrato/paciente, não hardcoded. `PENDENTE DE
   DEFINIÇÃO` apenas o valor default sugerido de periodicidade.

2. **Preço ambíguo nos planos trimestral e semestral.** O PDF apresenta cada
   plano com três números simultâneos: valor "de" (cheio), valor parcelado
   ("por apenas Nx R$Y") e valor "à vista". Exemplo trimestral: de R$1.050,00 /
   3x R$226,79 (= R$680,37 parcelado) / R$600,00 à vista. Semestral: de
   R$2.100,00 / 6x R$214,60 (= R$1.287,60 parcelado) / R$1.080,00 à vista. O
   prompt manda "extrair exatamente do PDF", mas não diz qual dos três números
   é o preço de tabela atual — isso é uma promoção/estrutura comercial, não um
   preço único. **Decisão:** o modelo de dados (`plan_prices`) suporta múltiplas
   representações de preço por plano (à vista, parcelado, valor cheio) em vez
   de forçar um único número. `PENDENTE DE DEFINIÇÃO`: qual composição exibir
   como preço "principal" no site — perguntar a Enzo antes da Fase 4.

3. **"Consulta com nutricionista — R$ 350,00" isolada no PDF** não fica claro se
   era o preço da consulta avulsa antiga, o preço de uma consulta adicional
   dentro de um plano, ou outra coisa. Como o prompt já fixa avulsa = R$230,
   esse número do PDF fica só como referência histórica, sem efeito na oferta
   nova.

## Informações ausentes — não inventadas, marcadas como pendentes

Nem o PDF nem as imagens em `./references` contêm:
- **CRN** (registro no Conselho Regional de Nutricionistas).
- **Telefone** de contato.
- **Endereço/localização** do consultório (as fotos mostram um ambiente
  interno neutro, sem identificação de endereço).
- **E-mail profissional** de contato público (distinto do e-mail do usuário
  operando esta sessão).
- **Redes sociais** (Instagram, etc.) — não citadas no material.
- **Depoimentos nomeados/fotos de antes-depois com consentimento** — o PDF cita
  3 slides "Essas são algumas das vidas transformadas" (com fotos de pacientes),
  mas sem nome, sem texto de depoimento extraído e, mais importante, **sem
  registro de consentimento de imagem visível**. Essas fotos não devem ser
  reaproveitadas no novo site sem (a) confirmar que são as pessoas certas, e
  (b) obter consentimento documentado — ver `media_consents` em `DATABASE.md`.
- **Formato da consulta online** — plataforma usada (Google Meet, WhatsApp
  vídeo, outra) não está definida.
- **Como funciona "Comunidade VIP"** hoje (se por WhatsApp, se continua
  existindo na oferta nova) — o prompt só manda remover "grupo exclusivo", não
  fala de "comunidade VIP" explicitamente. `PENDENTE DE DEFINIÇÃO`.

Todos os itens acima devem permanecer como `PENDENTE DE DEFINIÇÃO` no conteúdo
do site até Enzo fornecer a informação real. Nenhum deve ser preenchido com
dado plausível/inventado.

## Decisões que precisam ser configuráveis (não hardcoded)

- Periodicidade de consultas presenciais dentro de um plano multi-mês.
- Preço de cada plano, incluindo suporte a múltiplas formas de exibição (à
  vista/parcelado).
- Lista de benefícios por plano (tabela `plan_benefits`, não texto fixo na UI).
- Nomes das refeições do dia no cardápio (não travar em 6 nomes fixos).
- Métricas de bioimpedância exibidas (nem todo profissional usa todas).
- Textos de pilares do site (ligados à identidade do Método EM, sujeitos a
  revisão editorial por Enzo sem precisar de deploy).
- Flags `active` / `publicly_visible` / `available_for_sale` do plano anual.

## Identidade visual (achados em `./references`, a confirmar com Enzo)

- Logo "Enzo Mangili — Nutricionista" com monograma "EM" estilizado (traço
  script para o "E" minúsculo decorativo + serifada para "M"/"E" maiúsculos),
  em duas composições: vertical (monograma sobre nome) e horizontal (monograma
  + nome lado a lado). Variante em badge circular azul-petróleo com o texto
  "ENZO MANGILI · NUTRICIONISTA" em arco.
- Paleta observada: azul-petróleo escuro (aprox. `#2F5566`–`#33586A`), preto,
  fundo off-white/cinza muito claro. Sem gradientes, sem verde.
- Fotografia de referência: retratos de estúdio (fundo claro neutro, polo
  bordô, instrumentos de avaliação — plicômetro/adipômetro, fita métrica) —
  tom "clínico porém humano", alinhado ao pedido de design "clean, premium,
  minimalista, humano".
- **Decisão:** usar esses ativos como ponto de partida do design system (Fase
  4), mas confirmar com Enzo se o logo/paleta atual é definitivo para o novo
  site ou se haverá redesenho de marca antes do lançamento.
  `PENDENTE DE DEFINIÇÃO`.

## Riscos técnicos identificados

- **Concorrência de agenda**: sem constraint de banco corretamente desenhada
  (`EXCLUDE USING gist`), qualquer solução "check antes de inserir" no
  aplicativo tem race condition. Mitigação já especificada em
  `DATABASE.md`/`SECURITY.md`.
- **Dupla contabilização financeira**: se o vínculo `appointment → payment →
  financial_transaction` não for desenhado com unicidade
  (`origin_payment_id unique`), lançamentos duplicados são fáceis de introduzir
  em iterações futuras do dashboard.
- **WhatsApp não-oficial**: tentação comum de usar automação via WhatsApp Web
  para reduzir custo — proibido pelo prompt e arriscado (ban de número,
  instabilidade). Precisa orçar BSP oficial antes da Fase 12.
- **IA de foto de refeição gerando falsa precisão**: risco de UX apresentar
  número exato "por engano" se o prompt de resultado não for desenhado com
  cuidado (faixas, não pontual) — tratar como requisito de produto, não só de
  IA, e testar a cópia exibida.
- **LGPD em dado de saúde**: bioimpedância/evolução/cardápio são dados
  sensíveis; arquitetura de storage privado + RLS reduz risco técnico, mas
  consentimento e política de retenção são decisões de negócio/jurídicas ainda
  pendentes — não bloqueiam Fase 1–2, mas bloqueiam ir a produção (Fase 16).
- **Tamanho do PDF de referência** (~28MB, majoritariamente imagens) sugere que
  o material de anamnese/checklist citado no texto ("formulário interativo
  quinzenal") pode ter mais detalhe visual não capturado por extração de texto
  — se necessário, revisitar as imagens do PDF manualmente antes da Fase 4/10.

## Decisões técnicas da Fase 1 (Fundação do projeto)

1. **`/dashboard` e `/paciente` são segmentos de rota reais, não route groups
   puros.** O desenho original da Fase 0 (`(dashboard)/`, `(patient)/paciente/`)
   causaria colisão de URL: `(dashboard)/blog` e `(public)/blog` resolveriam
   ambos para `/blog` (route groups não aparecem na URL). Corrigido para
   `app/dashboard/*` e `app/paciente/*` como pastas reais. `docs/ARCHITECTURE.md`
   já atualizado. Efeito colateral positivo: o middleware de autorização da
   Fase 3 fica mais simples (`pathname.startsWith("/dashboard")` em vez de
   depender de qual route group cada página pertence).

2. **Tipografia**: Fraunces (heading/display) + Manrope (body) via `next/font`,
   mais Geist Mono (dados tabulares/financeiros). Escolhida por combinar com o
   logo serifado/script observado em `./references` sem tentar imitá-lo, e por
   ter bom suporte a acentuação do português (subsets `latin` + `latin-ext`).

3. **Paleta de cores**: tokens OKLCH derivados do azul-petróleo do logo
   (`#2F5566` → `oklch(0.429 0.052 228.7)` como `--primary`), fundo off-white
   (`#FAFAF8`), mais `--success`/`--warning` adicionados ao conjunto padrão do
   shadcn (que só tem `destructive`). Valores exatos em
   `src/app/globals.css`. **Ainda PENDENTE DE DEFINIÇÃO visual com Enzo** —
   ver seção "Identidade visual" acima; isto é um ponto de partida, não a
   palavra final.

4. **Logo**: usamos o arquivo real (`references/WhatsApp Image ... 16.47.31
   (2).jpeg`, cópia em `public/brand/logo-horizontal.jpg`) no cabeçalho do
   site — não redesenhamos a marca. É um JPEG com bastante espaço em branco ao
   redor do logotipo real, então em tamanhos pequenos perde nitidez. Pendente:
   pedir a Enzo um arquivo vetorial (SVG) ou PNG com fundo transparente e
   recorte justo, antes da Fase 4.

5. **Shell do dashboard/portal do paciente reaproveita o mesmo componente
   `Sidebar` do shadcn/ui** (drawer mobile via `Sheet` embutido) para os dois,
   em vez de dois padrões de navegação diferentes — reduz código e já cobre
   o requisito de "drawer no mobile" (seção 15) sem componente customizado.

6. **`src/hooks/use-mobile.ts` (gerado pelo shadcn CLI) foi reescrito** com
   `useSyncExternalStore` em vez de `useEffect` + `setState` síncrono, porque
   a versão gerada falhava no lint (`react-hooks/set-state-in-effect`) — a
   correção também é uma implementação mais idiomática para assinar estado de
   `matchMedia`, não só uma supressão de regra.

7. **Versões fixadas por conflito de peer dependencies**: `@vitejs/plugin-react`
   preso em `5.2.0` (a partir da v6 depende de `@rolldown/plugin-babel`, que
   exige `@babel/core@^8`, conflitando com `@babel/core@^7` usado por
   `shadcn`). `@types/node` subiu para `^26` (era `^20` no template padrão do
   `create-next-app`) porque o Vitest 5 exige `@types/node@^22 || >=24` — e de
   toda forma `^26` é o que corresponde à versão de Node instalada (v26).

8. **`app/(public)/page.tsx` (Home) é deliberadamente provisória** — valida
   design system (tipografia, cores, cards, responsividade) com os 3 pilares
   reais do PDF (Consultas, Planejamento nutricional, Acompanhamento de perto),
   sem preços, depoimentos ou CTAs reais. O site institucional completo é
   Fase 4.

9. **`./references` foi removido do controle de versão** (correção de higiene
   pós-Fase 1, 2026-09-13). O commit inicial da Fase 1 versionou o material
   bruto (PDF de ~28MB + fotos) — esses arquivos servem só como referência
   local de conteúdo para extrair informação, não como asset da aplicação.
   `references/` foi adicionado ao `.gitignore` e removido do índice com
   `git rm -r --cached` (arquivos locais preservados). **Atenção**: como o
   commit inicial já havia sido enviado a um remoto real
   (`github.com/EnzoCalligaris/nutricionista-app`, confirmado via
   `git ls-remote`), esses arquivos continuam presentes no histórico do Git
   local e do remoto — `git rm --cached` só impede que continuem rastreados
   dali em diante, não os apaga de commits passados. Removê-los do histórico
   exigiria reescrever o histórico (`git filter-repo`/BFG) e um force-push,
   uma operação destrutiva sobre histórico compartilhado que não foi
   solicitada e não deve ser feita sem decisão explícita do usuário.
   `public/brand/logo-horizontal.jpg` (asset derivado, usado pela aplicação)
   permanece versionado normalmente — a exclusão é só do material bruto em
   `./references`.
