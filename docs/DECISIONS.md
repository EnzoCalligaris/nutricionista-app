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
