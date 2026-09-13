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

## RLS (Row Level Security)

Obrigatória em toda tabela com dado privado. Regra geral:
- Paciente: `USING (patient_id in (select id from patients where profile_id = auth.uid()))`
  (ou equivalente), nunca `USING (true)`.
- Nutricionista: `USING (nutritionist_id = auth.uid())` ou via join à tabela
  `patients` do próprio nutricionista.
- Público: só tabelas/linhas explicitamente marcadas como públicas (posts
  publicados, planos `publicly_visible`, resultados `published`).

Teste crítico obrigatório (Fase 15, mas desenhar desde já): **paciente A não
pode acessar dados do paciente B alterando URL/ID** — cobrir com teste
automatizado que autentica como paciente A e tenta ler/mutar recurso de B,
esperando 403/404 em toda rota e RLS-deny no banco.

## Prevenção de IDOR

- Nunca confiar em ID vindo do client para autorizar — toda query já filtra por
  `auth.uid()`/papel antes de considerar o ID da URL.
- Server actions revalidam propriedade do recurso (paciente pertence ao
  nutricionista logado; consulta pertence ao paciente logado) antes de mutar.

## Concorrência / anti double-booking

- Constraint `EXCLUDE USING gist` em `appointments` sobre
  `(nutritionist_id, tsrange(starts_at, ends_at))` — o banco recusa a segunda
  transação sobrepondo o mesmo horário, mesmo sob requisições simultâneas.
- Teste crítico (Fase 15): dois requests simultâneos para o mesmo
  horário → 1 sucesso, 1 conflito (409), validado com teste de carga/concorrência
  real (não só sequencial).

## Pagamentos e webhooks

- Pagamento só é `CONFIRMED` via webhook do gateway, nunca por resposta do
  frontend.
- Verificar assinatura do webhook antes de processar.
- Idempotência por `external_id` único (reenvio do mesmo evento não duplica
  `payments`/`financial_transactions`).
- Retry com backoff e logging seguro (nunca logar payload completo com dados de
  pagamento sensíveis).

## Storage privado

- Buckets privados para: fotos de refeição, materiais do paciente, fotos de
  antes/depois não publicadas, documentos de avaliação.
- Acesso via signed URL de curta duração, gerada server-side após checar
  autorização.
- Paciente: só as próprias fotos. Nutricionista: só fotos de pacientes sob sua
  administração.
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

## Auditoria

Registrar em `audit_logs`: alteração de pagamento/lançamento financeiro,
contrato, consulta, avaliação, desativação de paciente, publicação de
antes/depois, e demais ações administrativas relevantes. Append-only (sem
update/delete).

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
