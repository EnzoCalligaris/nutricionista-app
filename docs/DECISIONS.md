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

## Decisões técnicas da Fase 2 (Banco de dados + Supabase + RLS)

1. **Avaliações usam catálogo flexível, não colunas fixas.** Substitui o
   desenho `bioimpedance_assessments`/`body_measurements` da Fase 0 por
   `measurement_types` (catálogo) + `assessments` + `assessment_measurements`
   (valor por métrica). Decisão explícita do prompt da Fase 2 — nenhum campo
   obrigatório por paciente, nova métrica não pede migration.

2. **Catálogo real de planos entra por migration, não por `seed.sql`.**
   `plans`/`plan_prices`/`plan_benefits` (Avulsa/Trimestral/Semestral/Anual,
   com os valores reais de `docs/PROJECT_SPEC.md §3`) são dado de produto,
   não dado fictício de teste — devem existir em todo ambiente (dev, staging,
   produção). `supabase/seed.sql` fica reservado só para dado inventado de
   desenvolvimento (pacientes, contratos, consultas fictícios). Preço
   "principal" do Trimestral/Semestral continua com `is_primary = false` nas
   3 representações (cheio/parcelado/à vista) — ainda PENDENTE DE DEFINIÇÃO.

3. **Campo `modality` em vez de `type` em `appointments`.** O prompt sugeriu
   `type`; mantido `modality` (já usado na Fase 0) para não confundir com um
   futuro "tipo de consulta" clínico. Mesmos valores (`IN_PERSON`/`ONLINE`).

4. **`/dashboard`/`/paciente` como segmentos de rota reais** — decisão já
   registrada na Fase 1, sem mudança nesta fase.

5. **RLS usa funções `SECURITY DEFINER` auxiliares** em vez de repetir
   subqueries em cada policy (`current_profile_role`, `is_nutritionist_of_patient`,
   `is_patient_self`, `has_valid_media_consent`). Todas com `search_path = ''`
   e `EXECUTE` restrito. Corrigido em desenvolvimento: a policy pública de
   `before_after_results` inicialmente fazia `EXISTS` direto em
   `media_consents`, mas essa tabela tem sua própria RLS que bloqueia `anon`
   — o `EXISTS` sempre falhava para visitante anônimo mesmo com consentimento
   válido. Corrigido com `has_valid_media_consent()` (`SECURITY DEFINER`).
   Pego pelo próprio teste `050_public_visibility.test.sql` antes de avançar.

6. **`before-after` é um bucket privado mesmo para resultados publicados.**
   Entrega ao visitante público via signed URL gerada server-side (Fase 14),
   não via política de storage aberta a `anon` — reduz superfície de risco
   dado o requisito de consentimento revogável.

7. **Seed local insere em `auth.users` diretamente** (nutricionista + 2
   pacientes fictícios, senha de dev fixa e documentada) para validar o
   vínculo `profiles.id references auth.users(id)` de ponta a ponta sem
   esperar a Fase 3. Restrito ao ambiente local; nunca replicado em produção.
   Os outros 3 pacientes fictícios do seed não têm `auth.users`/login — cobre
   o cenário real de "paciente cadastrado manualmente, sem conta ainda".

8. **Testes de banco em duas camadas**: pgTAP
   (`supabase/tests/database/*.sql`, via `npm run test:db`) para constraints/
   RLS dentro de uma transação, e um script Node à parte
   (`scripts/db-concurrency-test.mjs`, `npm run test:db:concurrency`) para o
   teste de concorrência real entre duas conexões — pgTAP roda tudo numa
   única transação/conexão, o que não prova proteção contra uma corrida de
   verdade entre duas conexões simultâneas.

9. **Portas do Supabase local deslocadas para 5542x.** Duas causas: (a) outro
   projeto Supabase local ("personal-app") já ocupa a faixa padrão
   54321-54329 nesta máquina; (b) o Windows reserva 54328-54427 como
   *excluded port range* (`netsh interface ipv4 show excludedportrange
   protocol=tcp`), então mesmo sem o outro projeto a faixa padrão falharia
   aqui. `supabase/config.toml` documenta isso inline.

10. **`ADMIN` continua só no enum, sem uso ativo.** Nenhuma policy trata
    `ADMIN` como super-role e nenhum usuário `ADMIN` é criado — mantém a
    opção aberta (docs da Fase 0/1) sem introduzir uma permissão global
    insegura antes de haver necessidade real.

## Decisões técnicas da Fase 3 (Autenticação e autorização)

1. **`src/proxy.ts`, não `middleware.ts`.** A partir do Next.js 16 (instalado:
   16.3.5), a convenção `middleware.ts` está **depreciada** em favor de
   `proxy.ts` — confirmado direto no pacote instalado
   (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`:
   *"The `middleware` file convention is deprecated and has been renamed to
   `proxy`"*, desde a v16.0.0, com codemod oficial
   `npx @next/codemod@canary middleware-to-proxy`). Usamos a convenção nova
   diretamente: `export function proxy(request)` em vez de `middleware`,
   `export const config = { matcher: [...] }` restrito a
   `/dashboard`/`/paciente` (proxy roda em toda requisição sem matcher,
   inclusive assets estáticos). Proxy usa o runtime Node.js por padrão
   (mudança da v16, antes era Edge) — compatível com `@supabase/ssr` sem
   ressalvas.

2. **Proteção em camadas de verdade, não só no proxy.** O próprio texto
   embutido nos docs do Next.js alerta: *"A matcher change or a refactor
   that moves a Server Function to a different route can silently remove
   Proxy coverage [...] Always verify authentication and authorization
   inside each Server Function rather than relying on Proxy alone."* Por
   isso `src/app/dashboard/layout.tsx` e `src/app/paciente/layout.tsx`
   chamam `requireNutritionist()`/`requirePatient()`
   (`src/lib/auth/session.ts`) independentemente do proxy, e a RLS
   (Fase 2) é a camada final que vale mesmo se as duas anteriores
   falharem.

3. **Role default é sempre `PATIENT`, nunca lida de metadata do client.**
   Trigger `handle_new_auth_user` (`AFTER INSERT ON auth.users`, SECURITY
   DEFINER, `search_path = ''` — mesmo padrão das funções auxiliares de RLS
   da Fase 2) cria o profile automaticamente; só `full_name` vem de
   `raw_user_meta_data`, nunca `role` (testado explicitamente em
   `supabase/tests/database/060_auth_provisioning.test.sql`, caso "role em
   raw_user_meta_data é ignorada"). Promover alguém a `NUTRITIONIST` é
   sempre uma ação administrativa separada via `service_role`
   (`scripts/bootstrap-nutritionist.mjs`, documentado abaixo). A policy
   `profiles_insert_self` (Fase 2) foi apertada para só aceitar
   auto-inserção com `role = 'PATIENT'` — defesa em profundidade somada ao
   trigger `prevent_role_change` (Fase 2, já bloqueava `UPDATE` de role por
   quem não é `service_role`).

4. **Sem cadastro público de nutricionista** (prompt Fase 3 §21). Bootstrap
   é administrativo: `scripts/bootstrap-nutritionist.mjs`, rodado
   manualmente por quem tem a `SUPABASE_SERVICE_ROLE_KEY` (nunca por uma
   rota HTTP pública) — convida por e-mail pelo mesmo fluxo seguro usado
   para pacientes e depois promove o profile a `NUTRITIONIST` via
   service role. Documentado no próprio script, único processo hoje.

5. **Onboarding de paciente é núcleo mínimo, não gestão de pacientes.**
   `src/actions/onboarding.ts` (`invitePatientAction`) +
   `src/app/dashboard/pacientes/convidar/page.tsx` — convida por e-mail via
   `admin.inviteUserByEmail`, nunca por definição manual de senha pelo
   nutricionista (prompt Fase 3 §23). Trata duplicidade: e-mail já com
   paciente vinculado → erro; paciente cadastrado manualmente sem login
   ainda (linha em `patients` com `profile_id null`) → vincula em vez de
   duplicar. Compensação (prompt Fase 3 §26): se o Auth user foi criado
   nesta chamada mas o insert/update em `patients` falhar, o Auth user é
   removido (`admin.auth.admin.deleteUser`) para não deixar conta órfã sem
   paciente vinculado — onboarding cruza Auth + Database sem uma transação
   única cobrindo os dois. Tela completa de gestão de pacientes continua
   Fase 5.

6. **Sem React Hook Form nesta fase.** Formulários (login, esqueci-senha,
   redefinir-senha, convite) usam Server Actions + `useActionState` (React
   19) com `<form action={...}>` nativo — dois campos por formulário no
   máximo, validação de autoridade sempre no server (Zod em
   `src/validators/auth.ts`), RHF não agregaria valor aqui
   (`docs/ARCHITECTURE.md`: "nenhuma dependência adicional [...] porque é
   popular"). RHF fica para formulários mais complexos de fases futuras
   (cardápio, avaliação) se/quando justificar.

7. **Rate limiting em memória do processo, documentado como limitação**
   (prompt Fase 3 §27). `src/lib/auth/rate-limiter.ts` (lógica pura,
   testável) + `src/lib/auth/rate-limit.ts` (instâncias configuradas por
   fluxo — login 10/5min, esqueci-senha 5/15min, convite 20/hora — e
   `getClientIp()`, este sim `server-only`). Correto para dev local e um
   servidor Node único; **não confiável sozinho em produção na Vercel**
   (funções serverless não compartilham memória entre instâncias). Iface
   `RateLimiter` permite trocar por um store externo (ex.: Upstash Redis)
   sem mudar quem chama — não integramos fornecedor pago agora (`PENDENTE
   DE DEFINIÇÃO` para antes da Fase 16/produção).

8. **CSRF coberto pela proteção nativa de Server Actions do Next.js, sem
   biblioteca adicional** (prompt Fase 3 §32). Toda mutação desta fase
   (login, logout, esqueci-senha, redefinir-senha, convite) é uma Server
   Action, e o Next.js já compara `Origin` com `Host`/`X-Forwarded-Host` e
   rejeita divergência — confirmado no texto oficial embutido no pacote
   instalado (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`:
   *"CSRF check. The request's Origin is compared to the Host [...]
   Mismatches are rejected"*). A única Route Handler de mutação potencial
   (`/auth/callback`) é `GET`, idempotente (troca um código de uso único
   por sessão), não uma mutação de estado de negócio. Não instalamos
   biblioteca de CSRF token só para "marcar checkbox" — decisão explícita
   do prompt.

9. **`redirectTo` de convite/esqueci-senha aponta direto para
   `/redefinir-senha`, não para `/auth/callback`.** Descoberta testando o
   fluxo real: `inviteUserByEmail`/`resetPasswordForEmail` são chamados do
   SERVIDOR (Admin API / server action), não de um browser com PKCE já
   iniciado — o GoTrue local devolve `access_token`/`refresh_token` no
   **fragmento** da URL (`#...`), nunca um `?code=`. Fragmento nunca chega
   ao servidor (o browser não o envia em nenhuma requisição HTTP), então
   `src/app/auth/callback/route.ts` (Route Handler, server-only) é
   estruturalmente incapaz de processá-lo. `src/components/auth/
   reset-password-gate.tsx` (Client Component) é quem lê
   `window.location.hash` e chama `setSession()` no browser, que persiste
   a sessão em cookies via `@supabase/ssr` (os mesmos que o server action
   de reset volta a ler). `/auth/callback` continua existindo e correto
   para o caso PKCE genuíno (`?code=`), relevante se um fluxo iniciado
   pelo próprio browser for adicionado no futuro (ex.: "Entrar com
   Google").

10. **`supabase/config.toml`: `site_url`/`additional_redirect_urls`
    alinhados a `http://localhost:3000`.** Estavam em `127.0.0.1:3000` (só
    `https`, sem path) desde a Fase 0/1 — o GoTrue rejeita silenciosamente
    qualquer `redirectTo` fora da allow-list e cai no `site_url` puro, sem
    token/`next` nenhum. Só ficou visível testando o convite de verdade
    pela primeira vez nesta fase (nenhum teste anterior passava pela API
    do GoTrue). Corrigido para `http://localhost:3000` + `/redefinir-senha`
    e `/auth/callback` explícitos, alinhado a `NEXT_PUBLIC_SITE_URL`
    (`.env.example`).

11. **BUG REAL encontrado e corrigido: `validate_patient_profile_roles`
    (Fase 2) precisava de `SECURITY DEFINER`.** Sem isso, o trigger roda
    com a RLS do usuário que insere em `patients` — normalmente o próprio
    nutricionista. A policy `profiles_select_by_nutritionist` só libera a
    leitura do profile do paciente **depois** que a linha em `patients` que
    os vincula já existe — dependência circular com o que o trigger está
    validando durante esse mesmo `INSERT`. Resultado: convidar um paciente
    novo falhava sempre com "profile_id precisa referenciar um profile com
    role PATIENT", mesmo quando o profile era PATIENT de verdade. Nunca
    apareceu na Fase 2 porque todo insert de teste/seed em `patients`
    rodava como superuser (bypassa RLS de qualquer forma) — só ficou visível
    testando o fluxo real de onboarding autenticado como nutricionista.
    Corrigido em `supabase/migrations/20260917120001_fix_validate_patient_profile_roles_rls.sql`
    (mesmo padrão `SECURITY DEFINER` + `search_path = ''` das funções
    auxiliares de RLS).

12. **BUG REAL encontrado e corrigido: `auth.users` sem defaults para
    colunas de token quebrava login de usuário criado por insert direto.**
    `confirmation_token`, `recovery_token`, `email_change_token_new` e
    `email_change` não têm `DEFAULT` no schema do Supabase Auth — ficavam
    `NULL` em todo insert direto em `auth.users` usado desde a Fase 2
    (`supabase/seed.sql`, os 5 arquivos de teste pgTAP,
    `scripts/db-concurrency-test.mjs`). O GoTrue faz `Scan` dessas colunas
    como string não-anulável — login (e qualquer chamada de Auth) sobre
    esses usuários falhava com HTTP 500 ("sql: Scan error [...] converting
    NULL to string is unsupported"). Também só ficou visível agora: nenhum
    teste da Fase 2 passava pela API do GoTrue (pgTAP e o teste de
    concorrência conversam direto com Postgres). `ALTER TABLE auth.users`
    não é permitido pelo papel usado nas migrations (`must be owner of
    table users` — `auth.users` pertence a `supabase_auth_admin`, e
    `postgres` local não é membro desse papel; correto o schema de Auth
    ficar protegido assim). Corrigido no nível dos fixtures: todo insert
    direto em `auth.users` passou a informar essas 4 colunas como `''`
    explicitamente.

13. **BUG DE SEGURANÇA REAL encontrado e corrigido: o gate de
    redefinição de senha podia alterar a senha da conta ERRADA.**
    `ResetPasswordGate` (client) originalmente pulava o processamento do
    token do link (`window.location.hash`) sempre que o browser já tinha
    QUALQUER sessão válida (`if (initialHasSession) return`). Cenário real
    testado manualmente: nutricionista logado no mesmo browser abre o link
    de convite que acabou de gerar para um paciente → o gate via a sessão
    do nutricionista já presente nos cookies, nunca processava o token do
    paciente, e mostrava o formulário de nova senha operando em cima da
    sessão errada — o formulário seguinte trocava a senha do
    **nutricionista**, não a do paciente dono do link. Corrigido: quando o
    link traz um token no fragmento, ele SEMPRE tem prioridade e
    sobrescreve qualquer sessão pré-existente no browser; a sessão
    "existente" só é aproveitada quando não há token nenhum na URL (ex.:
    página recarregada na mesma aba depois que o token já tinha sido
    trocado por sessão). Reproduzido manualmente antes e depois da correção
    para confirmar (senha do nutricionista ficou intacta; senha do
    paciente convidado passou a funcionar). Não havia teste automatizado
    cobrindo esse cenário específico (sessão de outra conta já ativa no
    mesmo browser) antes desta fase — vale como item de atenção para
    revisão de segurança em fases futuras (`docs/SECURITY.md`).

14. **Testes E2E de autenticação rodam em série
    (`test.describe.configure({ mode: "serial" })`).** `e2e/auth.spec.ts` e
    `e2e/smoke.spec.ts` (que passou a depender de login desde que
    `/dashboard`/`/paciente` exigem autenticação) batem no mesmo processo
    único do Next.js (`npm run start`) e no mesmo Postgres local — sob alta
    concorrência de workers observamos troca esporádica de sessão entre
    requisições paralelas nesse setup de dev/CI local sem isolamento entre
    workers (não reproduzido de forma determinística o suficiente para
    isolar se é do ambiente de teste local ou mereceria investigação
    própria). Rodar em série elimina a flakiness sem mascarar nenhuma
    asserção; registrado aqui como item a revisitar na Fase 15 (testes/
    performance) se a suíte crescer a ponto de a execução serial pesar no
    tempo de CI.

15. **Testes de integração de Auth ficam fora do `npm run test:run`.**
    `scripts/auth-integration-test.mjs` (`npm run test:auth:integration`)
    bate direto nas APIs REST do GoTrue/PostgREST locais — mesmo padrão de
    `scripts/db-concurrency-test.mjs`: requer `npm run db:start` rodando,
    então fica fora da suíte Vitest, que continua rodando sem Supabase
    (`docs/ROADMAP.md`, Fase 1: "rodar só a Home/shells não precisa
    Supabase").

## Decisões técnicas da Fase 4 (Site público definitivo)

1. **Fontes de verdade do conteúdo, nesta ordem:** decisões explícitas do
   projeto (`PROJECT_SPEC`/`DECISIONS`) > requisitos do prompt da Fase 4 >
   PDF `references/Meu acompanhamento apresentação.pdf` > fotos. O texto do
   PDF foi reextraído integralmente (26 páginas, via PyMuPDF — não há
   `pdftoppm` na máquina) e cada afirmação publicada aponta para a página de
   origem em `src/content/metodo-em.ts`. Nada de CRN, telefone, endereço,
   e-mail, redes sociais, número de pacientes, taxa de sucesso, depoimento,
   certificação ou promessa de emagrecimento — o site simplesmente não
   renderiza o que não existe (`site_settings` continua vazio).

2. **Assets selecionados (5 fotos + logo + monograma), e por quê.** Das 20
   imagens em `./references` só estas foram copiadas para `public/`,
   convertidas para WebP (~1066×1600, quality 82, 73–104 KB) com `sharp`,
   originais intocados:
   - `public/images/enzo/hero.webp` ← `...16.47.32 (1).jpeg` — hero da Home:
     sorriso natural, luz de janela, enquadramento fechado que funciona em
     4:5 no desktop e em coluna única no mobile.
   - `public/images/enzo/sobre.webp` ← `...16.47.30 (1).jpeg` — Home (seção
     "Quem acompanha você") e `/sobre`: fundo neutro que se funde ao
     off-white do site, tom próximo.
   - `public/images/enzo/consulta.webp` ← `...16.47.30 (6).jpeg` — fase
     "Na consulta" do Método EM: escrevendo, sorrindo, adipômetro e fita na
     mesa — mostra a consulta acontecendo.
   - `public/images/enzo/avaliacao.webp` ← `...16.47.32 (3).jpeg` — fase
     "Depois da consulta": adipômetro em mãos, instrumento da avaliação
     física.
   - `public/images/enzo/atendimento-pb.webp` ← `...16.47.30.jpeg` —
     `/acompanhamento`: a única em preto e branco, escolhida para variar o
     ritmo visual da página de processo.
   - `public/brand/logo-horizontal.webp` ← `...16.47.31 (2).jpeg` (versão
     azul-petróleo), **recortado com `trim()`** — o JPEG original tem ~75% de
     área em branco, o que deixava o logo ilegível no header (era o
     `logo-horizontal.jpg` da Fase 1, removido). A pendência do SVG/PNG
     transparente continua (Fase 1, item 4).
   - `public/brand/monogram-badge.webp` ← `...16.47.31.jpeg` (monograma em
     círculo azul) — footer.
   - `public/images/og-default.jpg` — crop 1200×630 do hero para Open
     Graph/Twitter.
   As 3 fotos de pacientes do PDF ("vidas transformadas") NÃO foram
   extraídas nem usadas (docs/PROJECT_SPEC.md §4 — sem consentimento).

3. **Direção visual: editorial, não template.** Fraunces (títulos) + Manrope
   (texto) já definidos na Fase 1; off-white, azul-petróleo só em eyebrows,
   numerais e CTAs; sem gradiente, sem verde, sem ícones genéricos. Seções
   alternam foto/texto em vez de grades de cards; os únicos "cards" são os
   de plano. Animação: um único fade-in CSS no hero (`motion-safe:`) e
   `prefers-reduced-motion` global em `globals.css` — sem Framer Motion. Dark
   mode continua nos tokens, mas não é exposto no site público (a marca é
   clara).

4. **Método EM = antes / durante / depois.** Eixo da Home e de `/metodo-em`
   (`METHOD_PHASES`): pré-consulta gratuita → onboarding → anamnese →
   contrato (PDF p. 21); consulta com avaliação antropométrica/bioimpedância,
   exames e planejamento (p. 9, 12); check-list quinzenal com foto, peso e
   feedback, ajustes, suporte seg–sáb 08h–18h, lista de compras (p. 10, 12).
   O passo "boas-vindas no grupo de WhatsApp" do PDF **não entra**: dependia
   do grupo exclusivo, removido da oferta.

5. **Pilares: 4, não 6.** O PDF (p. 8) listava Consultas, Planejamento
   nutricional, Aplicativo de dietas, Grupo exclusivo, Comunidade VIP,
   Acompanhamento de perto. Publicamos os quatro válidos — "Grupo exclusivo"
   foi removido por decisão do prompt; "Comunidade VIP" está PENDENTE DE
   DEFINIÇÃO e não aparece como benefício nem como pilar até confirmação.
   "Aplicativo de dietas" virou "Seu plano sempre à mão" (é o módulo de
   cardápio da própria plataforma, não app de terceiro —
   docs/PROJECT_SPEC.md §2). Teste explícito em `src/content/metodo-em.test.ts`.

6. **Copy: reescrita natural, primeira pessoa no Sobre.** Sem clichês
   ("transforme sua jornada", "desbloqueie", "eleve sua saúde", "experiência
   única" — testado). Sem urgência falsa no CTA final. Headline do hero
   ("Nutrição que vai além de receber uma dieta.") deriva do conceito do
   prompt e de "Vamos juntos além de contar calorias" (PDF p. 3).

7. **Preços: o site nunca escolhe o principal.** `presentPlanPrices`
   (`src/domain/plans/pricing.ts`) só destaca o preço com `is_primary = true`
   (hoje: AVULSA, R$ 230). TRIMESTRAL/SEMESTRAL continuam sem primário
   (PENDENTE DE DEFINIÇÃO desde a Fase 0) — o card mostra "Opções de
   investimento" com à vista, parcelado e "Valor de referência"
   (`REFERENCIA`, rotulado assim de propósito, sem riscar/sem "de/por" para
   não afirmar desconto que ninguém definiu). Quando Enzo marcar um
   `is_primary` no banco, o card passa a destacá-lo sem deploy. Sem selos de
   "mais vendido"/"recomendado". Testado em unitário, integração e E2E.

8. **Cliente Supabase anônimo para conteúdo público**
   (`src/lib/supabase/public.ts`): anon key, sem cookies. Motivo: o conteúdo
   público é igual para todo visitante e a RLS `to anon` já filtra o que
   pode aparecer; sem `cookies()` as páginas públicas ficam estáticas com ISR
   (`revalidate = 600` no layout `(public)`). Nunca service role para
   renderizar conteúdo público (prompt Fase 4 §57).

9. **Camada `data/` + `domain/` nasceu.** `src/data/{plans,blog,results,
   site-settings}.ts` (queries, `cache()` por renderização) e
   `src/domain/{plans,blog,site-settings}` (regras puras: visibilidade de
   plano, apresentação de preço, visibilidade de post, resolução de
   contato). UI nunca importa Supabase direto (docs/ARCHITECTURE.md).
   `safeQuery` (`src/data/safe-query.ts`) devolve `{ ok: false }` e loga no
   servidor quando o banco falha — a UI mostra "temporariamente
   indisponível", nunca esconde o erro nem finge lista vazia.

10. **Autor do blog vem de `siteConfig`, não de join em `profiles`.** A RLS
    de `profiles` (correta) não deixa visitante anônimo ler o nome do autor.
    Como há um único autor, o nome vem de `siteConfig.professional.name`.
    Se houver mais autores no futuro, criar função `SECURITY DEFINER` que
    exponha só `full_name` de autores publicados.

11. **Renderizador de rich text próprio, sem `dangerouslySetInnerHTML`**
    (`src/components/blog/rich-content.tsx`): converte o JSON compatível
    com TipTap em React, só nós conhecidos, links só `http(s)/mailto//`,
    texto sempre como children — sem vetor de XSS por conteúdo do banco.
    Sem `@tailwindcss/typography`: estilos de artigo em `.prose-em`
    (`globals.css`).

12. **Contato valida, limita abuso e NÃO finge envio.** Sem provedor de
    e-mail (Resend é Fase 12) e sem tabela para guardar mensagens, a action
    devolve `not_delivered` e a UI diz que a mensagem foi validada mas ainda
    não enviada, apontando para o agendamento (prompt Fase 4 §29). Único
    ponto a mudar depois: chamar `EmailProvider.send()`. Honeypot + rate
    limit por IP (5/15 min) reaproveitando `InMemoryRateLimiter` da Fase 3.

13. **`/agendar` sem calendário falso.** Explica os 3 passos e usa os canais
    de `site_settings` quando existirem; sem eles, aponta para `/contato` e
    avisa que o agendamento online será conectado (Fase 6). `?plano=` só
    personaliza o texto.

14. **`/resultados` sem foto nesta fase.** Lê `before_after_results` pela
    policy pública (published + consentimento válido, checado no banco). O
    bucket `before-after` é privado mesmo para publicados — a entrega de
    imagem por signed URL server-side é Fase 14 (decisão da Fase 2, item 6).
    Empty state honesto; nenhum antes/depois fictício, nem do seed.

15. **Páginas legais sem inventar dados jurídicos.** Controlador = "Enzo
    Mangili, nutricionista clínico"; sem CNPJ, razão social, endereço ou
    foro. Prazo de retenção declarado como "em definição". Canal de
    privacidade cai para a página de contato enquanto não houver e-mail
    configurado. Revisão jurídica específica: PENDENTE DE DEFINIÇÃO antes da
    Fase 16.

16. **SEO com dados reais.** `metadataBase` = `NEXT_PUBLIC_SITE_URL`;
    títulos/descrições/canonical por página; OG/Twitter com
    `og-default.jpg`; `sitemap.ts` (11 rotas estáticas + posts publicados) e
    `robots.ts` (bloqueia `/dashboard`, `/paciente`, `/auth/`, login/senha);
    JSON-LD `Person` + `WebSite` na Home e `BlogPosting` no post — sem
    `address`, `telephone`, `priceRange`, `rating` ou `reviews`.

17. **Login redireciona quem já está autenticado** para `/dashboard` ou
    `/paciente` (prompt Fase 4 §55) — feito na própria página `/login`
    (já dinâmica), para não tornar todo o layout público dinâmico só para
    trocar o botão "Entrar" no header.

18. **Seed do blog ganhou corpo de demonstração** (título "Exemplo:",
    excerpt e primeiro parágrafo dizendo explicitamente que é demonstração)
    só para exercitar o renderizador; nunca é conteúdo real. A Home só
    mostra a seção de blog quando há posts publicados.

19. **Lighthouse não foi executado** (sem Chrome CLI/Lighthouse instalado no
    ambiente; instalar só para isso não se justifica nesta fase). Em seu
    lugar: hierarquia de headings verificada (um `h1` por página, `h2`/`h3`
    encadeados), `alt` em toda imagem, `sizes`/`priority` só acima da dobra,
    `aspect-ratio` fixo (sem CLS), sem overflow horizontal em 390 px
    (asserção E2E), Server Components por padrão (client: só menu mobile,
    formulários e gate de senha). Auditoria formal fica para a Fase 15.

20. **Screenshots de responsividade foram parciais.** A aba do Chrome usada
    na revisão ficou em segundo plano (`visibilityState: hidden`), o que
    deixou capturas intermitentemente em branco; a revisão visual desktop
    foi feita (Home, Método EM, Sobre, Planos) e o mobile foi validado por
    E2E em 390 px (menu, navegação, hero visível, sem overflow). Vale uma
    passada visual sua em 375/430/768/1024 antes de aprovar.

## Decisões técnicas da Fase 5 (Pacientes + Planos + Contratos)

1. **Status de paciente segue a regra da Fase 2, mapeada para três estados
   de UI.** `patient_overview.is_effectively_active` = `patients.status =
   'ACTIVE'` **e** existe `patient_contracts.status = 'ACTIVE'` (mesma
   fórmula da view `patient_active_status`). Na UI
   (`src/domain/patients/status.ts`): `ACTIVE` ("Ativo"), `NO_CONTRACT`
   ("Sem contrato" — cadastro ativo sem contrato vigente; conta como
   inativo nas métricas e no filtro "Inativos") e `INACTIVE` ("Inativo" —
   desativado pelo nutricionista, o override administrativo). O card
   "Pacientes ativos" conta `is_effectively_active = true`; "Total de
   pacientes" conta todos os pacientes do nutricionista (ativos + sem
   contrato + desativados — nada é destruído, então nada some da contagem).

2. **Desativar = `status = 'INACTIVE'` + `archived_at = now()`; reativar =
   `status = 'ACTIVE'` + `archived_at = null`.** O schema já tinha os dois
   campos com semânticas próximas ("soft delete" e "status manual"); em vez
   de inventar uma flag nova, a desativação preenche ambos e a reativação
   limpa ambos — um único conceito na UI. Nada é apagado: contratos,
   parcelas, pagamentos, consultas, avaliações, feedbacks, materiais e
   audit log ficam intactos (testado em pgTAP, integração e E2E). Sem hard
   delete nesta fase (`patients` não tem policy de DELETE).

3. **Ticket médio = receita efetivamente recebida no mês ÷ pacientes
   pagantes no mês.** `payments.status = 'CONFIRMED'` com `paid_at` dentro
   do mês civil corrente em America/Sao_Paulo (intervalo convertido para
   instantes explícitos `-03:00`), dividido pelo número de `patient_id`
   distintos nesses pagamentos (`computeAverageTicket`, puro e testado).
   Nunca "valor contratado ÷ pacientes": contrato parcelado não é receita
   no ato (docs/DATABASE.md, ledger). Sem pagantes => R$ 0,00. O card mostra
   tooltip com a fórmula e o detalhe "R$ X de N pagantes no mês".

4. **Uma migration nova, sem redesenhar nada da Fase 2**
   (`supabase/migrations/20260918120000_patients_contracts_management.sql`):
   - `patient_contracts.notes text` (observações administrativas, §27);
   - índice único parcial `patients (nutritionist_id, lower(email)) where
     email is not null` — e-mail duplicado para o mesmo nutricionista nunca
     é criado silenciosamente, nem em corrida entre requisições (a
     aplicação também checa antes e mapeia `23505` para
     `PATIENT_EMAIL_ALREADY_EXISTS`); outro nutricionista pode ter o mesmo
     e-mail;
   - view `patient_overview` (`security_invoker = true`): paciente +
     contrato ACTIVE mais recente + próxima consulta, numa query paginável
     pelo PostgREST (`count: exact`, `ilike` em nome/e-mail/telefone,
     `range`) — sem N+1 no servidor;
   - funções `create_contract_with_installments`, `cancel_contract`,
     `complete_contract` — **SECURITY INVOKER** (RLS continua valendo
     dentro delas; ownership via `nutritionist_id = auth.uid()` e
     `is_nutritionist_of_patient`), transacionais (contrato + parcelas
     nascem ou falham juntos — PostgREST não oferece transação entre dois
     inserts), e lançam códigos estáveis (`INVALID_INSTALLMENTS`,
     `PATIENT_NOT_FOUND`…) que `domainErrorFromDatabase` traduz — o erro
     cru do banco nunca chega ao usuário.

5. **Parcelas: divisão determinística + regra do dia-âncora.**
   `splitAmountCents(total, n)`: base = floor(total/n), e as primeiras
   `resto` parcelas recebem +1 centavo (100000/3 = 33334, 33333, 33333;
   100/3 = 34, 33, 33) — a função SQL revalida soma exata e numeração 1..n.
   Vencimentos: `addMonthsClamped` mantém o DIA do primeiro vencimento como
   âncora e limita ao último dia do mês de destino: 31/01 → 28/02 (29/02
   em bissexto) → 31/03 → 30/04 (o 31 "volta" nos meses que o têm, porque
   a âncora é a data original, não a anterior já reduzida). Toda a
   aritmética é de data civil (`YYYY-MM-DD`), sem `Date` local — nunca
   depende do fuso da máquina. A pré-visualização no formulário usa o
   mesmo código do servidor.

6. **Datas sugeridas de término**: `start_date + duration_months` do plano
   (TRIMESTRAL +3, SEMESTRAL +6, ANUAL +12) com o mesmo clamp; AVULSA (sem
   duração) sugere o próprio dia da consulta, sem duração artificial. O
   nutricionista revisa antes de salvar; término vazio é permitido.

7. **Snapshot do contrato**: `contracted_amount_cents` é prefixado pela
   condição de preço escolhida mas gravado como número do contrato;
   `plan_price_id` é só rastreabilidade. O nutricionista pode editar o
   valor antes de salvar (contrato manual/negociado) — o que foi vendido é
   o que fica; mudar `plan_prices` depois nunca altera contrato antigo.
   Contratos antigos nunca são sobrescritos: cada um é um card no histórico.

8. **Preços pendentes continuam pendentes.** O dashboard mostra TODAS as
   condições ativas do plano (cheio/REFERENCIA, parcelado, à vista) e o
   nutricionista escolhe a vendida; `is_primary` continua só refletindo o
   banco (AVULSA R$ 230 marcado; TRIMESTRAL/SEMESTRAL sem primário —
   PENDENTE DE DEFINIÇÃO desde a Fase 0). O plano ANUAL aparece no
   dashboard (histórico/clientes antigos/contratos manuais) com o badge
   "Não disponível no site". "Comunidade VIP" continua PENDENTE e não é
   adicionada a nenhum contrato.

9. **Contratos simultâneos: permitidos, sem constraint.** Plano principal
   + consulta avulsa podem coexistir; a view escolhe como "contrato atual"
   o ACTIVE de `start_date` mais recente, os demais ficam no histórico.
   Uma regra de exclusividade fica **PENDENTE DE DEFINIÇÃO** — não criamos
   constraint destrutiva sem regra de negócio confirmada.

10. **Status de contrato usa o enum real** (`ACTIVE`/`COMPLETED`/
    `CANCELLED` → Ativo/Encerrado/Cancelado); não há `PENDING` no enum e
    não criamos outro. Além do cancelamento exigido (§35), há "Encerrar"
    (ACTIVE → COMPLETED) — sem ele nenhum contrato sairia de ACTIVE fora do
    seed. Cancelar move parcelas PENDING/OVERDUE para CANCELLED e preserva
    as PAID, pagamentos e lançamentos; encerrar não toca nas parcelas (uma
    parcela pendente de contrato encerrado continua sendo valor a receber).
    Parcela PENDING vencida é EXIBIDA como "Em atraso" sem persistir
    OVERDUE — isso é do módulo financeiro (Fase 7).

11. **`patients.email` é e-mail de CONTATO; o login vive em
    `auth.users.email`.** Editar o paciente altera só o contato — o
    formulário avisa quando o paciente tem conta. Trocar o e-mail de login
    exige fluxo próprio do Supabase Auth (confirmação nos dois endereços)
    e fica como funcionalidade futura, nunca embutida em "Editar paciente".

12. **Convite reutiliza exatamente a infraestrutura da Fase 3.** A lógica
    de `invitePatientAction` foi extraída para
    `src/services/onboarding.ts#invitePatientToPortal` e é chamada por três
    caminhos: a tela `/dashboard/pacientes/convidar` (mantida), "Novo
    paciente + enviar convite" e "Enviar convite" no perfil. Duplicidade
    (§15): mesmo e-mail no mesmo nutricionista → `PATIENT_EMAIL_ALREADY_
    EXISTS` (antes de qualquer escrita); paciente já vinculado →
    `PATIENT_ALREADY_LINKED`; conta Auth já existente (qualquer origem) →
    o paciente é salvo mas o convite não sai (`INVITE_NOT_SENT`), o toast
    avisa e nada é vinculado silenciosamente; paciente sem conta + convite
    → linha existente é vinculada, nunca duplicada. Status do acesso ao
    portal (§24) vem de dados reais: `profile_id` + usuário Auth via Admin
    API (só depois de ownership): "Sem conta", "Convite pendente"
    (`invited_at` sem confirmação), "Ativo" (`last_sign_in_at`), "Não
    ativado" (demais casos, ex.: usuário do seed que nunca logou).

13. **Auditoria escrita pela aplicação** (`src/services/audit.ts`):
    `PATIENT_CREATED/UPDATED/ARCHIVED/REACTIVATED/INVITED`,
    `CONTRACT_CREATED/CANCELLED/COMPLETED`. Metadata mínima (ids, nomes de
    campos alterados, código do plano, valor/nº de parcelas) — nunca
    e-mail, telefone ou nascimento. Usa o cliente de sessão (policy exige
    `actor_id = auth.uid()`); falha ao auditar é logada no servidor e não
    desfaz a operação de negócio (não há transação cobrindo as duas
    escritas). A timeline do perfil usa `PATIENT_ARCHIVED/REACTIVATED` do
    audit log para eventos já revertidos.

14. **IDs nunca vêm "soltos" do client.** `patientId`/`contractId` chegam
    como argumento vinculado no servidor (`action.bind(null, id)`) ou são
    validados como UUID e, em todos os casos, reconferidos por ownership no
    service (`requireOwnedPatient`/`requireOwnedContract`, com checagem
    explícita de `nutritionist_id` além do filtro da query e da RLS).
    Schemas Zod só aceitam campos de negócio — `role`, `profile_id`,
    `nutritionist_id`, `status`, `created_at` são descartados (testado).
    `z.guid()` em vez de `z.uuid()`: o Zod 4 `uuid()` exige versão RFC
    9562 e rejeitava os ids do seed (`90000000-0000-...`), que são UUIDs
    válidos para o Postgres.

15. **Sem React Hook Form ainda.** Os formulários (paciente: 4 campos;
    contrato: 8 campos com pré-visualização) usam Server Action +
    `useActionState`, valores devolvidos pelo servidor em caso de erro e
    `<select>` nativo (`NativeSelect`) — participa do FormData sem campo
    oculto e é trivial em E2E. Toast pós-redirect via `?toast=<código>`
    (`FlashToast`): a action só anexa o código depois da resposta do
    backend, o componente mostra uma vez e limpa a URL.

16. **Componentes shadcn adicionados**: `table`, `select`, `tabs`,
    `alert-dialog`, `checkbox`, `sonner` (Toaster sem `next-themes` — a
    marca é clara, dark mode não é exposto; dependência removida) —
    `select`/`tabs` ficam disponíveis mas as telas usam `NativeSelect` e
    seções por link (`?tab=`), que funcionam sem JS e têm URL compartilhável.

17. **Responsividade real com a sidebar.** Descoberto na revisão visual em
    768/1024 px: o `<main>` do shadcn Sidebar (flex item) crescia além do
    viewport quando a tabela era larga — corrigido com `min-w-0` no
    `SidebarInset`. A tabela de pacientes aparece a partir de `lg` (1024,
    quando sobra largura ao lado da sidebar) com "Término previsto" e
    "Próxima consulta" só em `xl`; abaixo de `lg` a lista vira cards (uma
    coluna) com as mesmas ações. Parcelas escondem "Pago em" no mobile.

18. **Rate limit de login e a suíte E2E.** O limitador de login (Fase 3,
    10/5 min por IP+e-mail, em memória, conta tentativas com sucesso) é
    compartilhado por toda a suíte quando o servidor é reaproveitado.
    `e2e/patients.spec.ts` loga o nutricionista 2 vezes (uma página
    compartilhada por bloco serial) em vez de uma por teste — a suíte
    inteira fica em ~8 logins do nutricionista por execução. Rodar a suíte
    duas vezes em 5 minutos no mesmo servidor pode esbarrar no limite (já
    era assim; fica registrado para a Fase 15).

19. **Regra permanente de QA visual com screenshots** adicionada ao
    `CLAUDE.md` (desktop 1440 / tablet 768 / mobile 390, viewport +
    full-page, análise e correção antes de considerar a interface pronta;
    `screenshots/` no `.gitignore`). Script desta fase:
    `scripts/screenshots-fase-5.mjs`.

## Decisões técnicas da Fase 6 (Agenda + disponibilidade + agendamento)

1. **Regras comerciais NÃO definidas continuam configuráveis/pendentes.**
   Horários reais de trabalho, duração real da consulta, granularidade,
   antecedência mínima para agendar/cancelar, horizonte máximo, plataforma
   da consulta online, periodicidade fixa das presenciais e endereço são
   `PENDENTE DE DEFINIÇÃO`. Tudo isso é configuração (`availability_rules`
   + nova tabela `scheduling_settings`, editáveis em
   `/dashboard/agenda/configuracoes`), nunca constante. Os defaults de
   coluna de `scheduling_settings` (60 min, slots a cada 30 min) são valores
   TÉCNICOS de desenvolvimento, documentados como tal na migration e na UI
   ("Ainda não configurado — valores padrão técnicos"); o seed insere a
   mesma configuração fictícia e uma disponibilidade fictícia (seg–sex
   08–12/14–18) só para o ambiente local.

2. **Uma migration nova, sem tocar na anti-double-booking da Fase 2**
   (`supabase/migrations/20260919120000_scheduling_management.sql`). A
   exclusion constraint `appointments_no_overlap` continua a fonte final
   da verdade (10–11 e 11–12 ok; 10–11 e 10:30–11:30 conflito; CANCELLED e
   RESCHEDULED liberam o horário). A migration adiciona:
   - `scheduling_settings` (por nutricionista; leitura por qualquer
     autenticado — o paciente precisa dela para ver horários — e escrita só
     do dono);
   - `appointments.cancellation_reason` (motivo livre, opcional) e
     `appointments.created_by`;
   - trigger `validate_appointment_ownership`: `nutritionist_id` sempre igual
     ao responsável pelo paciente (fecha a brecha da policy da Fase 2, que
     deixava o paciente informar qualquer nutritionist_id) e, quando quem
     escreve é PATIENT, só INSERT com `SCHEDULED` sem valor, e UPDATE só
     para `CANCELLED`/`RESCHEDULED` a partir de `SCHEDULED`/`CONFIRMED` — sem
     mudar paciente, nutricionista, contrato ou valor;
   - trigger `validate_blocked_time_conflicts`: bloqueio não cobre consulta
     SCHEDULED/CONFIRMED (§50 — sem inconsistência invisível; cancele ou
     reagende antes);
   - `busy_intervals()` SECURITY DEFINER: devolve só início/fim/tipo dos
     intervalos ocupados — o paciente calcula horários livres sem ler
     consultas de outros pacientes;
   - `validate_booking_window()`, `book_appointment()`,
     `reschedule_appointment()` (SECURITY INVOKER): a janela de
     disponibilidade (regra ativa do dia da semana no fuso configurado,
     modalidade, fora de bloqueio, futuro + antecedência, horizonte) é
     validada NO BANCO antes do INSERT (§11/§88); sobreposição é decidida
     pela constraint (23P01 → `APPOINTMENT_SLOT_UNAVAILABLE`);
   - policy de INSERT em `audit_logs` para PATIENT limitada a
     `entity_type = 'appointment'` e `actor_id = auth.uid()`;
   - índice `appointments (status, starts_at)`.

3. **Slots: domínio puro + validação no banco.**
   `src/domain/scheduling/slots.ts#generateSlots` (entrada: data, fuso,
   regras, intervalos ocupados, duração, granularidade, agora, antecedência,
   horizonte) é a única implementação de "horário livre" na aplicação —
   dashboard e portal usam a mesma; testada com bloqueio 12–14 em 08–18,
   consulta 10–11 removendo 09:30/10:00/10:30 e mantendo 09:00/11:00,
   horário já passado no dia, antecedência, horizonte, modalidade. Duração
   e granularidade são independentes (60 min começando a cada 30). A
   confirmação (paciente) recomputa os slots no servidor e depois o banco
   revalida tudo de novo — a UI é só conveniência.

4. **Intervalos adjacentes na disponibilidade são permitidos, não
   consolidados.** 08–12 e 12–16 ficam como duas regras (podem ter
   modalidades diferentes); duplicados e sobrepostos no mesmo dia são
   rejeitados (validação igual no client e no server). Consequência
   documentada: uma consulta não atravessa a fronteira entre dois
   intervalos (11:30–12:30 não existe nesse caso) nem a meia-noite.

5. **Timezone: `America/Sao_Paulo` da configuração, nunca da máquina.**
   `src/lib/timezone.ts` converte relógio de parede ↔ instante só com
   `Intl` (offset calculado instante a instante; suporta DST, testado com
   `America/New_York`), a UI só manipula datas civis (`YYYY-MM-DD`) e
   `HH:mm`, e o banco compara `starts_at AT TIME ZONE settings.timezone`.
   Testes unitários rodam idênticos com `TZ=UTC` e `TZ=Asia/Tokyo`. Nenhum
   `new Date("YYYY-MM-DD")` sem fuso explícito.

6. **Reagendamento preserva histórico**: a consulta original vira
   `RESCHEDULED` (libera o horário) e uma NOVA consulta é criada, ligada por
   `rescheduled_to_id`, na mesma transação (`reschedule_appointment`),
   copiando contrato e valor — reagendar nunca gera nova cobrança (§26). A
   coluna já existia desde a Fase 2; nenhuma tabela de histórico extra.
   "Editar" (data/hora/duração/tipo sem trocar identidade) continua
   disponível para correções — o UPDATE direto continua sob a constraint e,
   sem override, sob `validate_booking_window`.

7. **Máquina de estados sobre o enum real** (`src/domain/scheduling/
   state-machine.ts`): SCHEDULED → CONFIRMED | COMPLETED | NO_SHOW |
   CANCELLED | RESCHEDULED; CONFIRMED → COMPLETED | NO_SHOW | CANCELLED |
   RESCHEDULED; finais não voltam. Paciente só CANCELLED/RESCHEDULED (e só
   consulta própria, ativa e futura, respeitando a antecedência configurada
   — NULL = sem regra). Reforçada no banco pelo trigger (§67).

8. **Override administrativo com confirmação explícita** (§51): o
   nutricionista pode marcar "Permitir fora da disponibilidade" para criar/
   editar/reagendar ignorando regras e bloqueios; não ignora sobreposição
   nem passado. Sem o checkbox, o nutricionista segue as mesmas regras do
   paciente (exceto antecedência/horizonte, que são regras do portal).

9. **Elegibilidade do paciente é permissiva dentro das relações válidas**
   (§41): pode agendar quem é paciente do nutricionista, com cadastro
   ACTIVE, se `patient_can_book` estiver ligado — contrato NÃO é exigido
   (consulta avulsa e paciente antigo continuam possíveis). Saldo de
   consultas do plano (3+2 / 6+5) NÃO bloqueia nada: `PENDENTE DE
   DEFINIÇÃO` comercial, sem contagem automática nesta fase (§42).

10. **Pagamento na agenda é só leitura do que já existe**
    (`payments.appointment_id`): "Pago"/"Pendente"/"Sem registro". Nada de
    lançamento manual, valor da consulta é snapshot informativo
    (`amount_cents`) — Fase 7.

11. **Observação administrativa da consulta vive em `appointment_notes`**
    (RLS só do nutricionista), não numa coluna de `appointments` que o
    paciente lê. Motivo de cancelamento fica em `appointments.
    cancellation_reason` (o paciente pode ver o próprio).

12. **Eventos internos de notificação sem entrega** (§59):
    `notification_events` recebe `APPOINTMENT_CREATED/RESCHEDULED/
    CANCELLED/CONFIRMED` via service role (como a Fase 2 modelou); nenhum
    e-mail/WhatsApp/lembrete — Fase 12 consome esses eventos.

13. **Público `/agendar` continua sem calendário** (§43): o CTA "Já sou
    paciente — agendar online" aponta para `/login?next=/paciente/agendar`;
    `/login` passou a honrar `next` (sanitizado por `sanitizeRedirectPath`
    da Fase 3) também para quem já está logado, só dentro da área do
    próprio papel — nutricionista nunca é levado ao portal (o proxy o manda
    ao dashboard). A página pública continua estática/ISR.

14. **Calendário próprio, sem biblioteca.** Grade semana/dia (colunas por
    dia, posição por minutos no fuso, disponibilidade/bloqueios como fundo)
    e grade mês (contagem por dia) em Server Components com links —
    nenhuma dependência nova, sem JS para navegar, acessível (blocos com
    nome completo, `aria-current`, tabelas com `scope`). Uma lib de
    calendário só se justificaria com drag-and-drop, que não foi pedido.
    Realtime não foi usado (§46): a confirmação revalida no servidor e o
    banco decide; conflito vira mensagem amigável e recarga dos slots.

15. **Correções descobertas no QA visual/hidratação**: contador de chaves
    em módulo no editor de disponibilidade causava mismatch de hidratação
    (servidor mantém estado entre requisições) — chaves determinísticas
    para linhas iniciais + contador de cliente só em evento; `Toaster`
    faltava no layout do portal; seed de consultas trocado de `now()` para
    horários fixos no fuso (cai na disponibilidade fictícia); `min-w-0` no
    `SidebarInset` do portal; lista de datas do agendamento rola até a data
    selecionada; cabeçalhos da semana compactos e blocos com texto empilhado
    em colunas estreitas.

16. **Rate limit de login passa a contar só tentativas FALHAS.** Ao rodar
    a suíte E2E completa contra o build (11 logins válidos do nutricionista
    em poucos minutos), o 11º login era bloqueado pelo limitador da Fase 3
    (10/5 min por IP+e-mail, que contava também os logins com sucesso). O
    objetivo do limite é força bruta, então `loginAction` agora zera o
    contador da chave após um login válido (`RateLimiter.reset`) — quem sabe
    a senha não é o alvo, e um usuário legítimo que entra e sai várias vezes
    não fica trancado. O limite de 10 tentativas falhas/5 min continua.
    Registro do E2E: agenda usa 1 login do nutricionista (o teste
    "nutricionista com `next` do portal" reutiliza a sessão do bloco).

17. **E2E em série (`workers: 1`) — causa raiz da "troca esporádica de
    sessão" da Fase 3 encontrada.** `logoutAction` faz `signOut()` com
    escopo GLOBAL (revoga todas as sessões do usuário no Supabase — decisão
    de segurança mantida). Com arquivos rodando em paralelo, o teste de
    logout de `auth.spec.ts` derrubava a sessão compartilhada do
    nutricionista que outro arquivo tinha acabado de abrir — exatamente a
    flakiness registrada na Fase 3 (item 14), que ficou determinística com
    mais arquivos usando o mesmo usuário. Em vez de enfraquecer o logout
    para escopo local, a suíte roda com um único worker (`fullyParallel:
    false`, ~1 min): cada arquivo loga depois de qualquer logout anterior.

## Decisões técnicas da Fase 7 (Financeiro completo)

1. **Definições financeiras fixadas em código e na UI** (tooltips dos
   cards; `src/domain/finance/definitions.ts`): CONTRATADO = soma das
   parcelas do contrato (nunca vira receita de uma vez); RECEBIDO =
   pagamentos CONFIRMED (por data de pagamento); PENDENTE = restante das
   parcelas em aberto de contratos não cancelados; PREVISTO/"a receber" =
   o mesmo, só de contratos ATIVOS; ATRASADO = pendente com vencimento
   anterior a hoje (derivado, nunca gravado); RECEITA/DESPESA = lançamentos
   com status Pago no período (por `occurred_on`); SALDO = receita −
   despesa realizadas; FATURAMENTO DO MÊS = receita paga do mês civil em
   America/Sao_Paulo. Pendentes nunca entram em receita/saldo.

2. **Consulta nunca gera receita automática.** Concluir, confirmar,
   reagendar ou cancelar uma consulta não toca no financeiro; consulta de
   plano já está coberta pelas parcelas do contrato (nada extra). A
   política de cobrança da consulta avulsa (na criação, na confirmação ou
   só manual) é `PENDENTE DE DEFINIÇÃO`: existe como constante
   configurável `APPOINTMENT_CHARGE_POLICY = "MANUAL"` — o nutricionista
   registra o pagamento pela tela "Registrar pagamento" (vinculado à
   consulta) ou por lançamento manual. Juros/multa por atraso também não
   existem (`PENDENTE DE DEFINIÇÃO`).

3. **Uma migration nova** (`20260920120000_financial_management.sql`),
   sem editar as anteriores:
   - `financial_transactions` ganha `nutritionist_id` (ownership real —
     a policy antiga deixava qualquer nutricionista ler todos os
     lançamentos), `patient_id`, `notes`, `cancelled_at`,
     `cancellation_reason`; trigger `guard_financial_transaction` (valor >
     0, lançamento gerado por pagamento não muda valor/tipo/data/origem,
     cancelado é final, nutricionista não muda de dono); policies por
     `nutritionist_id = auth.uid()`; DELETE revogado em
     `financial_transactions` e `payments` (cancelar/estornar preserva o
     histórico — nunca hard delete).
   - `payments` ganha `idempotency_key` (índice único parcial), `notes`,
     `recorded_by`, `cancelled_at`, `cancellation_reason`. A check da Fase
     2 (`paid_at` só em CONFIRMED) foi substituída por
     `payments_paid_at_status_check` (CONFIRMED ou REFUNDED) para o estorno
     manter a data original — a antiga derrubava `cancel_payment`
     (pego pelo pgTAP 090).
   - View `installment_payment_summary` (recebido/restante por parcela) e
     `contract_financial_summary` recriada descontando pagamentos parciais.
   - `record_manual_payment()` (SECURITY INVOKER, atômica): valida
     ownership sob RLS, parcela pagável, valor ≤ restante (a maior é
     recusado — o excedente entra como pagamento avulso), insere `payments`
     CONFIRMED/provider `MANUAL`, marca a parcela PAID só quando quitada e
     cria o lançamento INCOME (`origin = PAYMENT`, `occurred_on` na data do
     pagamento no fuso). Idempotente: mesma chave devolve o mesmo id
     (inclusive na corrida do clique duplo — `unique_violation` tratada).
   - `cancel_payment()`: pagamento → REFUNDED, lançamento → CANCELLED,
     parcela volta a PENDING se o recebido ficou abaixo do valor.
   - `financial_period_summary()` e `monthly_financial_series()` (com
     `p_months_ahead` para o gráfico "recebido x previsto": previsto ali =
     parcelas com vencimento no mês, pagas ou não).

4. **PostgREST não infere relação de uma view para a tabela por PK.**
   `installment_payment_summary!inner(contract_installments(...))` falha
   com PGRST200 (só FKs presentes na view viram relação). Parcela e saldo
   são lidos em queries separadas e unidos no `src/data` (2 queries, sem
   N+1) — vale para qualquer view futura.

5. **Chave de idempotência nasce no servidor**, no render do formulário
   (`crypto.randomUUID()` na page), viaja em campo oculto e é obrigatória
   no schema. Reenvio, clique duplo ou retry com a mesma chave não duplica
   pagamento nem lançamento; nova visita ao formulário gera outra chave.
   Pagamento parcial é permitido (o valor vem pré-preenchido com o
   restante); valor acima do restante é recusado no banco.

6. **Status derivados, nunca gravados:** parcela `PARTIAL` (recebido > 0 e
   < valor) e `OVERDUE` (pendente com vencimento passado) são calculados
   por `computeInstallmentBalance` com `hoje` em America/Sao_Paulo;
   lançamento `Atrasado` = PENDING com `due_on < hoje`. O banco continua
   com PENDING/PAID/CANCELLED. `presentInstallmentStatus` da Fase 5 segue
   valendo para a aba Contratos.

7. **Lançamentos gerados por pagamento são somente leitura** na UI e no
   banco (trigger). Só `origin = MANUAL` pode ser editado/cancelado; o
   cancelamento é um status (`CANCELLED` + motivo), nunca DELETE. Alterar
   um pagamento passa pelo estorno + novo registro.

8. **Backfill de `patient_id`** dos lançamentos antigos gerados por
   pagamento: a migration cobre dados pré-existentes; o `seed.sql` faz o
   mesmo no fim porque roda depois das migrations.

9. **Home do dashboard** lê tudo no fuso do nutricionista
   (`scheduling_settings.timezone`): faturamento do mês
   (`financial_period_summary` do mês civil), consultas de hoje
   (`listAppointmentsInRange` no dia local, sem canceladas/reagendadas),
   pacientes ativos (`getPatientMetrics`), previsão de rendimento (soma do
   previsto dos contratos ativos). Gráficos em Recharts com tabela
   equivalente `sr-only` (§77) e sem comparação percentual inventada.

10. **Busca por paciente na listagem**: PostgREST não aceita coluna de
    tabela embutida dentro de `or`; os ids de pacientes são resolvidos por
    nome (escopados ao nutricionista, ≤ 50) e entram em `patient_id.in`.
    O termo é sanitizado (`sanitizeSearchTerm`) antes de ir ao filtro.

11. **Auditoria via aplicação** (`recordAudit`):
    FINANCIAL_TRANSACTION_CREATED/UPDATED/CANCELLED, PAYMENT_RECORDED,
    INSTALLMENT_PAYMENT_APPLIED, PAYMENT_CANCELLED — sem valores sensíveis
    além de tipo/valor/status. A idempotência do pagamento é reportada ao
    serviço (`alreadyExisted`) e não gera segunda auditoria.

12. **`PatientPicker` ganhou `autoOpen`** (default `true`): no lançamento
    manual o paciente é opcional, então a lista só abre ao focar.

13. **QA visual — problemas encontrados e corrigidos:** views sem FK
    (item 4) derrubavam home/previsão/pagamento; eixo Y dos gráficos
    arredondava para "1k/0k" (agora "1,4 mil"/"350"); previsão de
    recebimentos não cabia em 1440 (colunas Duração/Método só em `2xl`,
    versão compacta na home); cards de lançamentos/previsão em grade
    estouravam em 768 (`min-w-0` no `li` — `truncate` deixa o min-content
    igual ao texto inteiro); cards de resumo em 2 colunas no mobile;
    tabelas de parcelas/pagamentos no mobile empilham data/vencimento e
    status; "via pagamento" só na tabela, não nos cards.

14. **`test:db:concurrency` (Fase 2) falhou uma vez** na bateria final
    (1 sucesso + 1 falha sem código 23P01) logo após `db reset` + suíte
    pgTAP; passou nas 4 execuções seguintes. Sem relação com o
    financeiro; fica registrado para observação.

15. **E2E sempre contra o servidor de produção que o próprio Playwright
    sobe.** `reuseExistingServer` passou a `false` (antes era `!CI`): um
    `next dev` órfão em `:3000` fez a suíte rodar contra o servidor errado
    (e disputar RAM com o Chromium até derrubá-lo). Agora, porta ocupada =
    falha explícita, nunca teste contra servidor desconhecido. A validação
    final roda em sequência para poupar memória: `npm run db:reset` →
    `npm run build` → `E2E_SKIP_BUILD=1 npx playwright test --workers=1`
    (`E2E_SKIP_BUILD` usa o build recém-gerado em vez de compilar de novo;
    sem a variável o comando continua `build && start`). O Playwright
    encerra o `next start` ao terminar. Nada disso muda o comportamento de
    produção. Ajustes de teste desta bateria (sem reduzir cobertura):
    locators ambíguos (`getByRole("alert")` pegava também o anunciador de
    rota do Next; `hasText` é case-insensitive e "parcela 4" casava
    pagamento e lançamento; o link "Agenda" do smoke ganhou `exact` porque
    a home agora tem "Abrir agenda") e `not-found.tsx` próprio do
    financeiro — com `loading.tsx` a resposta é streamada (status 200 +
    conteúdo de não encontrado, como em `/dashboard/pacientes/[id]`), então
    o E2E afirma a página "Registro financeiro não encontrado", não o
    status HTTP.

## Decisões técnicas da Fase 8 (Cardápios + plano alimentar)

1. **Modelagem da Fase 2 mantida; uma migration mínima**
   (`20260921120000_meal_plan_management.sql`): observações (plano,
   versão, dia, refeição, substituição), `start_date`, arquivamento do
   plano (`archived_at/archived_by`), `published_by`, `sort_order` das
   substituições. Nenhuma migration anterior editada; tipos regenerados.

2. **Um plano ATIVO por paciente** (índice único parcial
   `meal_plans_one_active_per_patient`). "Múltiplos planos ao longo do
   tempo" = arquivar o atual e criar outro (podendo usar uma versão
   anterior como base — `create_meal_plan(p_source_version_id)`). A
   evolução normal é por versão, não por plano novo.

3. **Versionamento e publicação (§3/§22–§25/§67):** DRAFT (editável) →
   PUBLISHED (o que o paciente vê; índice único parcial da Fase 2 garante
   uma por plano) → ARCHIVED (histórico). `create_meal_plan_version` copia
   a estrutura inteira (dias → refeições → alimentos → substituições) da
   publicada (ou da mais recente) num rascunho novo; só um rascunho por
   vez (`MEAL_PLAN_DRAFT_EXISTS`). `publish_meal_plan_version` é uma
   transação com `select … for update` no plano: serializa tentativas
   concorrentes, relê o status depois do lock (segunda tentativa recebe
   `MEAL_PLAN_ALREADY_PUBLISHED`), exige estrutura mínima (um dia com uma
   refeição com um alimento — `INVALID_MEAL_PLAN_STRUCTURE`), arquiva a
   publicada anterior e publica a nova. `unique_violation` residual vira
   `PUBLISH_CONFLICT`. Testado com duas publicações simultâneas via API
   (1 sucesso, 1 recusa, sempre uma PUBLISHED).

4. **Histórico imutável por trigger (§57):** conteúdo só muda em versão
   DRAFT (`guard_meal_plan_content` em dias/refeições/itens/
   substituições → `MEAL_PLAN_VERSION_NOT_EDITABLE`); transições de status
   só DRAFT→PUBLISHED, DRAFT→ARCHIVED, PUBLISHED→ARCHIVED; `version_number`
   e `meal_plan_id` imutáveis; só rascunho pode ser apagado
   (`discard_meal_plan_version`, nunca a v1 — o plano não fica sem
   versão); DELETE de planos revogado. Insert direto de versão já
   PUBLISHED continua permitido (seed/fixtures) — o índice único protege;
   a aplicação só insere DRAFT.

5. **Dias = dia da semana (0–6), plano parcial permitido.** A convenção da
   Fase 2 (`unique (version_id, weekday)`) é a "ordem/data lógica"; o
   label vem do domínio (segunda → domingo na exibição). Reordenar dia não
   faz sentido; "duplicar dia" copia para outro dia da semana e só
   sobrescreve destino com conteúdo mediante `p_replace = true` (a UI
   pede confirmação).

6. **Ordem explícita** (`sort_order`, desempate por id) em refeições,
   alimentos e substituições — nunca `created_at`. Reordenação por botões
   subir/descer (`moveInOrder` normaliza para 1..n); sem drag & drop.

7. **Quantidades e unidades:** `numeric(10,2)` com lista controlada de
   unidades (g, ml, unidade, fatia, colher de sopa/chá, xícara, copo,
   porção, concha, pedaço, prato, punhado, pitada, a gosto) com singular/
   plural na leitura ("2 unidades", "1 fatia", "100 g"). Nada é convertido
   nem calculado; calorias/macros são opcionais, digitados pelo
   nutricionista e exibidos só quando preenchidos (no portal ficam
   ocultos por padrão). A lista real de unidades e os nomes padrão de
   refeição do Enzo continuam `PENDENTE DE DEFINIÇÃO` (nome de refeição é
   livre).

8. **Substituições e "opções":** `meal_substitutions` por alimento cobre
   "no lugar de X use Y" com quantidade/unidade/observação próprias, sem
   equivalência automática. Não foi criada estrutura separada de "Opção
   1/Opção 2" — substituições por item resolvem o caso de uso sem
   duplicar modelagem (§16).

9. **Concorrência otimista na edição (§66):** cada update de dia/refeição/
   alimento/substituição envia o `updated_at` que a tela carregou
   (`.eq("updated_at", expected)`); 0 linhas atualizadas =
   `CONCURRENT_UPDATE` ("alterado em outra sessão, recarregue"). Salvar é
   explícito (sem autosave). Testado por integração.

10. **Visibilidade do paciente:** RLS da Fase 2 (só `status = PUBLISHED`
    em cascata) + query do portal (`getPublishedMealPlan`: PUBLISHED de
    plano não arquivado, nunca "a última criada"). Paciente não vê
    rascunho nem histórico (só a versão atual — regra de histórico para o
    paciente fica `PENDENTE DE DEFINIÇÃO`), não escreve nada e não chama
    as funções de publicação (`PATIENT_NOT_FOUND`/permissão negada).
    Portal abre no dia de hoje no fuso do nutricionista.

11. **Segurança de dado de saúde (§63–§65):** auditoria só com ids e o
    tipo de operação (`MEAL_PLAN_UPDATED` + `{entity, op}`), nunca
    alimento/observação (o E2E confirma que nenhum nome de alimento
    aparece em `audit_logs.metadata`); logs de erro não incluem conteúdo;
    páginas `force-dynamic`, sem ISR/cache público; rotas privadas
    continuam noindex. Ownership: nutricionista → paciente → plano →
    versão → dia → refeição → item → substituição reconferido no serviço
    (queries `!inner` até o plano) além da RLS; ids adulterados caem em
    "Plano alimentar não encontrado" sem revelar existência.

12. **Editor como página dedicada** (`/dashboard/pacientes/[id]/cardapio/
    [versionId]`), não em Dialog: versão publicada/arquivada abre em
    leitura (`MealPlanView`, o mesmo componente do portal) com "Criar nova
    versão"; formulários inline por elemento; diálogos de confirmação para
    remover dia/refeição/alimento/substituição, publicar quando substitui a
    atual, descartar rascunho e arquivar plano. Toasts só após a resposta
    do servidor; `router.refresh()` mantém o estado local (dia aberto,
    formulários).

13. **Limpeza de dados de teste com versões imutáveis:** os scripts de
    integração/E2E apagam o que criaram com `session_replication_role =
    replica` (triggers desligados) e exclusão em ordem manual, porque os
    triggers de imutabilidade também valem para o superusuário — decisão
    consciente: histórico nunca é apagado pela aplicação.

14. **Playwright — `E2E_DEV_SERVER=1`** desliga o webServer para iterar
    num spec contra um `next dev` já aberto; a validação final continua
    `db:reset → build → E2E_SKIP_BUILD=1 playwright test --workers=1`
    (`reuseExistingServer: false`, Fase 7 item 15).

15. **QA visual — problemas encontrados e corrigidos:** no mobile o
    cabeçalho da refeição quebrava o nome por causa das 5 ações na mesma
    linha (ações passam para a linha de baixo em `< sm`) e a quantidade
    do alimento quebrava separada do nome (vira linha própria em `< sm`);
    locators ambíguos no script de screenshots (`getByLabel("Alimento")`
    pegava a lista `aria-label="Alimentos de …"`). Portal, aba Cardápio,
    histórico e diálogo de publicação aprovados sem ajuste.

16. **Deadlock legítimo na exclusion constraint (flake das Fases 7–8
    explicado).** `test:db:concurrency` e `test:scheduling:concurrency`
    falhavam esporadicamente com "1 sucesso, 1 falha" cuja falha era
    `40P01 deadlock_detected`, não `23P01`: quando duas inserções entram na
    `appointments_no_overlap` ao mesmo tempo, cada transação espera a
    outra na checagem de sobreposição e o Postgres aborta uma por
    deadlock. O invariante (nunca duas consultas ativas no horário) valeu
    em 100% das execuções. Correção: `domainErrorFromDatabase` mapeia
    `40P01` para `APPOINTMENT_SLOT_UNAVAILABLE` (quem perde a corrida vê
    "o horário acabou de ser reservado", não um erro genérico) e os dois
    scripts aceitam 23P01 ou 40P01 como a recusa — continuam exigindo
    exatamente 1 sucesso e 1 linha ativa. Reproduzido em ~1 a cada 4–6
    execuções antes; 8/8 e 5/5 depois. Substitui a observação do item 14
    da Fase 7.

17. **Asserções de toast no E2E:** `FlashToast` remove `?toast=` da URL
    logo depois de exibir a mensagem, então `toHaveURL(/toast=.../)`
    disputa com essa limpeza (falhou 1× na bateria final da Fase 8, em
    `finance.spec`). Os specs passam a afirmar o texto do toast (o
    comportamento real) e a rota base; `patients.spec` passou a esperar a
    aba Cardápio real (o placeholder que resta é Avaliações).

## Decisões técnicas da Fase 9 (Avaliações físicas + bioimpedância + evolução)

1. **Modelagem flexível da Fase 2 mantida; uma migration mínima**
   (`20260922120000_assessment_management.sql`). Sem enum de tipo (o
   "tipo" — Bioimpedância/Medidas/Geral — é derivado das métricas
   presentes), sem colunas fixas por métrica, sem protocolo de dobras nem
   fórmula: `assessments` ganha `assessment_date` (data civil, obrigatória,
   backfill a partir de `assessed_at` no fuso; o trigger deriva quando o
   chamador não informa), `visible_to_patient` + `published_at`,
   `internal_notes`, `archived_at/by`, `updated_by` e os metadados do
   relatório (`report_path/name/mime/size_bytes/uploaded_at`, sempre todos
   ou nenhum). Catálogo ampliado por migration (dado de produto): altura,
   massa de gordura, metabolismo basal, circunferências de abdômen/tórax/
   coxa/panturrilha. `BMI` desativado no catálogo — IMC é derivado de peso
   + altura na apresentação (1 casa, só valor, nunca faixa) e nunca gravado.

2. **Métricas suportadas** = catálogo `measurement_types` ativo, agrupado na
   UI em Dados básicos (peso kg, altura cm), Composição corporal (% gordura,
   massa de gordura, massa magra, massa muscular, água corporal %, gordura
   visceral nível, metabolismo basal kcal) e Medidas corporais (cintura,
   abdômen, quadril, tórax, braço, coxa, panturrilha em cm). Nenhuma é
   obrigatória; dados parciais são normais. Unidade vem do catálogo, nunca
   misturada ao valor. `numeric(10,3)`: 78,45 kg fica 78.450 (§51).
   Quais métricas o Enzo usa de fato e dobras/protocolo continuam
   `PENDENTE DE DEFINIÇÃO` (novas métricas entram por migration).

3. **Ranges técnicos, não clínicos:** valor > 0 sempre; percentual ≤ 100;
   limite do `numeric`. Trigger `guard_assessment_measurement` + Zod
   (`validateMetricValue`). Nada de "peso saudável".

4. **Parsing pt-BR seguro** (`parseDecimalPtBr`): 78 / 78,5 / 78.5 /
   1.234,56 — vírgula é decimal quando presente, pontos são milhar; sem
   vírgula, um ponto é decimal; até 3 casas; nunca `parseFloat`. Deltas via
   `subtractPrecise` (sem ruído binário). Formatação pt-BR sem zeros à
   direita; delta com sinal e unidade; percentual em **p.p.** (§34).

5. **Observação visível x nota interna:** `notes` aparece no portal quando
   a avaliação está visível; `internal_notes` nunca é selecionada pelas
   queries do portal (`PATIENT_SELECT`) e o portal só recebe DTOs sem ela.
   A RLS de linha do paciente permite ler a linha (não há RLS por coluna);
   a garantia é a query + o E2E ("Nota interna" ausente no portal).

6. **Visibilidade por avaliação (§18):** nasce oculta; "Liberar para o
   paciente" grava `published_at` (primeira liberação). RLS do paciente
   (tabelas e bucket) exige `visible_to_patient = true and archived_at is
   null` — helper SECURITY DEFINER `assessment_visible_to_patient`
   (CLAUDE.md regra 11). Query do portal repete o filtro. Histórico do
   paciente = só avaliações liberadas.

7. **Relatório de bioimpedância:** bucket privado `bioimpedance-reports`
   (já existia), path `<patient_id>/<assessment_id>/<uuid>.<ext>` (trigger
   recusa path fora desse prefixo — `REPORT_PATH_INVALID`; nunca nome do
   paciente nem filename original). Tipo real conferido pela assinatura do
   arquivo (`%PDF-`, JPEG, PNG), não pelo MIME do browser; até 10 MB; nome
   exibido saneado. Upload pelo cliente de sessão (RLS do bucket: só o
   nutricionista do paciente escreve). Substituir = enviar o novo, gravar
   metadados e só então apagar o anterior (sem órfão silencioso); remover =
   limpar metadados (paciente perde acesso na hora) e apagar o objeto.
   Download por route handlers server-side (`…/relatorio`): ownership/
   visibilidade → `createSignedUrl(60 s)` → redirect com `Cache-Control:
   no-store`; a URL nunca vai a log, auditoria ou banco. Sem OCR/IA.

8. **Edição, arquivamento e exclusão (§28–§29):** edição administrativa
   controlada (formulário = estado completo; `set_assessment_measurements`
   faz upsert + remoção numa transação; `updated_at/updated_by` + auditoria
   `ASSESSMENT_UPDATED`). Arquivar = `archived_at` (sai da evolução e do
   portal, dado preservado, irreversível por trigger). Exclusão física só
   quando `published_at is null` (nunca exibida ao paciente) — trigger
   `ASSESSMENT_NOT_DELETABLE`; o objeto do relatório é removido antes.
   Histórico de versões de avaliação não existe nesta fase (documentado
   como pendência).

9. **Ordenação e evolução:** sempre por `assessment_date` desc (desempate
   por `created_at`), nunca `created_at`. Cards de variação comparam a
   última avaliação com a anterior QUE TEM a mesma métrica; sem baseline =
   "Primeira avaliação com esta métrica" (nunca 0%). Séries por métrica só
   com os pontos existentes (null nunca vira zero); gráfico só com ≥ 2
   pontos; altura não é graficada (`NON_CHARTABLE_CODES`). Comparação A→B
   pela URL (`?a=&b=`), união das métricas, "sem par" quando falta um lado,
   direção descritiva subiu/desceu/sem alteração com ícone + texto — nenhum
   "melhorou/piorou".

10. **Auditoria sem dado de saúde:** `ASSESSMENT_CREATED/UPDATED/PUBLISHED/
    UNPUBLISHED/ARCHIVED/DELETED`, `BIOIMPEDANCE_REPORT_UPLOADED/REMOVED`
    com metadata só de ids, contagem de métricas, mime/tamanho e flags — o
    E2E verifica que peso, gordura, circunferência, nota interna e nome do
    relatório não aparecem em `audit_logs.metadata`. Logs de erro da action
    registram só a mensagem técnica.

11. **Storage no pgTAP e na integração:** o pgTAP insere linhas em
    `storage.objects` como superusuário para provar a policy do bucket
    (paciente A só o objeto de avaliação visível; paciente B e nutri B
    nada). A limpeza da integração usa a API do Storage (a tabela recusa
    DELETE direto: "Direct deletion from storage tables is not allowed").

12. **FlashToast sem navegação:** o `router.replace` que limpava `?toast=`
    disparava uma navegação do App Router; agora usa
    `window.history.replaceState` (integrado ao `useSearchParams`), que não
    compete com uma Server Action enviada logo após a chegada pelo redirect.

13. **QA visual — problemas encontrados e corrigidos:** mismatch de
    hidratação (`encType="multipart/form-data"` explícito num `<form
    action={fn}>` — o React gerencia esse atributo); seletor de "outras
    métricas" abria em Altura (linha reta inútil) — altura não é graficada e
    circunferências vêm primeiro; rótulos "Circunferência da panturrilha"
    quebrando no formulário/lista — nome curto dentro do grupo Medidas
    (catálogo intacto); "0.00 MB" para arquivo pequeno — KB abaixo de 1 MB.
    No script de screenshots: `count()` antes da página renderizar e
    `getByText("Relatório anexado.")` casando com "Nenhum relatório
    anexado." (substring) — o upload nunca acontecia; corrigidos com
    `waitFor` + `exact: true`. No E2E: `getByRole("table")` pegava a tabela
    sr-only do gráfico antes do histórico (escopo na seção) e clicar numa
    seção já aberta a fechava (`ensureOpen` por `aria-expanded`).

14. **Sessão do Claude Code reiniciada no meio da fase:** o `next dev`
    ficou órfão sem stdout (EPIPE, workers quebrados) — foi encerrado e
    recriado; nenhum dado foi perdido (tudo em arquivos/banco local).

15. **Bateria final da Fase 9:** `test:db:concurrency` e
    `test:scheduling:concurrency` passaram na primeira execução (com
    captura de payload preparada caso falhassem). E2E: 93/100 na primeira
    rodada contra o build — a única falha foi o `patients.spec` da Fase 5
    esperando "Avaliações" ainda como placeholder (agora é real; o
    placeholder que resta é Comentários) — 100/100 na segunda rodada, sem
    skip.

## Decisões técnicas da Fase 10 (Suplementos + feedbacks + materiais do paciente)

1. **Schema da Fase 2 reutilizado; uma migration mínima**
   (`20260923120000_patient_content_management.sql`). Nenhuma tabela
   paralela, nenhum enum novo: `supplement_recommendations` ganha
   `dose_text`, `starts_on/ends_on`, `archived_at/by`, `updated_by` e
   `check` de `purchase_url` (só `^https?://`); o status é derivado de
   `active` + `archived_at` (ATIVA / ENCERRADA / ARQUIVADA — §11).
   `feedback_messages` ganha `title`, `reference_date`, `published_at`
   (null = rascunho), `archived_at/by`, `updated_at/by`; linhas anteriores à
   migration recebem `published_at = created_at` (eram visíveis antes).
   `patient_materials` ganha `kind` (FILE/LINK), `description`,
   `external_url`, `file_name/file_size_bytes`, `archived_at/by`,
   `updated_by`, e `storage_path` vira nullable (link não tem arquivo;
   arquivo nasce sem path). `material_assignments` ganha
   `assigned_by/revoked_by`. Campos não modelados ficam `PENDENTE DE
   DEFINIÇÃO`: categoria de material, contexto/consulta do feedback, imagem
   de suplemento (`image_path` existe, sem upload nesta fase).

2. **Suplementos — princípio clínico (§1):** o sistema só registra e
   apresenta. Dose e frequência são texto livre (`"1 cápsula"`, `"após o
   treino"`) — sem engine, sem lista rígida; exemplos só como placeholder.
   Link de compra é só link (sem cupom/afiliado/comissão — §10). Encerrar
   (`active = false`) tira do portal e permite reativação explícita;
   arquivar é definitivo (trigger recusa edição e desarquivamento —
   `SUPPLEMENT_ARCHIVED`); DELETE revogado de `authenticated` (§14).

3. **Feedback não é chat (§19):** só o nutricionista escreve; o paciente
   lê e, no máximo, marca como lido (`read_at` — trigger compara todas as
   outras colunas via `to_jsonb` e recusa qualquer outra mudança:
   `FEEDBACK_NOT_AUTHORIZED`). Rascunho (`published_at is null`) nunca chega
   ao portal (RLS + query). "Disponibilizar" grava `published_at` e é
   **definitivo** (o paciente pode já ter lido; voltar a rascunho →
   `INVALID_STATUS_TRANSITION`); para ocultar, arquivar. **Edição após
   disponibilizar é permitida** com `updated_at/updated_by` + auditoria
   `FEEDBACK_UPDATED` (campos alterados por nome) — sem versionamento pesado
   (§25, decisão documentada). Exclusão física só de rascunho
   (`FEEDBACK_NOT_DELETABLE`). Nota interna/clínica não existe em
   `feedback_messages` — continua em `appointment_notes`/`internal_notes`.
   O portal mostra "Seu nutricionista" (a RLS de `profiles` não expõe o
   profile do nutricionista ao paciente; nenhum id interno é exibido — §29).

4. **Materiais: MATERIAL ≠ ATRIBUIÇÃO (§31).** Um material é reutilizável;
   `material_assignments` é única por (material, paciente): revogar =
   `revoked_at` (linha nunca some — DELETE revogado), reatribuir = limpar
   `revoked_at` (trigger renova `assigned_at/by` e zera `revoked_by`).
   Trigger `guard_material_assignment` exige material e paciente do MESMO
   nutricionista (a FK não passa pela RLS; `MATERIAL_NOT_AUTHORIZED`),
   material não arquivado e completo (`MATERIAL_INCOMPLETE`). Arquivar
   material (§44): paciente perde o acesso mesmo com atribuição ativa
   (helper de visibilidade exclui arquivado), não é reatribuível, o
   histórico administrativo permanece e o objeto NÃO é apagado. DELETE de
   material só se nunca teve atribuição (trigger `MATERIAL_NOT_DELETABLE`)
   — usado apenas como compensação de upload falho; a UI só arquiva (§45).

5. **Storage de materiais (§36–§40):** bucket privado `patient-documents`
   da Fase 2 reutilizado; path `<material_id>/<uuid>.<ext>` (por material,
   não por paciente — o mesmo arquivo serve a vários pacientes; nunca nome
   de paciente nem filename original; trigger `MATERIAL_PATH_INVALID`).
   Como o bucket só autoriza escrita quando a linha do material existe, o
   fluxo é: inserir a linha (FILE, sem path) → upload → gravar
   `storage_path/mime/file_name/file_size_bytes`; se o upload falhar a
   linha (nunca atribuída) é apagada. Tipo conferido pela assinatura
   (`%PDF-`, JPEG, PNG), limite TÉCNICO de 10 MB (mesmo da Fase 9, abaixo
   dos 50 MB do bucket — não é capacidade comercial, §38). Substituir =
   enviar o novo, gravar, só então remover o anterior. Download por route
   handlers server-side (`/dashboard/materiais/[id]/arquivo`,
   `/paciente/materiais/[id]/arquivo`) com URL assinada de 60 s e
   `Cache-Control: no-store`; nunca persistida nem logada (§46–§47).

6. **Visibilidade do paciente por helper SECURITY DEFINER** (CLAUDE.md
   regra 11): `material_visible_to_patient(material_id)` = atribuição não
   revogada + material não arquivado e completo + `is_patient_self`. Usada
   nas policies de `patient_materials`, `material_assignments` e do bucket
   (substitui o `EXISTS` direto da Fase 2). Suplemento: `active and
   archived_at is null`; feedback: `published_at is not null and
   archived_at is null` — direto na policy, sem tabela externa.

7. **Validador central de URL externa (§61):**
   `src/domain/patient-content/urls.ts` (`validateExternalUrl`) é o único
   ponto que aceita um link: só `http:`/`https:` absolutos com host; recusa
   `javascript:`, `data:`, `file:`, `ftp:`, `//host`, espaço/controle e
   credenciais embutidas; nunca reescreve (não força https, só prefere na
   UX). Usado pelos schemas Zod de suplemento e material; o banco repete
   com `check (~* '^https?://')` como defesa em profundidade. Todo link
   externo passa por `components/shared/external-link.tsx`: `target=_blank`
   + `rel="noopener noreferrer"` + host visível + ícone (§16/§70/§96).

8. **Eventos internos de notificação (§52–§53):**
   `SUPPLEMENT_RECOMMENDATION_CREATED`, `FEEDBACK_PUBLISHED`,
   `MATERIAL_ASSIGNED` gravados em `notification_events` pelo mesmo
   `recordNotificationEvent` da Fase 6 — sem e-mail/WhatsApp/push (Fase 12).

9. **Auditoria sem conteúdo clínico (§54–§56/§83):**
   `SUPPLEMENT_RECOMMENDATION_CREATED/UPDATED/DEACTIVATED/REACTIVATED/
   ARCHIVED`, `FEEDBACK_CREATED/UPDATED/PUBLISHED/ARCHIVED/DELETED`,
   `MATERIAL_CREATED/UPDATED/ARCHIVED/ASSIGNED/UNASSIGNED/FILE_UPLOADED/
   FILE_REMOVED` com metadata só de ids, flags, nomes de campos alterados,
   mime/tamanho e comprimento do texto — nunca produto, dose, orientação,
   mensagem do feedback, nome do arquivo ou URL. O E2E verifica com regex.

10. **UI:** abas Suplementos/Feedbacks/Materiais reais no perfil (nada
    comprimido em Visão Geral — §3); tabelas só a partir de `lg` (com a
    sidebar aberta, 768 px fica estreito — problema encontrado no QA visual
    e corrigido: a tabela cortava Status/Ações; abaixo de `lg` são cards) e
    colunas secundárias só em `xl`. Feedback no portal em coluna única com
    `max-w-prose` (§73); materiais em cards com "Abrir" (link) ou "Baixar"
    (arquivo), sem preview de PDF (§74). Formulário de feedback com dois
    submits (`intent=draft|publish`) — em feedback já disponibilizado só
    "Salvar alterações"; a página de edição não repete o botão "Editar"
    (redundância removida no QA). Toasts só após o servidor (`?toast=`).

11. **Testes:** 31 unitários (validador de URL, status/visibilidade/
    apresentação, schemas), 75 pgTAP (`120_patient_content.test.sql`, incl.
    `storage.objects` inserido como superusuário para provar a policy do
    bucket), 76 checks de integração via PostgREST/Storage com JWTs reais
    (nutri B com paciente próprio, para provar que não atribui material de
    A nem ao próprio paciente), 17 E2E com nutricionista e paciente em
    contextos de browser separados (cria → paciente não vê / vê → edita →
    arquiva/remove → paciente perde), mobile 390 sem overflow.
