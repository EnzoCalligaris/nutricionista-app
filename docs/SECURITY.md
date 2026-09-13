# SECURITY — Segurança e LGPD

## Autenticação e autorização

- Supabase Auth para login (site público e portal do paciente compartilham o
  mesmo provedor de identidade; papel determina o que cada um vê).
- Papéis: `NUTRITIONIST`, `PATIENT`, `ADMIN` (só se necessário). Papel vive em
  `profiles.role`, não em metadata livre editável pelo client.
- Toda autorização é validada no servidor (server actions / route handlers),
  nunca só no client. RLS é a segunda camada, não a única.
- Sem IDs hardcoded (nem "o nutricionista é sempre o usuário X" no código —
  resolver por `auth.uid()` + relação no banco).

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

## Concorrência / anti double-booking — implementada na Fase 2

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

## Proteção de aplicação

- Validação de input em toda fronteira (Zod) — client E server (nunca confiar
  só na validação do client).
- Rate limiting em endpoints públicos sensíveis (login, agendamento, contato,
  webhook).
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

## Auditoria — tabela implementada, escrita pela aplicação é Fase 5+

`audit_logs` existe e é append-only: sem policy de UPDATE/DELETE para nenhum
papel, e os privilégios de UPDATE/DELETE são revogados de `anon`/
`authenticated` como defesa em profundidade (RLS sozinha já bloquearia, mas
a revogação de privilégio é uma segunda camada independente da RLS). Falta
(fases futuras): a aplicação de fato registrar linhas em alteração de
pagamento/lançamento financeiro, contrato, consulta, avaliação, desativação
de paciente, publicação de antes/depois.

## Clientes Supabase — implementados na Fase 2

`src/lib/supabase/client.ts` (browser, anon key), `server.ts` (Server
Components/Actions/Route Handlers, anon key + cookies de sessão via
`@supabase/ssr`) e `admin.ts` (service role, `import "server-only"` +
`getServerEnv()` — dupla proteção contra uso no browser). Nenhum dos três é
usado ainda por nenhuma página (login/autenticação real é Fase 3) — só a
infraestrutura está pronta. Tipos gerados em `src/types/database.ts` via
`npm run db:types` (`supabase gen types typescript --local`) — nunca mantidos
manualmente.

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
