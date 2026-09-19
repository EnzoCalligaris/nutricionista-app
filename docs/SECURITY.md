# SECURITY — Segurança e LGPD

## Autenticação e autorização — implementada na Fase 3

- Supabase Auth via `@supabase/ssr` (site público e portal do paciente
  compartilham o mesmo provedor de identidade; papel determina o que cada
  um vê). Três clientes (`src/lib/supabase/{client,server,admin}.ts`,
  Fase 2, revisados na Fase 3 — nenhuma mudança necessária): browser (anon
  key), server (anon key + cookies de sessão), admin (`service_role`,
  `server-only`, nunca importado por Client Component).
- Papéis: `NUTRITIONIST`, `PATIENT`, `ADMIN` (existe no enum, sem uso ativo).
  Papel vive em `profiles.role`, **nunca** em `user_metadata`/
  `raw_user_meta_data` (metadata é fornecida pelo browser/client e não é
  fonte confiável de autorização) — fonte de verdade é sempre a leitura de
  `profiles.role` no servidor.
- **Role default é sempre `PATIENT`.** Trigger `handle_new_auth_user`
  (`supabase/migrations/20260917120000_auth_profile_provisioning.sql`) cria
  o profile automaticamente para todo novo usuário de `auth.users`; um
  usuário criado sem operação administrativa privilegiada nunca vira
  `NUTRITIONIST` sozinho. Promover a `NUTRITIONIST` é sempre uma ação
  administrativa separada (`scripts/bootstrap-nutritionist.mjs`,
  `SUPABASE_SERVICE_ROLE_KEY` em mãos) — **sem cadastro público de
  nutricionista**.
- **Proteção contra role escalation em duas camadas de banco**: trigger
  `prevent_role_change` (Fase 2) bloqueia `UPDATE` de `role` por quem não é
  `service_role`; policy `profiles_insert_self` (apertada na Fase 3) só
  aceita auto-inserção de profile com `role = 'PATIENT'`. Testado em
  `supabase/tests/database/060_auth_provisioning.test.sql`,
  `scripts/auth-integration-test.mjs` (via REST real) e
  `e2e/auth.spec.ts` (via REST real, através do Playwright `request`).
- **Proteção de rota em camadas** (nunca uma única fonte de verdade):
  1. `src/proxy.ts` — primeira camada, redireciona anônimo para `/login`
     (com `?next=` sanitizado) e cruza role errado para a área certa
     (`PATIENT` em `/dashboard` → `/paciente`, e vice-versa). Usa
     `supabase.auth.getUser()` (valida contra o servidor Auth), nunca
     `getSession()` (só leria o cookie local sem validar).
  2. Cada layout protegido (`src/app/dashboard/layout.tsx`,
     `src/app/paciente/layout.tsx`) chama
     `requireNutritionist()`/`requirePatient()`
     (`src/lib/auth/session.ts`) independentemente — o próprio Next.js
     documenta que um matcher mal configurado pode silenciosamente remover
     a cobertura do proxy, então "renderizar condicionalmente" nunca é a
     fronteira de segurança sozinha.
  3. RLS (Fase 2) é a camada final — vale mesmo se as duas anteriores
     falharem.
- Toda autorização é revalidada no servidor (server actions / route
  handlers), nunca só no client/render condicional.
- Sem IDs hardcoded (nem "o nutricionista é sempre o usuário X" no código —
  resolver por `auth.uid()` + relação no banco).

### Login, logout, recuperação de senha

- `/login`: e-mail + senha, mensagem de erro sempre genérica
  ("E-mail ou senha inválidos.") — nunca diferencia usuário inexistente de
  senha errada (prevenção de enumeração de contas).
- `/esqueci-senha`: mensagem sempre neutra ("Se existir uma conta [...]"),
  independente de o e-mail existir — mesmo raciocínio.
- `/redefinir-senha`: senha mínima de 8 caracteres, confirmação obrigatória,
  sessão de recuperação encerrada (`signOut`) depois de trocar a senha —
  usuário precisa entrar de novo com a senha nova. Trata link
  inválido/expirado com mensagem clara + link para solicitar outro.
- **Callback de e-mail é assimétrico, documentado em `docs/DECISIONS.md`**:
  convite/recuperação de senha são iniciados pelo SERVIDOR (Admin API /
  server action), então o GoTrue devolve o token no **fragmento** da URL
  (`#access_token=...`), não em `?code=` — só o client consegue ler.
  `src/components/auth/reset-password-gate.tsx` processa esse token e
  estabelece a sessão via `setSession()`; `src/app/auth/callback/route.ts`
  (server-side) continua existindo para o caso PKCE genuíno (`?code=`),
  relevante se um fluxo iniciado pelo browser (ex.: OAuth) for adicionado.
  Nunca loga `access_token`/`refresh_token`/OTP/authorization code em
  nenhum dos dois caminhos.
- Logout real via `supabase.auth.signOut()` (`src/actions/auth.ts`) — limpa
  os cookies de sessão; qualquer requisição seguinte a rota protegida volta
  a cair como anônima no proxy, mesmo que o browser mostre uma página em
  cache ao navegar "Voltar" (testado em `e2e/auth.spec.ts`).
- **BUG DE SEGURANÇA já encontrado e corrigido nesta fase** (detalhe
  completo em `docs/DECISIONS.md`, item 13): o gate de redefinição de senha
  podia reaproveitar uma sessão de OUTRA conta já ativa no mesmo browser em
  vez de processar o token do link, fazendo o formulário seguinte alterar a
  senha da conta errada. Corrigido: token no link sempre tem prioridade e
  sobrescreve qualquer sessão pré-existente.

### Onboarding de paciente

- `src/actions/onboarding.ts` (`invitePatientAction`) — núcleo mínimo, não a
  tela de gestão de pacientes (Fase 5). Sempre exige
  `requireNutritionist()` primeiro. Convite via
  `admin.auth.admin.inviteUserByEmail` (Admin API, `server-only`) — o
  nutricionista nunca define, vê ou envia a senha do paciente. Trata
  duplicidade (e-mail já vinculado → erro; paciente cadastrado manualmente
  sem login → vincula em vez de duplicar) e compensa (`deleteUser`) se o
  Auth user foi criado mas o vínculo em `patients` falhar.

### Sanitização de redirect (proteção contra open redirect)

- `src/lib/auth/redirect.ts` (`sanitizeRedirectPath`) é o único ponto do
  código que decide se um `?next=` é seguro — nunca reimplementar
  localmente. Aceita só path interno começando com uma única `/`; rejeita
  URL absoluta, protocol-relative (`//host`), `javascript:`/`data:`, e
  variantes com percent-encoding simples ou duplo que decodificam para
  qualquer um desses casos. Falha fechado (fallback) em qualquer
  ambiguidade, inclusive percent-encoding malformado. 12 testes unitários
  (`src/lib/auth/redirect.test.ts`) + 3 cenários E2E reais
  (`e2e/auth.spec.ts`).

### Rate limiting

- `src/lib/auth/rate-limiter.ts` (lógica pura) + `src/lib/auth/rate-limit.ts`
  (instâncias por fluxo, `server-only`): login (10 tentativas falhas/5min por IP+e-mail — um login válido zera o contador, Fase 6), esqueci-senha
  (5/15min), convite de paciente (20/hora), chave = IP + identificador.
  **Limitação documentada**: implementação em memória do processo — correta
  para dev local e um servidor Node único, não confiável sozinha em
  produção na Vercel (funções serverless não compartilham memória entre
  instâncias). Interface `RateLimiter` permite trocar por um store externo
  (ex.: Upstash Redis) sem mudar quem chama — não integrado ainda
  (`PENDENTE DE DEFINIÇÃO` antes da Fase 16/produção).

### CSRF

- Nenhuma biblioteca de CSRF token instalada — decisão explícita (prompt
  Fase 3 §32). Toda mutação desta fase é uma Server Action do Next.js, que
  já compara `Origin` com `Host`/`X-Forwarded-Host` e rejeita divergência
  (comportamento nativo do framework, confirmado no texto oficial embutido
  no pacote instalado). A única Route Handler de mutação potencial
  (`/auth/callback`) é `GET`, idempotente. Reavaliar se um fluxo de
  mutação via Route Handler `POST` custom for adicionado no futuro (ex.:
  webhook não teria esse problema por não usar cookie de sessão, mas uma
  eventual API pública mutável precisaria de análise própria).

## RLS (Row Level Security) — implementada na Fase 2

RLS habilitada em **todas** as ~34 tabelas de domínio (`supabase/migrations/`).
Três funções auxiliares `SECURITY DEFINER` (search_path fixo vazio, EXECUTE
restrito) resolvem a regra geral sem repetir subqueries em cada policy:

- `public.current_profile_role()` — role do usuário atual.
- `public.is_nutritionist_of_patient(patient_id)` — nutricionista responsável?
- `public.is_patient_self(patient_id)` — é o próprio paciente?
- `public.has_valid_media_consent(consent_id)` — consentimento existe e não
  foi revogado (usada pela policy pública de antes/depois, que precisa
  responder isso sem ter acesso direto a `media_consents`).

Padrão por tabela: nutricionista tem acesso total às linhas dos seus
pacientes; paciente só lê as próprias linhas (nunca escreve dado clínico,
com exceção de `read_at` em notificações/feedback); público só enxerga o que
está explicitamente marcado como público (`plans.publicly_visible`,
`blog_posts.status = PUBLISHED and published_at <= now()`,
`before_after_results.published and consentimento válido`). Nenhuma tabela
sensível usa `USING (true)` — os três `USING (true)` que existem no schema
são em `blocked_times`, `blog_categories` e `blog_tags`, todas
intencionalmente públicas e não-sensíveis.

**Teste crítico do IDOR** (paciente A não acessa dado do paciente B trocando
o ID) já implementado e passando:
`supabase/tests/database/030_rls_patient_isolation.test.sql` — cobre
appointments, cardápio, avaliação, feedback, atribuição de material e foto de
refeição, além de checar que um segundo nutricionista não vê pacientes de
outro. Rodar com `npm run test:db`.

## Prevenção de IDOR

- Nunca confiar em ID vindo do client para autorizar — toda query já filtra por
  `auth.uid()`/papel antes de considerar o ID da URL.
- Server actions revalidam propriedade do recurso (paciente pertence ao
  nutricionista logado; consulta pertence ao paciente logado) antes de mutar.
- **Implementado na Fase 5 (pacientes/contratos)**: páginas carregam o
  paciente com `getPatientById(nutritionist.id, id)` (id alheio ou
  inexistente → mesmo 404, sem revelar existência); actions recebem
  `patientId`/`contractId` como argumento vinculado no server
  (`action.bind(null, id)`) ou validado como UUID, e o service reconfere
  ownership (`requireOwnedPatient`/`requireOwnedContract`, checagem
  explícita de `nutritionist_id`) antes de qualquer escrita; as funções SQL
  de contrato são SECURITY INVOKER e checam `nutritionist_id = auth.uid()`
  — a RLS é a última camada, não a única. Schemas Zod descartam `role`,
  `profile_id`, `nutritionist_id`, `status`, `created_at` e ids internos
  (mass assignment). Testado em pgTAP (`070_*`), integração
  (`scripts/patients-integration-test.mjs`: Nutricionista B tenta ler,
  editar, desativar, criar contrato e cancelar contrato de paciente de A;
  PATIENT tenta inserir paciente/contrato/auditoria) e E2E.
- **Implementado na Fase 6 (agenda)**: o paciente é sempre derivado da
  sessão (`requirePatient()` → `patients.profile_id`), nunca de um
  `patient_id` do browser; `book_appointment`/`reschedule_appointment` no
  banco reconferem `is_patient_self`/`nutritionist_id = auth.uid()`; o
  trigger `validate_appointment_ownership` impede `nutritionist_id`
  adulterado e status privilegiado (COMPLETED/NO_SHOW/CONFIRMED) ou valor
  alterado por PATIENT mesmo via API direta; `busy_intervals` (SECURITY
  DEFINER) devolve só intervalos, sem paciente; consulta alheia é
  indistinguível de inexistente (`*_NOT_FOUND`). Fora da disponibilidade,
  dentro de bloqueio e passado são negados no servidor
  (`validate_booking_window`), não só escondidos na UI. Testado em pgTAP
  (`080_*`), integração (`scripts/scheduling-integration-test.mjs`: Paciente
  B x consulta de A, Nutri B x agenda de A, status/valor pelo paciente,
  bloqueio forjado, configuração alheia), concorrência real
  (`scripts/scheduling-concurrency-test.mjs`) e E2E.

## Concorrência / anti double-booking — implementada na Fase 2, exercitada pela Fase 6

Na Fase 6 toda criação/reagendamento passa por `book_appointment`/
`reschedule_appointment` e o INSERT continua protegido pela exclusion
constraint: `scripts/scheduling-concurrency-test.mjs` prova que dois
pacientes no mesmo slot, nutricionista + paciente, e dois reagendamentos
simultâneos para o mesmo destino terminam sempre com exatamente 1 sucesso e
1 recusa (23P01 → "Esse horário acabou de ser reservado"), com rollback
atômico do reagendamento recusado. A checagem de disponibilidade em memória
é só UX — o banco decide.

- Constraint `EXCLUDE USING gist` em `appointments` sobre
  `(nutritionist_id, tstzrange(starts_at, ends_at, '[)'))`, restrita a status
  que realmente ocupam a agenda (`SCHEDULED`, `CONFIRMED`, `COMPLETED`,
  `NO_SHOW` — `CANCELLED`/`RESCHEDULED` ficam de fora e liberam o horário).
  Consultas adjacentes (10–11 e 11–12) não conflitam graças ao intervalo
  meio-aberto `'[)'`.
- Teste real de concorrência (duas conexões `pg` separadas, não uma
  transação só): `scripts/db-concurrency-test.mjs`
  (`npm run test:db:concurrency`) — dois `INSERT` simultâneos para o mesmo
  horário resultam em exatamente 1 sucesso e 1 erro `23P01`
  (`exclusion_violation`), e o banco fica com exatamente 1 consulta ativa
  naquele intervalo.
- Camada de aplicação (Fase 6) deve tratar `23P01` como "horário já
  ocupado" e reoferecer horários livres — nunca reintentar a mesma gravação
  cegamente.

## Pagamentos e webhooks

- Pagamento só é `CONFIRMED` via webhook do gateway, nunca por resposta do
  frontend.
- Verificar assinatura do webhook antes de processar.
- Idempotência por `external_id` único (reenvio do mesmo evento não duplica
  `payments`/`financial_transactions`).
- Retry com backoff e logging seguro (nunca logar payload completo com dados de
  pagamento sensíveis).

## Storage — implementado na Fase 2

5 buckets (`supabase/migrations/20260913210069_storage_buckets.sql`):
`patient-documents`, `meal-photos`, `bioimpedance-reports`, `before-after`
(todos privados) e `blog` (público, só capas de post). Cada bucket privado
tem policy de `storage.objects` checando a tabela de domínio equivalente pelo
primeiro segmento do path (`public.safe_uuid()` faz o cast com tolerância a
path malformado, sem derrubar a policy).

`before-after` fica **privado mesmo com `published = true`** — a entrega
pública ao visitante anônimo é uma decisão deliberada de manter server-side
(signed URL gerada após checar `published` + `has_valid_media_consent`, na
Fase 14), em vez de expor isso via RLS de storage para `anon`: reduz a
superfície de risco em torno de um dado que exige consentimento explícito.

- Acesso via signed URL de curta duração, gerada server-side após checar
  autorização (Fase 14 para `before-after`; app pode usar Storage API
  diretamente para os buckets já com RLS de objeto nas demais).
- Paciente: só as próprias fotos/documentos. Nutricionista: só de pacientes
  sob sua gestão.
- Nunca bucket público para conteúdo de paciente.

## Conteúdo público — implementado na Fase 4

- Planos, blog, resultados e `site_settings` são lidos por um cliente
  **anônimo sem cookies** (`src/lib/supabase/public.ts`, anon key) — só o
  que a RLS `to anon` libera chega ao site. **Nunca service role** para
  renderizar conteúdo público (prompt Fase 4 §57); o único uso de service
  role fora de server actions autenticadas é em scripts de teste/bootstrap.
- Segunda camada em memória (`src/domain/*`): plano precisa de
  `active && publicly_visible`; post precisa de `PUBLISHED` com
  `published_at <= now()`; resultado só sai se `published` + consentimento
  válido (checado pela policy, o site não acessa `media_consents`).
- Rich text do blog é renderizado por conversão JSON → React
  (`src/components/blog/rich-content.tsx`), sem `dangerouslySetInnerHTML`;
  links só com `http(s)`, `mailto:` ou path relativo. JSON-LD é serializado
  com `<` escapado.
- Formulário de contato: validação Zod no server, honeypot e rate limit por
  IP (5/15 min); não envia nada ainda e diz isso na UI — nunca finge sucesso.
- `robots.ts` bloqueia `/dashboard`, `/paciente`, `/auth/` e as páginas de
  login/senha; `/login` e `/redefinir-senha` têm `noindex`.

## Proteção de aplicação

- Validação de input em toda fronteira (Zod) — client E server (nunca confiar
  só na validação do client).
- Rate limiting em endpoints públicos sensíveis — login/esqueci-senha/convite
  de paciente implementados na Fase 3 (ver seção "Rate limiting" acima);
  agendamento, contato e webhook ficam para as fases que os implementam.
- Proteção XSS: sanitizar conteúdo rich text (blog, cardápio, comentários)
  antes de renderizar; CSP nos headers.
- Queries sempre parametrizadas (Supabase client já protege contra SQL
  injection quando usado corretamente — nunca concatenar SQL cru com input do
  usuário).
- Headers de segurança padrão (HSTS, X-Frame-Options/frame-ancestors,
  X-Content-Type-Options, Referrer-Policy).
- Secrets (service role key, chaves de gateway de pagamento, credenciais de
  WhatsApp/e-mail) só em variáveis de ambiente server-side — nunca em código
  client, nunca em `NEXT_PUBLIC_*`.

## Auditoria — tabela implementada (Fase 2), escrita pela aplicação desde a Fase 5

`audit_logs` existe e é append-only: sem policy de UPDATE/DELETE para nenhum
papel, e os privilégios de UPDATE/DELETE são revogados de `anon`/
`authenticated` como defesa em profundidade (RLS sozinha já bloquearia, mas
a revogação de privilégio é uma segunda camada independente da RLS).

Desde a Fase 5 a aplicação registra (`src/services/audit.ts`, cliente de
sessão — a policy exige `actor_id = auth.uid()` e role NUTRITIONIST):
`PATIENT_CREATED`, `PATIENT_UPDATED`, `PATIENT_ARCHIVED`,
`PATIENT_REACTIVATED`, `PATIENT_INVITED`, `CONTRACT_CREATED`,
`CONTRACT_CANCELLED`, `CONTRACT_COMPLETED`; desde a Fase 7:
`FINANCIAL_TRANSACTION_CREATED`/`UPDATED`/`CANCELLED`, `PAYMENT_RECORDED`,
`INSTALLMENT_PAYMENT_APPLIED`, `PAYMENT_CANCELLED`; desde a Fase 8:
`MEAL_PLAN_CREATED`/`UPDATED`/`ARCHIVED`, `MEAL_PLAN_VERSION_CREATED`/
`PUBLISHED`/`DISCARDED`, `MEAL_DUPLICATED`, `MEAL_PLAN_DAY_DUPLICATED`
(só ids e o tipo de operação — nunca alimento, quantidade ou observação:
o E2E verifica que nenhum nome de alimento chega ao metadata); desde a
Fase 9: `ASSESSMENT_CREATED/UPDATED/PUBLISHED/UNPUBLISHED/ARCHIVED/DELETED`,
`BIOIMPEDANCE_REPORT_UPLOADED/REMOVED` (ids, contagem de métricas, mime e
tamanho — nunca peso, percentuais, circunferências, observações ou nome do
relatório; verificado no E2E). Metadata é o mínimo para
rastrear "quem fez o quê" — ids, NOMES dos campos alterados, código do
plano, valor/quantidade de parcelas — nunca e-mail, telefone, nascimento ou
qualquer dado clínico. Falta (fases futuras): avaliação, publicação de
antes/depois.

## Financeiro (Fase 7)

- `financial_transactions` tem ownership real por `nutritionist_id`
  (policies `_select_owner`/`_insert_owner`/`_update_owner`); a policy da
  Fase 2 que liberava leitura a qualquer nutricionista foi removida.
  Paciente não lê nem escreve lançamentos/pagamentos; nutricionista B não
  lê, edita, paga nem estorna dados de A (ids adulterados = "não existe").
- Pagamento manual só entra por `record_manual_payment` (SECURITY INVOKER,
  sob RLS): ownership do paciente/parcela/contrato/consulta reconferido no
  banco, valor > 0 e ≤ restante, idempotência por chave gerada no servidor.
  Estorno por `cancel_payment` — nunca UPDATE direto de status pela UI.
- DELETE revogado em `financial_transactions` e `payments`: cancelar e
  estornar são status com motivo, o histórico financeiro é preservado.
- Sem gateway/webhook/PIX automático nesta fase: nada é confirmado por
  resposta de frontend; o registro manual é uma ação autenticada do
  nutricionista, auditada.
- `returnTo` do formulário de pagamento só aceita caminho interno
  `/dashboard/...` (nunca URL externa); ids em rotas passam por `z.guid()`
  e ownership antes de qualquer query.

## Cardápio — dado pessoal de saúde (Fase 8)

- Paciente lê só versões `PUBLISHED` (RLS em cascata da Fase 2 + query do
  portal que ignora planos arquivados); rascunho e histórico nunca chegam
  ao portal. Paciente não escreve em nenhuma tabela do cardápio e não
  executa as funções de publicação/cópia (ownership dentro delas).
- Nutricionista só acessa planos dos próprios pacientes: RLS + ownership
  explícito no serviço em toda a cadeia (versão → dia → refeição → item →
  substituição), ids adulterados = "não encontrado".
- Mass assignment: `patient_id` vem da rota e é reconferido;
  `nutritionist_id`, `status`, `version_number`, `published_by`,
  `created_by` nunca vêm do client (funções SQL/triggers preenchem).
- Publicação atômica (`publish_meal_plan_version`, lock no plano): nunca
  zero ou duas versões publicadas; concorrência testada.
- Histórico imutável por trigger; nada é apagado exceto rascunho.
- Logs: erros não incluem conteúdo do plano; auditoria só com ids.
- Sem cache público/ISR nas rotas do cardápio (dashboard e portal são
  `force-dynamic`, privados, noindex). Nada é gravado em Storage.

## Avaliações e bioimpedância — dado pessoal de saúde (Fase 9)

- RLS: nutricionista só nos próprios pacientes; paciente só avaliações
  próprias **visíveis e não arquivadas** (tabelas e bucket, via helper
  SECURITY DEFINER). Paciente não escreve nem chama a função de medidas.
  `internal_notes` nunca é selecionada pelas queries do portal.
- Ownership no servidor em toda rota/action/route handler (paciente da
  rota → avaliação desse paciente); `patient_id` do portal vem da sessão;
  ids adulterados = "não encontrado"; `patient_id` imutável por trigger.
- Relatório: bucket privado `bioimpedance-reports`, path
  `<patient_id>/<assessment_id>/<uuid>.<ext>` validado por trigger, tipo
  conferido pela assinatura do arquivo, 10 MB, nome saneado; substituição
  remove o anterior; remoção limpa metadados antes de apagar o objeto.
  Download só por URL assinada de 60 s gerada server-side após checagem,
  com `Cache-Control: no-store`; nunca persistida, logada ou auditada.
- Sem service role. Sem OCR/IA/diagnóstico. Nada de valor de saúde em logs
  de aplicação (só mensagens técnicas) nem em `audit_logs.metadata`.
- Rotas privadas `force-dynamic`, sem ISR, noindex. IMC derivado só como
  número, sem faixa/interpretação.

## Clientes Supabase — implementados na Fase 2

`src/lib/supabase/client.ts` (browser, anon key), `server.ts` (Server
Components/Actions/Route Handlers, anon key + cookies de sessão via
`@supabase/ssr`) e `admin.ts` (service role, `import "server-only"` +
`getServerEnv()` — dupla proteção contra uso no browser). Os três entraram
em uso real na Fase 3 (login, sessão, onboarding) sem precisar de mudança —
a infraestrutura da Fase 2 já seguia o padrão correto. Tipos gerados em
`src/types/database.ts` via `npm run db:types`
(`supabase gen types typescript --local`) — nunca mantidos manualmente.

## Seed local e `auth.users`

`supabase/seed.sql` insere usuários fictícios diretamente em `auth.users`
(nutricionista + 2 pacientes, senha de dev fixa documentada no próprio
arquivo) para exercitar o vínculo `profiles.id references auth.users(id)` de
ponta a ponta. Só funciona no ambiente local (mesma instância que já expõe as
chaves de demonstração padrão do Supabase); nunca aplicado em produção.

## LGPD

Dados sensíveis no escopo deste produto: bioimpedância/evolução, cardápio,
comentários clínicos, fotos de refeição, materiais de acompanhamento.

Planejar (a detalhar em fase própria, não implementar ainda):
- Consentimento de tratamento de dados no cadastro do paciente.
- Consentimento específico e separado para uso de imagem (antes/depois) —
  `media_consents`, nunca reaproveitar o consentimento geral.
- Política de privacidade e termos de uso publicados no site.
- Auditoria (`audit_logs`) cobrindo ações sobre dado sensível.
- Retenção: definir por quanto tempo dados de paciente inativo ficam
  armazenados — **PENDENTE DE DEFINIÇÃO** (decisão de negócio, não técnica).
- Exportação de dados do titular (futuro).
- Anonimização/exclusão quando legalmente aplicável, sem quebrar integridade de
  registros financeiros que a lei exige manter (conflito a resolver caso a
  caso, não apagar cegamente).

## Timezone como preocupação de segurança/correção

Toda regra de disponibilidade, lembrete e vencimento depende do fuso
`America/Sao_Paulo` estar correto — um bug de timezone pode liberar horário
indisponível ou disparar lembrete no dia errado. Testes de timezone (Fase 15)
devem cobrir: criação de consulta perto da virada de dia, período de horário de
verão histórico (se relevante), e cron jobs de lembrete rodando em servidor UTC.
