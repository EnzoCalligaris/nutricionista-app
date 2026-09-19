# Graph Report - nutricionista-app  (2026-09-19)

## Corpus Check
- 418 files · ~228,543 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2692 nodes · 8317 edges · 161 communities (139 shown, 22 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 208 edges (avg confidence: 0.89)
- Token cost: 331,603 input · 0 output

## Community Hubs (Navigation)
- Dashboard Pages & Auth Session
- Scheduling Actions & Services
- Form Components & States
- Layouts, Sidebar & Navigation Shell
- Meal Plan Structure & Data
- Action Menus & Dialogs
- Tables & List Pages
- Meal Plan Services
- Date Utils & Agenda Views
- Meal Plan Validators
- Finance & Agenda Form Pages
- Meal Plan Editor Actions
- Env, Supabase Clients & Proxy
- Blog Data & Visibility
- Meal Plan Management SQL
- Meal Plan Definitions & View
- Assessment Services & Domain Errors
- Architecture Layers & Conventions
- Nav Items & Blog Dashboard
- Package Scripts
- Patient Portal Pages
- Summary Cards & Overview
- Scheduling State Machine & Booking Flow
- Periods, Calendar & Installments
- Agenda Calendar Views
- Assessment Evolution & Trends
- Dialog & Avatar UI
- Assessment Actions & Validators
- Plans Pricing & Plan Cards
- Root Layout & Legal Pages
- Financial Rules & Views (docs)
- Meal Plans SQL Schema
- Patient Validators & Filters
- Assessment Numbers & Patient Evolution
- Patient & Finance Services
- Tooling Config (ESLint/Vitest)
- Método EM Marketing Content
- shadcn components.json
- Blog Rich Content
- Marketing Sections & Public Pages
- Finance Definitions & Badges
- Financial SQL Schema
- Future Modules: AI, Supplements, CMS (docs)
- Non-negotiable Rules & Privacy (docs)
- Scheduling Management SQL
- Meal Plan Editor Forms
- Site Settings & Contact Pages
- Contract Validators & Form
- Scheduling Intervals & Slots
- Timezone & Booking Window Rules (docs)
- Package Dependencies
- Contract & Patient Booking Actions
- Availability Rules & Editor
- Scheduling SQL Schema
- tsconfig
- Assessments Model & Report Bucket (docs)
- Financial Management SQL
- Supplements, Feedback & Materials SQL
- Assessment Metrics & Form
- Patient Detail Page & Section Nav
- Finance Validators
- E2E Specs (Scheduling/Auth/Smoke)
- Scheduling Domain & DB Functions (docs)
- Package Dev Dependencies
- Auth Validators & Rate Limit
- Patient Status & Portal Access
- Contracts Data & Services
- Patients Data & Metrics
- Next.js App Router & Supabase Stack (docs)
- Plans Catalog & Pricing Decisions (docs)
- Assessments Integration Test
- Scheduling Integration Test
- Profiles, Roles & Service Role (docs)
- Meal Plan Versioning & Immutability (docs)
- Patient Actions
- Loading Skeletons
- Financial Data Queries
- Timezone Utilities
- Anti-Double-Booking & DB Tests (docs)
- Providers, Webhooks & Notifications (docs)
- Financial Integration Test
- Scheduling Concurrency Test
- Screenshots Fase 6
- Screenshots Fase 9
- Assessments SQL Schema
- Brand, Audit & Roadmap Tail (docs)
- Assessment Management SQL
- Screenshots Fase 8
- Contact Form Actions
- Meal Plans Integration Test
- Appointments Data
- Plans SQL Schema
- Blog SQL Schema
- E2E Assessments Spec
- Contracts SQL Schema
- Patients SQL Schema
- Screenshots Fase 5
- Finance Charts
- Patients Integration Test
- Finance Actions
- Patient Status Domain
- Results & Consent SQL
- Notifications SQL
- Auth Error Mapping
- Finance Installments Domain
- Rate Limiter
- Patients & Contracts Management SQL
- E2E Meal Plans Spec
- Screenshots Fase 7
- Contract Status Domain
- Payments Data
- Plan Visibility Domain
- Profiles SQL
- E2E Finance Spec
- E2E Patients Spec
- Auth Redirect & Callback
- Reset Password Gate
- Finance Summary Domain
- Onboarding & Invites
- Evolution Charts
- Financial Views SQL
- Auth Integration Test
- DB Concurrency Test
- Patient Timeline Domain
- RLS Helper Functions SQL
- Food Photo Analyses SQL
- Audit Log SQL
- Horizontal Logo Asset
- Monogram Badge Asset
- About Photo
- OG Share Image
- Public Content Integration Test
- Auth Profile Provisioning SQL
- Consultation B&W Photo
- Assessment Photo
- Consultation Photo
- Hero Photo
- Pagination Component
- Site Settings SQL
- Password Reset Security Bug (docs)
- Vitest Config
- Payment Form
- Patient Profile RLS Fix SQL
- Next Config
- PostCSS Config

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 135 edges
2. `next` - 131 edges
3. `requireNutritionist()` - 123 edges
4. `domainErrorFromDatabase()` - 119 edges
5. `Button()` - 79 edges
6. `lucide-react` - 72 edges
7. `domainErrorMessage()` - 71 edges
8. `react` - 65 edges
9. `Card()` - 63 edges
10. `CardContent()` - 63 edges

## Surprising Connections (you probably didn't know these)
- `Critérios de entrada por fase (aprovação explícita)` --semantically_similar_to--> `Não avançar de fase sem autorização explícita`  [INFERRED] [semantically similar]
  docs/ROADMAP.md → CLAUDE.md
- `Fuso America/Sao_Paulo sempre` --conceptually_related_to--> `Timezone como preocupação de segurança/correção`  [INFERRED]
  CLAUDE.md → docs/SECURITY.md
- `Views do Postgres não expõem FK para o PostgREST` --semantically_similar_to--> `PostgREST não infere relação de view para tabela`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/DECISIONS.md
- `Consulta nunca gera receita automática` --semantically_similar_to--> `Fase 7: consulta nunca gera receita automática`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/DECISIONS.md
- `Nunca inventar dados (PENDENTE DE DEFINIÇÃO)` --conceptually_related_to--> `PENDENTE DE DEFINIÇÃO (marcador de informação ausente)`  [INFERRED]
  CLAUDE.md → docs/DECISIONS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Regras inegociáveis do projeto (CLAUDE.md)** — claude_regras_inegociaveis, claude_nunca_inventar_dados, claude_prompt_sobre_pdf, claude_service_role_server_only, claude_rls_obrigatoria, claude_fuso_america_sao_paulo, claude_double_booking_proibido, claude_pagamento_webhook_server_side, claude_ia_sempre_estimativa, claude_storage_privado, claude_dado_real_por_migration, claude_security_definer_para_rls [EXTRACTED 1.00]
- **Fluxo de agendamento e anti-double-booking no banco** — docs_database_appointments, docs_database_appointments_no_overlap, docs_database_book_appointment, docs_database_reschedule_appointment, docs_database_validate_booking_window, docs_database_busy_intervals, docs_database_validate_appointment_ownership, docs_database_blocked_times, docs_database_availability_rules, docs_database_scheduling_settings, docs_database_db_concurrency_test [EXTRACTED 1.00]
- **Ledger financeiro (contrato → parcela → pagamento → lançamento)** — docs_database_patient_contracts, docs_database_contract_installments, docs_database_payments, docs_database_financial_transactions, docs_database_record_manual_payment, docs_database_cancel_payment, docs_database_contract_financial_summary, docs_database_idempotencia_financeira [EXTRACTED 1.00]

## Communities (161 total, 22 thin omitted)

### Community 0 - "Dashboard Pages & Auth Session"
Cohesion: 0.06
Nodes (66): next, dynamic, metadata, dynamic, metadata, dynamic, metadata, dynamic (+58 more)

### Community 1 - "Scheduling Actions & Services"
Cohesion: 0.07
Nodes (61): cancelAppointmentAction(), changeAppointmentStatusAction(), createAppointmentAction(), createBlockedTimeAction(), errorMessage(), fieldErrorsFrom(), getSlotsForDateAction(), removeBlockedTimeAction() (+53 more)

### Community 2 - "Form Components & States"
Cohesion: 0.10
Nodes (40): cn, react, FinanceFormState, SchedulingFormState, searchPatientsAction(), initialState, initialState, initialState (+32 more)

### Community 3 - "Layouts, Sidebar & Navigation Shell"
Cohesion: 0.06
Nodes (37): DashboardLayout(), PatientLayout(), revalidate, DashboardHeader(), DashboardSidebar(), MobileNav(), PatientHeader(), PatientSidebar() (+29 more)

### Community 4 - "Meal Plan Structure & Data"
Cohesion: 0.07
Nodes (46): dynamic, metadata, VersaoPlanoPage(), MealPlanEditor(), PatientMealPlanSection(), getMealPlanVersion(), MealPlanSummary, MealPlanVersionFull (+38 more)

### Community 5 - "Action Menus & Dialogs"
Cohesion: 0.12
Nodes (28): sonner, ActionResult, Pending, PendingAction, describe(), PaymentsList(), Pending, PendingAction (+20 more)

### Community 6 - "Tables & List Pages"
Cohesion: 0.10
Nodes (37): AvaliacoesPage(), dynamic, metadata, CardapiosPage(), dynamic, metadata, AvaliacaoPage(), dynamic (+29 more)

### Community 7 - "Meal Plan Services"
Cohesion: 0.14
Nodes (51): getAppointmentNotes(), getRescheduleOrigin(), listAssessmentOverview(), getDayOwner(), getMealItemOwner(), getMealOwner(), getMealPlanById(), getSubstitutionOwner() (+43 more)

### Community 8 - "Date Utils & Agenda Views"
Cohesion: 0.08
Nodes (40): ConsultaPage(), dynamic, metadata, PAYMENT_LABEL, ReagendarConsultaPage(), dynamic, metadata, dynamic (+32 more)

### Community 9 - "Meal Plan Validators"
Cohesion: 0.09
Nodes (35): MealPlanFormState, optionalNumber(), parseItemInput(), parseSubstitutionInput(), parseQuantity(), addDaySchema, CreateMealPlanInput, createMealPlanSchema (+27 more)

### Community 10 - "Finance & Agenda Form Pages"
Cohesion: 0.09
Nodes (34): firstParam(), NovoBloqueioPage(), AgendaConfiguracoesPage(), EditarConsultaPage(), firstParam(), NovaConsultaPage(), EditarLancamentoPage(), NovoLancamentoPage() (+26 more)

### Community 11 - "Meal Plan Editor Actions"
Cohesion: 0.18
Nodes (36): addDayAction(), addMealAction(), addMealItemAction(), addSubstitutionAction(), archiveMealPlanAction(), createMealPlanAction(), createVersionAction(), discardVersionAction() (+28 more)

### Community 12 - "Env, Supabase Clients & Proxy"
Cohesion: 0.11
Nodes (24): server-only, @supabase/ssr, clientSchema, env, getServerEnv(), ServerEnv, serverOnlySchema, createAdminClient() (+16 more)

### Community 13 - "Blog Data & Visibility"
Cohesion: 0.12
Nodes (24): BlogPage(), metadata, generateMetadata(), HomePage(), ResultadosPage(), sitemap(), STATIC_ROUTES, getPublishedPostBySlug (+16 more)

### Community 14 - "Meal Plan Management SQL"
Cohesion: 0.11
Nodes (28): public.guard_meal_plan, public.guard_meal_plan_content, public.guard_meal_plan_version, public.meal_items, public.meal_plan_days, public.meal_plan_versions, public.meal_plans, public.meal_substitutions (+20 more)

### Community 15 - "Meal Plan Definitions & View"
Cohesion: 0.11
Nodes (26): class-variance-authority, NutrientLine(), ItemView(), MealCard(), MealPlanView(), nutrientLine(), Tabs(), TabsContent() (+18 more)

### Community 16 - "Assessment Services & Domain Errors"
Cohesion: 0.14
Nodes (27): AssessmentDetail, getAssessmentById(), getVisibleAssessment(), listPatientAssessments(), listVisibleAssessments(), PatientAssessmentOverview, Row, toDetail() (+19 more)

### Community 17 - "Architecture Layers & Conventions"
Cohesion: 0.11
Nodes (30): QA visual obrigatório com screenshots reais, Views do Postgres não expõem FK para o PostgREST, src/actions (Server Actions), src/data (queries Supabase), src/domain (regras puras, sem I/O), src/services (casos de uso, ownership, auditoria), src/validators (schemas Zod), Cliente Supabase anônimo (src/lib/supabase/public.ts) (+22 more)

### Community 18 - "Nav Items & Blog Dashboard"
Cohesion: 0.12
Nodes (6): lucide-react, DashboardNavItem, dashboardNavItems, PatientNavItem, patientNavItems, ComingSoon()

### Community 19 - "Package Scripts"
Cohesion: 0.07
Nodes (29): scripts, bootstrap:nutritionist, build, db:reset, db:start, db:stop, db:types, dev (+21 more)

### Community 20 - "Patient Portal Pages"
Cohesion: 0.14
Nodes (24): dynamic, firstParam(), metadata, PatientAgendarPage(), dynamic, metadata, MeuCardapioPage(), dynamic (+16 more)

### Community 21 - "Summary Cards & Overview"
Cohesion: 0.14
Nodes (17): CardSpec, FinanceSummaryCards(), PatientMetricsCards(), PatientOverviewSection(), Props, PatientTable(), Props, PatientStatusBadge() (+9 more)

### Community 22 - "Scheduling State Machine & Booking Flow"
Cohesion: 0.11
Nodes (25): BookingFlow(), initialState, Props, APPOINTMENT_BLOCK_CLASS, Props, TimeGrid(), availabilityWindowsForDate(), itemsForDate() (+17 more)

### Community 23 - "Periods, Calendar & Installments"
Cohesion: 0.19
Nodes (20): vitest, generateDueDates(), generateInstallments(), InstallmentDraft, MAX_INSTALLMENTS, splitAmountCents(), sumInstallments(), firstDayOfMonth() (+12 more)

### Community 24 - "Agenda Calendar Views"
Cohesion: 0.18
Nodes (23): AgendaPage(), dynamic, firstParam(), metadata, agendaHref(), AgendaToolbar(), title(), VIEWS (+15 more)

### Community 25 - "Assessment Evolution & Trends"
Cohesion: 0.14
Nodes (21): ComparisonTable(), PatientAssessmentsSection(), DEFAULT_CODES, DirectionTag(), AssessmentSummary, canHardDelete(), compareAssessments(), deltaBetween() (+13 more)

### Community 26 - "Dialog & Avatar UI"
Cohesion: 0.13
Nodes (13): radix-ui, logoutAction(), LogoutMenuItem(), Avatar(), AvatarFallback(), Dialog(), DialogContent(), DialogDescription() (+5 more)

### Community 27 - "Assessment Actions & Validators"
Cohesion: 0.16
Nodes (21): archiveAssessmentAction(), createAssessmentAction(), deleteAssessmentAction(), errorMessage(), parseAssessmentForm(), removeReportAction(), revalidateAssessments(), setVisibilityAction() (+13 more)

### Community 28 - "Plans Pricing & Plan Cards"
Cohesion: 0.13
Nodes (19): PlanCard(), planMeta(), avulsa, trimestral, DASHBOARD_ORDER, DashboardPlan, DashboardPlanPrice, PlanBenefitRow (+11 more)

### Community 29 - "Root Layout & Legal Pages"
Cohesion: 0.11
Nodes (15): src_app_globals, fontHeading, fontMono, fontSans, metadata, metadata, PrivacidadePage(), metadata (+7 more)

### Community 30 - "Financial Rules & Views (docs)"
Cohesion: 0.19
Nodes (25): APPOINTMENT_CHARGE_POLICY, Consulta nunca gera receita automática, Dinheiro sempre inteiro em centavos, Status do projeto (Fases 0 a 9 concluídas), src/domain/finance, cancel_payment(), View contract_financial_summary / installment_payment_summary, contract_installments (+17 more)

### Community 31 - "Meal Plans SQL Schema"
Cohesion: 0.14
Nodes (24): public.validate_meal_plan_nutritionist, meal_items_meal_id_idx, meal_plan_versions_meal_plan_id_idx, meal_plan_versions_one_published_per_plan, meal_plans_patient_id_idx, meal_substitutions_meal_item_id_idx, meals_day_id_idx, public.meal_items (+16 more)

### Community 32 - "Patient Validators & Filters"
Cohesion: 0.12
Nodes (19): dynamic, firstParam(), metadata, PacientesPage(), PatientFilters(), getPatientMetrics(), todayISO(), birthDateSchema (+11 more)

### Community 33 - "Assessment Numbers & Patient Evolution"
Cohesion: 0.18
Nodes (20): dynamic, metadata, MinhaEvolucaoPage(), AssessmentForm(), AssessmentHistory(), metricCell(), muscleOrLean(), MetricLineChart() (+12 more)

### Community 34 - "Patient & Finance Services"
Cohesion: 0.20
Nodes (22): TransactionActions(), isTransactionCancellable(), isTransactionEditable(), canArchivePatient(), canReactivatePatient(), createAssessment(), recordAudit(), cancelManualTransaction() (+14 more)

### Community 35 - "Tooling Config (ESLint/Vitest)"
Cohesion: 0.09
Nodes (20): eslintConfig, name, private, version, eslint, eslint-config-next, jsdom, react-dom (+12 more)

### Community 36 - "Método EM Marketing Content"
Cohesion: 0.17
Nodes (15): metadata, metadata, AboutPreview(), MethodPhases(), PHASE_IMAGES, Pillars(), ResultsList(), ABOUT (+7 more)

### Community 37 - "shadcn components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 38 - "Blog Rich Content"
Cohesion: 0.16
Nodes (16): @testing-library/react, BlogPostPage(), Props, PostCard(), isNode(), Mark, Node, renderChildren() (+8 more)

### Community 39 - "Marketing Sections & Public Pages"
Cohesion: 0.20
Nodes (15): AcompanhamentoPage(), metadata, STEPS, metadata, PlanosPage(), metadata, metadata, SobrePage() (+7 more)

### Community 40 - "Finance Definitions & Badges"
Cohesion: 0.13
Nodes (19): FinancialTypeBadge(), INSTALLMENT_CLASS, InstallmentBalanceBadge(), OriginText(), PAYMENT_CLASS, PaymentStatusBadge(), TransactionStatusBadge(), TX_STATUS_CLASS (+11 more)

### Community 41 - "Financial SQL Schema"
Cohesion: 0.15
Nodes (20): financial_transactions_category_id_idx, financial_transactions_occurred_on_idx, financial_transactions_origin_payment_id_idx, payments_contract_id_idx, payments_installment_id_idx, payments_patient_id_idx, payments_provider_external_id_idx, public.financial_categories (+12 more)

### Community 42 - "Future Modules: AI, Supplements, CMS (docs)"
Cohesion: 0.19
Nodes (20): IA de refeição sempre estimativa, nunca prescreve, FoodAnalysisProvider (abstração), Bucket meal-photos (privado), Bucket patient-documents (privado), food_photo_analyses, supplement_recommendations / feedback_messages / patient_materials / material_assignments, Blog / CMS próprio, Configurações (+12 more)

### Community 43 - "Non-negotiable Rules & Privacy (docs)"
Cohesion: 0.16
Nodes (20): Nunca inventar dados (PENDENTE DE DEFINIÇÃO), Prompt tem prioridade sobre o PDF, Regras inegociáveis, RLS obrigatória em tabela sensível, Policy cross-table via função SECURITY DEFINER, Fotos em storage privado + consentimento de imagem, before_after_results, blog_posts / blog_categories / blog_tags (+12 more)

### Community 44 - "Scheduling Management SQL"
Cohesion: 0.13
Nodes (19): public.availability_rules, public.blocked_times, public.validate_appointment_ownership, public.validate_blocked_time_conflicts, public.book_appointment(), public.busy_intervals(), public.reschedule_appointment(), public.scheduling_settings (+11 more)

### Community 45 - "Meal Plan Editor Forms"
Cohesion: 0.15
Nodes (15): EditorResult, MealItemFormInput, SubstitutionFormInput, EMPTY_ITEM, EMPTY_SUBSTITUTION, FieldErrors, ItemForm(), MealForm() (+7 more)

### Community 46 - "Site Settings & Contact Pages"
Cohesion: 0.26
Nodes (14): AgendarPage(), metadata, ContatoPage(), metadata, PublicFooter(), getContactInfo, getPublicSiteSettings, ContactInfo (+6 more)

### Community 47 - "Contract Validators & Form"
Cohesion: 0.14
Nodes (18): centsToInput(), ContractForm(), changeStartDate(), selectPlan(), selectPrice(), suggestEndDate(), isValidISODate(), cancelContractSchema (+10 more)

### Community 48 - "Scheduling Intervals & Slots"
Cohesion: 0.21
Nodes (13): contains(), Interval, isAdjacent(), mergeIntervals(), overlaps(), subtractIntervals(), BusyIntervalInput, generateSlots() (+5 more)

### Community 49 - "Timezone & Booking Window Rules (docs)"
Cohesion: 0.19
Nodes (19): Fuso America/Sao_Paulo sempre, Não avançar de fase sem autorização explícita, timestamptz (UTC) + conversão só na apresentação, availability_rules, scheduling_settings, validate_booking_window(), Comunidade VIP (PENDENTE), Decisões que precisam ser configuráveis (+11 more)

### Community 50 - "Package Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-config-next, jsdom, pg, @playwright/test, supabase, tailwindcss (+11 more)

### Community 51 - "Contract & Patient Booking Actions"
Cohesion: 0.16
Nodes (16): cancelContractAction(), completeContractAction(), ContractFormState, createContractAction(), errorMessage(), FIELD_KEYS, bookAppointmentAction(), BookingFormState (+8 more)

### Community 52 - "Availability Rules & Editor"
Cohesion: 0.13
Nodes (14): AvailabilityEditor(), save(), MonthView(), Props, BlockedTime, AvailabilityRuleDraft, AvailabilityValidationError, sortAvailabilityRules() (+6 more)

### Community 53 - "Scheduling SQL Schema"
Cohesion: 0.19
Nodes (18): appointment_notes_appointment_id_idx, appointment_notes_patient_id_idx, appointments_contract_id_idx, appointments_patient_id_starts_at_idx, availability_rules_nutritionist_id_idx, blocked_times_nutritionist_id_starts_at_idx, public.appointment_notes, public.appointments (+10 more)

### Community 54 - "tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 55 - "Assessments Model & Report Bucket (docs)"
Cohesion: 0.25
Nodes (18): src/domain/assessments, assessment_measurements, assessment_visible_to_patient() (helper SECURITY DEFINER), assessments, Avaliações flexíveis (catálogo + valor, não colunas fixas), Bucket bioimpedance-reports (privado), measurement_types, set_assessment_measurements() (+10 more)

### Community 56 - "Financial Management SQL"
Cohesion: 0.23
Nodes (16): public.financial_transactions, public.guard_financial_transaction, financial_transactions_nutritionist_occurred_idx, financial_transactions_patient_id_idx, guard_financial_transactions, payments_idempotency_key_idx, public.cancel_payment(), public.contract_financial_summary (+8 more)

### Community 57 - "Supplements, Feedback & Materials SQL"
Cohesion: 0.18
Nodes (16): public.prevent_feedback_tampering_by_patient, feedback_messages_patient_id_idx, material_assignments_material_id_idx, material_assignments_patient_id_idx, patient_materials_nutritionist_id_idx, prevent_feedback_messages_tampering, public.feedback_messages, public.material_assignments (+8 more)

### Community 58 - "Assessment Metrics & Form"
Cohesion: 0.20
Nodes (15): AssessmentFormState, AssessmentFormInitial, initialState, MetricField(), AssessmentKind, DISPLAY_ORDER, groupMetricTypes(), inferKind() (+7 more)

### Community 59 - "Patient Detail Page & Section Nav"
Cohesion: 0.18
Nodes (15): dynamic, firstParam(), metadata, PacientePage(), PatientContractsSection(), PatientPlaceholderSection(), summaryFor(), parsePatientSection() (+7 more)

### Community 60 - "Finance Validators"
Cohesion: 0.14
Nodes (14): MAX_AMOUNT_CENTS, amountCentsSchema, cancelPaymentSchema, cancelTransactionSchema, financialTypeSchema, ManualTransactionInput, manualTransactionSchema, paymentIdSchema (+6 more)

### Community 61 - "E2E Specs (Scheduling/Auth/Smoke)"
Cohesion: 0.12
Nodes (7): NUTRITIONIST, PATIENT, DATE, NUTRITIONIST, PATIENT, STARTED_AT, @playwright/test

### Community 62 - "Scheduling Domain & DB Functions (docs)"
Cohesion: 0.23
Nodes (16): src/domain/scheduling (slots, máquina de estados), appointment_notes, appointments, blocked_times, book_appointment(), busy_intervals(), reschedule_appointment(), Trigger validate_appointment_ownership (+8 more)

### Community 63 - "Package Dev Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, class-variance-authority, cn, lucide-react, next, radix-ui, react, react-dom (+8 more)

### Community 64 - "Auth Validators & Rate Limit"
Cohesion: 0.18
Nodes (13): ForgotPasswordState, LoginState, ResetPasswordState, forgotPasswordRateLimiter, loginRateLimiter, ForgotPasswordInput, forgotPasswordSchema, InvitePatientInput (+5 more)

### Community 65 - "Patient Status & Portal Access"
Cohesion: 0.16
Nodes (12): CONTRACT_STATUS_CLASS, INSTALLMENT_STATUS_CLASS, PATIENT_STATUS_CLASS, PORTAL_ACCESS_CLASS, PortalAccessBadge(), ContractStatus, derivePortalAccess(), PORTAL_ACCESS_DESCRIPTION (+4 more)

### Community 66 - "Contracts Data & Services"
Cohesion: 0.17
Nodes (14): ContractFinancials, ContractInstallment, ContractQueryRow, getContractForOwnership(), getPatientContracts(), InstallmentBalanceRow, SummaryRow, toContract() (+6 more)

### Community 67 - "Patients Data & Metrics"
Cohesion: 0.17
Nodes (13): getPatientOverview(), listPatients(), OverviewRow, PatientAuditEvent, PatientListResult, PatientMetrics, PatientPaymentRow, PatientRow (+5 more)

### Community 68 - "Next.js App Router & Supabase Stack (docs)"
Cohesion: 0.22
Nodes (15): Next.js agent rules (ler docs em node_modules/next/dist/docs), Next.js 16 App Router, src/proxy.ts (proteção de rota), requireNutritionist() / requirePatient(), /dashboard e /paciente como segmentos de rota reais, Supabase (Postgres + Auth + Storage + RLS), CSRF coberto pela proteção nativa de Server Actions, Proteção em camadas (proxy + layouts + RLS) (+7 more)

### Community 69 - "Plans Catalog & Pricing Decisions (docs)"
Cohesion: 0.21
Nodes (15): Dado real por migration, fictício por seed.sql, supabase/migrations (schema por migration), patient_contracts, plans / plan_prices / plan_benefits, Catálogo real de planos por migration, não seed, Consulta avulsa R$ 230, Plano anual (não vendido publicamente), Plano semestral (6 presenciais + 5 online) (+7 more)

### Community 70 - "Assessments Integration Test"
Cohesion: 0.22
Nodes (14): api(), check(), cleanup(), main(), NUTRI_A, NUTRI_B, PATIENT_A, PATIENT_B (+6 more)

### Community 71 - "Scheduling Integration Test"
Cohesion: 0.25
Nodes (14): check(), cleanup(), main(), nextSaturday(), nextWeekday(), NUTRI_A, NUTRI_B, PATIENT_A (+6 more)

### Community 72 - "Profiles, Roles & Service Role (docs)"
Cohesion: 0.25
Nodes (13): Service role key nunca chega ao browser, Trigger handle_new_auth_user (provisionamento de profile), profiles, ADMIN só no enum, sem uso ativo, Role default sempre PATIENT (trigger handle_new_auth_user), Papéis NUTRITIONIST / PATIENT / ADMIN, Clientes Supabase (client / server / admin), Proteção contra role escalation (prevent_role_change, profiles_insert_self) (+5 more)

### Community 73 - "Meal Plan Versioning & Immutability (docs)"
Cohesion: 0.25
Nodes (14): src/domain/meal-plans, Triggers de imutabilidade do cardápio, meal_plan_versions, meal_plans, meal_plan_days / meals / meal_items / meal_substitutions, publish_meal_plan_version() e funções de cardápio, Concorrência otimista por updated_at, Histórico do cardápio imutável por trigger (+6 more)

### Community 74 - "Patient Actions"
Cohesion: 0.25
Nodes (12): archivePatientAction(), createPatientAction(), errorMessage(), fieldErrorsFrom(), formValues(), PatientFormState, reactivatePatientAction(), sendPortalInviteAction() (+4 more)

### Community 76 - "Financial Data Queries"
Cohesion: 0.22
Nodes (13): DashboardOverviewPage(), getMonthlySeries(), getPeriodSummary(), getReceivablesForecast(), getTransactionById(), listPatientTransactions(), listTransactions(), ReceivableRow (+5 more)

### Community 77 - "Timezone Utilities"
Cohesion: 0.26
Nodes (12): CalendarDate, formatter(), instantToTime(), minutesOfDay(), minutesToTime(), partsCache, timeToMinutes(), timeZoneOffsetMs() (+4 more)

### Community 78 - "Anti-Double-Booking & DB Tests (docs)"
Cohesion: 0.24
Nodes (13): Double booking proibido (prevenção no banco), Exclusion constraint appointments_no_overlap, scripts/db-concurrency-test.mjs (concorrência real), Testes pgTAP (supabase/tests/database), Bug: auth.users sem defaults nas colunas de token, Testes de banco em duas camadas (pgTAP + script de concorrência), Riscos técnicos identificados, Agendamento (banco como fonte da verdade) (+5 more)

### Community 79 - "Providers, Webhooks & Notifications (docs)"
Cohesion: 0.27
Nodes (13): Pagamento só confirmado por webhook server-side, EmailProvider (abstração), PaymentProvider (abstração), providers/, jobs/, emails/ (ainda não criados), WhatsAppProvider (abstração), notifications / notification_events / notification_deliveries, Calendário próprio, sem biblioteca, Eventos internos de notificação sem entrega (+5 more)

### Community 80 - "Financial Integration Test"
Cohesion: 0.26
Nodes (12): ref_node_crypto, check(), cleanup(), main(), NUTRI_A, NUTRI_B, PATIENT_A, rest() (+4 more)

### Community 81 - "Scheduling Concurrency Test"
Cohesion: 0.28
Nodes (12): activeCount(), check(), cleanup(), main(), nextMondayAt(), NUTRI, PATIENT_A, PATIENT_B (+4 more)

### Community 82 - "Screenshots Fase 6"
Cohesion: 0.21
Nodes (11): dashboard(), extra, MONDAY, nextMonday(), NUTRITIONIST, OUT, PATIENT, plusDays() (+3 more)

### Community 83 - "Screenshots Fase 9"
Cohesion: 0.23
Nodes (12): dashboard(), ensureData(), extra, fakePdf(), login(), NUTRITIONIST, OUT, PATIENT (+4 more)

### Community 84 - "Assessments SQL Schema"
Cohesion: 0.24
Nodes (12): assessment_measurements_assessment_id_idx, assessment_measurements_type_id_idx, assessments_patient_id_assessed_at_idx, public.assessment_measurements, public.assessments, public.measurement_types, set_assessment_measurements_updated_at, set_assessments_updated_at (+4 more)

### Community 85 - "Brand, Audit & Roadmap Tail (docs)"
Cohesion: 0.21
Nodes (12): Método EM, audit_logs, Auditoria sem dado de saúde, Identidade visual (azul-petróleo, Fraunces + Manrope, monograma EM), Rate limiting em memória do processo, Enzo Mangili (nutricionista), Fase 15 — Segurança, testes, acessibilidade, performance e SEO, Fase 16 — Produção e deploy (+4 more)

### Community 86 - "Assessment Management SQL"
Cohesion: 0.21
Nodes (10): public.assessments, public.guard_assessment, public.guard_assessment_measurement, public.measurement_types, assessments_patient_date_idx, guard_assessment_measurements, guard_assessments, public.assessment_visible_to_patient() (+2 more)

### Community 87 - "Screenshots Fase 8"
Cohesion: 0.23
Nodes (10): ref_node_path, dashboard(), extra, login(), NUTRITIONIST, OUT, PATIENT, portal() (+2 more)

### Community 88 - "Contact Form Actions"
Cohesion: 0.21
Nodes (8): zod, contactAction(), contactRateLimiter, ContactState, readValues(), ContactForm(), ContactInput, contactSchema

### Community 89 - "Meal Plans Integration Test"
Cohesion: 0.27
Nodes (11): check(), cleanup(), main(), NUTRI_A, NUTRI_B, PATIENT_A, PATIENT_B, rest() (+3 more)

### Community 90 - "Appointments Data"
Cohesion: 0.20
Nodes (11): getPatientContractOptionsAction(), handlePatientChange(), ContractOption, getActiveContractsForPatient(), listAppointmentsInRange(), listUpcomingAppointments(), PatientSearchResult, PaymentStatus (+3 more)

### Community 91 - "Plans SQL Schema"
Cohesion: 0.27
Nodes (11): plan_benefits_plan_id_idx, plan_prices_one_primary_per_plan, plan_prices_plan_id_idx, public.plan_benefits, public.plan_prices, public.plans, set_plan_benefits_updated_at, set_plan_prices_updated_at (+3 more)

### Community 92 - "Blog SQL Schema"
Cohesion: 0.27
Nodes (11): blog_posts_category_id_idx, blog_posts_status_published_at_idx, public.blog_categories, public.blog_post_tags, public.blog_posts, public.blog_tags, set_blog_categories_updated_at, set_blog_posts_updated_at (+3 more)

### Community 93 - "E2E Assessments Spec"
Cohesion: 0.20
Nodes (6): cleanup(), NUTRITIONIST, PATIENT, STARTED_AT, withDb(), ref_node_os

### Community 94 - "Contracts SQL Schema"
Cohesion: 0.25
Nodes (10): public.plan_prices, contract_installments_contract_id_due_date_idx, patient_contracts_patient_id_status_idx, public.contract_installments, public.patient_contracts, set_contract_installments_updated_at, set_patient_contracts_updated_at, public.patients (+2 more)

### Community 95 - "Patients SQL Schema"
Cohesion: 0.25
Nodes (10): public.validate_patient_profile_roles, patients_nutritionist_id_idx, patients_profile_id_idx, patients_status_idx, public.patients, public.validate_patient_profile_roles(), set_patients_updated_at, public.profiles (+2 more)

### Community 96 - "Screenshots Fase 5"
Cohesion: 0.22
Nodes (9): ref_playwright, captureExtra(), captureViewport(), extra, EXTRA_VIEWPORTS, NUTRITIONIST, OUT, shoot() (+1 more)

### Community 97 - "Finance Charts"
Cohesion: 0.25
Nodes (9): recharts, axisStyle, ChartTooltip(), MONTH_SHORT, monthLabel(), MonthlyRevenueChart(), ReceivedVsForecastChart(), toReais() (+1 more)

### Community 98 - "Patients Integration Test"
Cohesion: 0.31
Nodes (10): check(), cleanup(), main(), NUTRI_A, NUTRI_B, PATIENT_LOGIN, rest(), setup() (+2 more)

### Community 99 - "Finance Actions"
Cohesion: 0.44
Nodes (9): cancelPaymentAction(), cancelTransactionAction(), createTransactionAction(), errorMessage(), fieldErrorsFrom(), parseTransactionForm(), recordPaymentAction(), revalidateFinance() (+1 more)

### Community 101 - "Patient Status Domain"
Cohesion: 0.25
Nodes (9): derivePatientStatus(), isEffectivelyActive(), parsePatientListFilter(), PATIENT_STATUS_DESCRIPTION, PATIENT_STATUS_LABEL, PatientDbStatus, PatientListFilter, PatientStatusInput (+1 more)

### Community 102 - "Results & Consent SQL"
Cohesion: 0.29
Nodes (9): before_after_results_patient_id_idx, media_consents_patient_id_idx, public.before_after_results, public.media_consents, public.validate_before_after_consent(), set_before_after_results_updated_at, set_media_consents_updated_at, public.patients (+1 more)

### Community 103 - "Notifications SQL"
Cohesion: 0.29
Nodes (10): notification_deliveries_event_id_idx, notification_deliveries_recipient_profile_id_idx, notification_events_related_entity_idx, notifications_recipient_id_read_at_idx, public.notification_deliveries, public.notification_events, public.notifications, set_notification_deliveries_updated_at (+2 more)

### Community 104 - "Auth Error Mapping"
Cohesion: 0.31
Nodes (7): forgotPasswordAction(), ForgotPasswordForm(), AuthError, AuthErrorCode, authErrorMessage(), mapSupabaseAuthError(), MESSAGES

### Community 105 - "Finance Installments Domain"
Cohesion: 0.24
Nodes (8): allocatePayment(), INSTALLMENT_UI_STATUS_LABEL, InstallmentBalance, InstallmentBalanceInput, InstallmentUiStatus, nextDueInstallment(), PaymentAllocationResult, PersistedInstallmentStatus

### Community 106 - "Rate Limiter"
Cohesion: 0.24
Nodes (4): Bucket, InMemoryRateLimiter, RateLimiter, RateLimitResult

### Community 107 - "Patients & Contracts Management SQL"
Cohesion: 0.27
Nodes (8): patients_nutritionist_email_unique_idx, public.complete_contract(), public.create_contract_with_installments(), public.patient_overview, public.appointments, public.patient_contracts, public.patients, public.plans

### Community 108 - "E2E Meal Plans Spec"
Cohesion: 0.28
Nodes (7): cleanup(), latestDraftOrPublished(), NUTRITIONIST, PATIENT, STARTED_AT, withDb(), pg

### Community 109 - "Screenshots Fase 7"
Cohesion: 0.25
Nodes (6): ref_node_fs, dashboard(), extra, NUTRITIONIST, OUT, shoot()

### Community 110 - "Contract Status Domain"
Cohesion: 0.39
Nodes (6): ContractActions(), canCancelContract(), canCompleteContract(), CONTRACT_STATUS_LABEL, INSTALLMENT_STATUS_LABEL, presentInstallmentStatus()

### Community 111 - "Payments Data"
Cohesion: 0.28
Nodes (8): getPaymentById(), listPatientPayments(), OpenInstallmentOption, PaymentListItem, Row, toItem(), PaymentMethod, cancelPayment()

### Community 112 - "Plan Visibility Domain"
Cohesion: 0.36
Nodes (7): DISPLAY_ORDER, filterPublicPlans(), isPubliclyListed(), isSellable(), PlanVisibilityFlags, sortPlansForDisplay(), plans

### Community 113 - "Profiles SQL"
Cohesion: 0.25
Nodes (6): auth.users, public.prevent_role_change, prevent_profiles_role_change, public.profiles, set_profiles_updated_at, public.set_updated_at

### Community 114 - "E2E Finance Spec"
Cohesion: 0.29
Nodes (5): cleanup(), NUTRITIONIST, PATIENT, STARTED_AT, withDb()

### Community 115 - "E2E Patients Spec"
Cohesion: 0.29
Nodes (6): login(), loginAsNutritionist(), NEW_PATIENT, NUTRITIONIST, PATIENT, RUN

### Community 116 - "Auth Redirect & Callback"
Cohesion: 0.39
Nodes (5): loginAction(), GET(), LoginForm(), isSafeInternalPath(), sanitizeRedirectPath()

### Community 117 - "Reset Password Gate"
Cohesion: 0.32
Nodes (7): resetPasswordAction(), ResetPasswordForm(), ACCEPTED_HASH_TYPES, ResetPasswordGate(), establishSessionFromUrl(), Status, createClient()

### Community 118 - "Finance Summary Domain"
Cohesion: 0.39
Nodes (6): PatientFinanceSection(), computeBalance(), ContractFinancials, PeriodSummary, sumContractFinancials(), totalForecast()

### Community 119 - "Onboarding & Invites"
Cohesion: 0.43
Nodes (5): invitePatientAction(), InvitePatientState, InvitePatientForm(), getClientIp(), patientInviteRateLimiter

### Community 120 - "Evolution Charts"
Cohesion: 0.33
Nodes (6): axisStyle, ChartTooltip(), COLORS, EvolutionCharts(), PRIMARY, chartableMetrics()

### Community 121 - "Financial Views SQL"
Cohesion: 0.33
Nodes (6): public.contract_financial_summary, public.patient_active_status, public.contract_installments, public.patient_contracts, public.patients, public.payments

### Community 122 - "Auth Integration Test"
Cohesion: 0.47
Nodes (5): check(), main(), NUTRITIONIST, PATIENT, signIn()

### Community 123 - "DB Concurrency Test"
Cohesion: 0.80
Nodes (5): attemptBooking(), cleanup(), main(), setup(), withClient()

### Community 124 - "Patient Timeline Domain"
Cohesion: 0.47
Nodes (4): buildPatientTimeline(), sortKey(), TimelineEventKind, TimelineSources

### Community 125 - "RLS Helper Functions SQL"
Cohesion: 0.40
Nodes (5): public.current_profile_role(), public.is_nutritionist_of_patient(), public.is_patient_self(), public.patients, public.profiles

### Community 126 - "Food Photo Analyses SQL"
Cohesion: 0.40
Nodes (5): food_photo_analyses_patient_id_idx, public.food_photo_analyses, set_food_photo_analyses_updated_at, public.patients, public.set_updated_at

### Community 127 - "Audit Log SQL"
Cohesion: 0.53
Nodes (5): audit_logs_actor_id_idx, audit_logs_created_at_idx, audit_logs_entity_idx, public.audit_logs, public.profiles

### Community 128 - "Horizontal Logo Asset"
Cohesion: 0.60
Nodes (5): Logo Horizontal Enzo Mangili Nutricionista, Brand Palette: petrol blue + black on off-white, EM Monogram (petrol-blue serif E with black script M and dumbbell flourishes), Método EM Brand Identity, Wordmark: ENZO (black serif caps) + Mangili (black script) + NUTRICIONISTA (petrol-blue spaced sans caps)

### Community 129 - "Monogram Badge Asset"
Cohesion: 0.60
Nodes (5): Monogram Badge (monogram-badge.webp), EM Monogram Mark, Fitness Iconography (dumbbell, figure), Método EM Brand Identity, Petrol-Blue Brand Palette

### Community 130 - "About Photo"
Cohesion: 0.40
Nodes (5): Public Site Sobre/About Section, Mood: Warm, Approachable, Trustworthy, Sobre Photo: Nutritionist Seated Portrait, Scene: Smiling Man in Burgundy Polo on Cream Sofa, Visual Identity: Off-White Background Palette

### Community 131 - "OG Share Image"
Cohesion: 0.50
Nodes (5): Bright White Interior Background (Window with Foliage Shadows), Portrait Photo of a Bearded Man (Nutritionist, likely Enzo Mangili), Metodo EM Brand (no wordmark, monogram or petrol-blue palette visible in the photo), Open Graph / Social Share Preview (1200px-wide landscape crop), OG Default Share Image (og-default.jpg)

### Community 132 - "Public Content Integration Test"
Cohesion: 0.70
Nodes (4): admin(), anonGet(), check(), main()

### Community 134 - "Consultation B&W Photo"
Cohesion: 0.67
Nodes (4): Avaliação antropométrica (adipômetro/plicômetro e fita métrica sobre a mesa), Consulta presencial / atendimento em consultório (clima atento, profissional, sóbrio), Foto P&B: nutricionista em atendimento, escrevendo anotações à mesa com adipômetro e fita métrica, Seção 'atendimento' / 'consulta' do site público Método EM (uso provável da foto)

### Community 135 - "Assessment Photo"
Cohesion: 0.67
Nodes (4): Foto: Enzo segurando adipômetro (avaliação física), Avaliação física / composição corporal (Método EM), Seção 'Avaliação' do site público, Adipômetro digital (medição de dobras cutâneas)

### Community 136 - "Consultation Photo"
Cohesion: 0.67
Nodes (4): Anthropometric tools on desk: skinfold caliper and measuring tape, Consultation scene: nutritionist writing notes, smiling toward patient, warm office, Photo: Nutritionist at desk during consultation (consulta.webp), Public site 'consulta' section image (Metodo EM)

### Community 137 - "Hero Photo"
Cohesion: 0.67
Nodes (4): Hero Portrait Photo (public/images/enzo/hero.webp), Scene: smiling bearded man in burgundy polo, seated indoors by bright window with soft bokeh, forearm tattoo, professional but approachable mood, Public Site Hero Section (Metodo EM landing), Subject Role: nutritionist / practitioner portrait for marketing (Enzo Mangili, per folder name)

### Community 138 - "Pagination Component"
Cohesion: 0.67
Nodes (3): Pagination(), Props, buttonVariants

### Community 139 - "Site Settings SQL"
Cohesion: 0.50
Nodes (3): public.site_settings, set_site_settings_updated_at, public.set_updated_at

### Community 140 - "Password Reset Security Bug (docs)"
Cohesion: 1.00
Nodes (3): Bug de segurança: gate de redefinição de senha na conta errada, Token de convite/recuperação vem no fragmento da URL, Login, logout e recuperação de senha

### Community 142 - "Payment Form"
Cohesion: 1.00
Nodes (3): centsToInput(), PaymentForm(), selectInstallment()

## Ambiguous Edges - Review These
- `Fitness Iconography (dumbbell, figure)` → `Método EM Brand Identity`  [AMBIGUOUS]
  public/brand/monogram-badge.webp · relation: conceptually_related_to
- `Scene: Smiling Man in Burgundy Polo on Cream Sofa` → `Visual Identity: Off-White Background Palette`  [AMBIGUOUS]
  public/images/enzo/sobre.webp · relation: semantically_similar_to
- `Portrait Photo of a Bearded Man (Nutritionist, likely Enzo Mangili)` → `Metodo EM Brand (no wordmark, monogram or petrol-blue palette visible in the photo)`  [AMBIGUOUS]
  public/images/og-default.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **513 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+508 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 750 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Fitness Iconography (dumbbell, figure)` and `Método EM Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Scene: Smiling Man in Burgundy Polo on Cream Sofa` and `Visual Identity: Off-White Background Palette`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Portrait Photo of a Bearded Man (Nutritionist, likely Enzo Mangili)` and `Metodo EM Brand (no wordmark, monogram or petrol-blue palette visible in the photo)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `next` connect `Dashboard Pages & Auth Session` to `Scheduling Actions & Services`, `Form Components & States`, `Layouts, Sidebar & Navigation Shell`, `Meal Plan Structure & Data`, `Action Menus & Dialogs`, `Tables & List Pages`, `Date Utils & Agenda Views`, `Meal Plan Validators`, `Finance & Agenda Form Pages`, `Pagination Component`, `Env, Supabase Clients & Proxy`, `Blog Data & Visibility`, `Next Config`, `Patient Portal Pages`, `Summary Cards & Overview`, `Scheduling State Machine & Booking Flow`, `Agenda Calendar Views`, `Assessment Evolution & Trends`, `Assessment Actions & Validators`, `Plans Pricing & Plan Cards`, `Root Layout & Legal Pages`, `Patient Validators & Filters`, `Assessment Numbers & Patient Evolution`, `Tooling Config (ESLint/Vitest)`, `Método EM Marketing Content`, `Blog Rich Content`, `Marketing Sections & Public Pages`, `Site Settings & Contact Pages`, `Contract & Patient Booking Actions`, `Availability Rules & Editor`, `Assessment Metrics & Form`, `Patient Detail Page & Section Nav`, `Auth Validators & Rate Limit`, `Patient Actions`, `Finance Actions`, `Auth Redirect & Callback`, `Reset Password Gate`, `Onboarding & Invites`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `@supabase/supabase-js` connect `Profiles, Roles & Service Role (docs)` to `Tooling Config (ESLint/Vitest)`, `Env, Supabase Clients & Proxy`, `Blog Data & Visibility`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `pg` connect `E2E Meal Plans Spec` to `Patients Integration Test`, `Tooling Config (ESLint/Vitest)`, `Assessments Integration Test`, `Scheduling Integration Test`, `Financial Integration Test`, `Scheduling Concurrency Test`, `E2E Finance Spec`, `E2E Patients Spec`, `E2E Assessments Spec`, `Screenshots Fase 6`, `Meal Plans Integration Test`, `DB Concurrency Test`, `E2E Specs (Scheduling/Auth/Smoke)`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _513 weakly-connected nodes found - possible documentation gaps or missing edges._