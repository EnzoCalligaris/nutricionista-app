# DATABASE — Modelo de dados proposto

Convenções gerais: `id uuid default gen_random_uuid()` como PK em toda tabela;
`created_at timestamptz default now()`; `updated_at timestamptz` mantido por
trigger; soft delete (`deactivated_at`/`archived_at`) em vez de hard delete
sempre que houver histórico dependente (pacientes, contratos, consultas,
pagamentos); enums via `create type ... as enum` quando o conjunto de valores é
fechado e estável; FKs com `on delete restrict` por padrão (nunca cascade em
dados financeiros/clínicos) e índices em toda FK e em colunas de filtro
frequente (`nutritionist_id`, `patient_id`, `status`, datas).

## Entidades principais

### profiles
Estende `auth.users`. `id` (= auth.users.id), `role` (`NUTRITIONIST`|`PATIENT`|
`ADMIN`), `full_name`, `email`, `phone`, `avatar_url`, `created_at`.

### patients
`id`, `profile_id` (FK profiles, nullable até o paciente ter conta própria),
`nutritionist_id`, `full_name`, `birth_date`, `phone`, `email`, `status`
(`ACTIVE`|`INACTIVE`), `deactivated_at`, `created_at`.
Paciente pode existir antes de ter login (cadastro manual pelo nutricionista);
`profile_id` é vinculado quando o paciente ativa a conta.

### plans
`id`, `name`, `slug`, `duration_months` (nullable p/ avulsa), `sessions_in_person`,
`sessions_online`, `active`, `publicly_visible`, `available_for_sale`,
`created_at`. Preço não fica hardcoded aqui — ver `plan_prices`.

### plan_prices
`id`, `plan_id`, `label` (ex.: "à vista", "parcelado 3x"), `total_amount_cents`,
`installments`, `installment_amount_cents`, `valid_from`, `valid_to`.
Histórico de preço fica preservado; contrato referencia o preço vigente no
momento da assinatura (não recalcula se a tabela mudar depois).

### plan_benefits
`id`, `plan_id`, `label`, `sort_order`. Texto de benefício versionável em vez de
hardcoded no frontend — o nutricionista deve poder ajustar sem deploy (Fase 14:
tela de configurações).

### patient_contracts
`id`, `patient_id`, `plan_id`, `plan_price_id`, `start_date`, `end_date_expected`,
`status` (`ACTIVE`|`COMPLETED`|`CANCELLED`), `contracted_amount_cents`,
`created_at`. Um paciente pode ter múltiplos contratos ao longo do tempo
(histórico preservado, nunca sobrescrito).

### contract_installments
`id`, `contract_id`, `sequence`, `due_date`, `amount_cents`, `status`
(`PENDING`|`PAID`|`OVERDUE`|`CANCELLED`). Base para "previsão de recebimentos".

### payments
`id`, `contract_installment_id` (nullable — pagamento avulso não tem parcela),
`patient_id`, `amount_cents`, `method` (`PIX`|`CARD`|`CASH`|... enum
configurável), `status` (`PENDING`|`CONFIRMED`|`FAILED`|`REFUNDED`),
`external_provider`, `external_id`, `confirmed_at`, `created_at`.
`external_id` único por provider — chave de idempotência de webhook.

### financial_transactions
`id`, `type` (`INCOME`|`EXPENSE`), `category_id`, `description`, `amount_cents`,
`payment_method`, `status`, `origin` (`MANUAL`|`APPOINTMENT`|`PAYMENT`),
`origin_payment_id` (nullable, FK payments), `transaction_date`, `created_by`,
`created_at`.
Regra de não-duplicação: todo `payment.status = CONFIRMED` gera **exatamente
um** `financial_transaction` via trigger/serviço idempotente
(`origin_payment_id` com `unique`); nunca cadastrado manualmente em paralelo.

### financial_categories
`id`, `name`, `type` (`INCOME`|`EXPENSE`), `active`.

### appointments
`id`, `patient_id`, `nutritionist_id`, `starts_at` (timestamptz), `ends_at`,
`modality` (`IN_PERSON`|`ONLINE`), `status` (`SCHEDULED`|`CONFIRMED`|`DONE`|
`NO_SHOW`|`CANCELLED`|`RESCHEDULED`), `contract_id` (nullable — de qual contrato
essa sessão consome), `price_cents`, `created_at`.
**Constraint de não-sobreposição**: `EXCLUDE USING gist` sobre
`(nutritionist_id, tsrange(starts_at, ends_at))` — impede double booking no
nível do banco, não só na aplicação. Ver `docs/SECURITY.md §Concorrência`.

### availability_rules
`id`, `nutritionist_id`, `weekday`, `start_time`, `end_time`, `modality`,
`active`. Regras recorrentes de horário de trabalho.

### blocked_times
`id`, `nutritionist_id`, `starts_at`, `ends_at`, `reason` (férias, ausência,
compromisso), `created_at`.

### appointment_notes
`id`, `patient_id`, `appointment_id` (nullable), `author_id`, `content`,
`created_at`, `edited_at`. Comentários do nutricionista — nunca hard delete.

### meal_plans
`id`, `patient_id`, `nutritionist_id`, `title`, `current_version_id` (FK
meal_plan_versions, nullable), `created_at`.

### meal_plan_versions
`id`, `meal_plan_id`, `version_number`, `status` (`DRAFT`|`PUBLISHED`|
`ARCHIVED`), `published_at`, `created_by`, `created_at`. Paciente só enxerga a
versão com `status = PUBLISHED` mais recente.

### meal_plan_days
`id`, `version_id`, `weekday` (`MON`..`SUN`).

### meals
`id`, `day_id`, `name` (configurável — não enum fixo, tabela ou texto livre com
`sort_order`), `time_of_day` (nullable).

### meal_items
`id`, `meal_id`, `food_name`, `quantity`, `unit`, `calories`, `protein_g`,
`carbs_g`, `fat_g`, `fiber_g` (nullable), `instructions`, `notes`.

### meal_substitutions
`id`, `meal_item_id`, `substitute_food_name`, `quantity`, `unit`, `calories`,
`protein_g`, `carbs_g`, `fat_g`.

### bioimpedance_assessments
`id`, `patient_id`, `assessed_at`, `weight_kg` (nullable), `body_fat_pct`
(nullable), `lean_mass_kg` (nullable), `muscle_mass_kg` (nullable),
`body_water_pct` (nullable), `visceral_fat` (nullable), `bmi` (nullable),
`notes`, `created_by`. Todas as métricas nullable — não obrigar campo que o
profissional não usa.

### body_measurements
`id`, `assessment_id`, `site` (ex.: cintura, quadril, braço — configurável),
`value_cm`. Tabela separada em vez de colunas fixas, para suportar
circunferências variáveis sem migração a cada novo ponto de medida.

### supplement_recommendations
`id`, `patient_id`, `name`, `brand` (nullable), `guidance`, `schedule`, `notes`,
`purchase_url` (nullable), `image_url` (nullable), `status` (`ACTIVE`|
`DISCONTINUED`), `created_by`, `created_at`.

### feedback_messages
`id`, `patient_id`, `author_id`, `content`, `created_at`, `read_at` (nullable).

### patient_materials
`id`, `nutritionist_id`, `title`, `storage_path` (bucket privado), `mime_type`,
`created_at`.

### material_assignments
`id`, `material_id`, `patient_id`, `assigned_at`, `revoked_at` (nullable).
Revogar acesso = preencher `revoked_at`, não deletar (histórico de quem teve
acesso a quê).

### food_photo_analyses
`id`, `patient_id`, `storage_path` (bucket privado), `status` (`PENDING`|
`ANALYZED`|`CONFIRMED`|`FAILED`), `estimated_calories_min`,
`estimated_calories_max`, `estimated_macros_json`, `patient_corrections_json`
(nullable), `analyzed_at`, `created_at`. Nunca um campo "valor exato" —
sempre faixa/estimativa.

### notifications
`id`, `recipient_id`, `type`, `title`, `body`, `read_at` (nullable),
`created_at`. In-app.

### notification_events
`id`, `event_type` (`APPOINTMENT_CREATED`|`APPOINTMENT_REMINDER_5D`|...),
`related_entity_type`, `related_entity_id`, `created_at`. Fonte que dispara
deliveries.

### notification_deliveries
`id`, `event_id`, `channel` (`IN_APP`|`EMAIL`|`WHATSAPP`), `recipient`,
`status` (`PENDING`|`SENT`|`FAILED`), `provider_message_id`, `sent_at`,
`failed_at`, `retry_count`, `idempotency_key` (unique — evita reenvio
duplicado do mesmo evento no mesmo canal).

### blog_posts
`id`, `title`, `slug` (unique), `excerpt`, `cover_image_url`, `content`
(rich text/JSON), `category_id`, `author_id`, `status` (`DRAFT`|`PUBLISHED`|
`ARCHIVED`), `seo_title`, `meta_description`, `og_image_url`, `published_at`,
`created_at`.

### blog_categories
`id`, `name`, `slug`.

### blog_tags / blog_post_tags
`blog_tags(id, name, slug)`; `blog_post_tags(post_id, tag_id)` — N:N.

### before_after_results
`id`, `title`, `description`, `period_label`, `before_image_url`,
`after_image_url`, `published`, `media_consent_id` (FK obrigatória, not null
antes de permitir `published = true` — validar via constraint/trigger, não só
na aplicação).

### media_consents
`id`, `patient_id`, `consent_type` (`BEFORE_AFTER_PHOTOS`|...), `granted_at`,
`revoked_at` (nullable), `document_reference` (nullable). Consentimento
específico de uso de imagem, separado do consentimento geral de tratamento de
dados (LGPD).

### site_settings
`id` (singleton ou chave/valor), `key`, `value_json`. Configurações editáveis
pelo dashboard (ex.: periodicidade padrão de presencial no semestral, textos de
pilares, dados de contato) em vez de hardcoded no frontend.

### audit_logs
`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata_json`,
`created_at`. Alvo: alteração de pagamento/financeiro, contrato, consulta,
avaliação, desativação de paciente, publicação de antes/depois, ações
administrativas relevantes.

## Índices e constraints críticas

- `appointments`: exclusion constraint anti-overlap por `nutritionist_id`
  (double booking).
- `payments.external_id` + `external_provider`: `unique` (idempotência de
  webhook).
- `financial_transactions.origin_payment_id`: `unique` quando não nulo (evita
  duplicar lançamento).
- `notification_deliveries.idempotency_key`: `unique`.
- `before_after_results`: `check (published = false or media_consent_id is not null)`.
- `contract_installments`: `unique(contract_id, sequence)`.
- `blog_posts.slug`, `blog_categories.slug`, `blog_tags.slug`: `unique`.

## RLS — princípios (detalhe em SECURITY.md)

- `patients`, `appointments`, `meal_plans*`, `bioimpedance_assessments`,
  `body_measurements`, `supplement_recommendations`, `feedback_messages`,
  `patient_materials`/`material_assignments`, `food_photo_analyses`,
  `payments`, `patient_contracts`, `contract_installments`: paciente só lê/edita
  linhas onde `patient_id` resolve para o seu próprio `profile_id`;
  nutricionista só lê/edita linhas onde `nutritionist_id = auth.uid()` (direto
  ou via join em `patients`).
- `blog_posts` (published), `before_after_results` (published), `plans`
  (publicly_visible), `site_settings` (chaves públicas): leitura pública
  liberada, escrita restrita a `NUTRITIONIST`/`ADMIN`.
- `audit_logs`: leitura restrita a `ADMIN`/`NUTRITIONIST` dono da ação;
  sem update/delete por ninguém (append-only).
