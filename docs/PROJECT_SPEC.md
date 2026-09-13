# PROJECT_SPEC — Método EM

Especificação consolidada do produto, derivada do prompt do usuário (fonte primária
de regras de negócio) e de `./references` (fonte de fatos reais sobre Enzo Mangili).
Onde os dois conflitam, o prompt prevalece — ver `DECISIONS.md`.

## 1. Conceito

Plataforma para o nutricionista **Enzo Mangili**, organizada em torno do
**Método EM**: uma metodologia de acompanhamento (não uma dieta) que cobre
pré-consulta, consulta, pós-consulta, acompanhamento contínuo, avaliações, ajustes
e evolução do paciente.

Três superfícies, um único sistema/banco, permissões por papel:

1. **Site público** — institucional, planos, blog, agendamento, login.
2. **Dashboard do nutricionista** — operação clínica, financeira e de conteúdo.
3. **Portal do paciente** (`/paciente`) — acompanhamento pessoal.

## 2. Site público

Seções: Enzo Mangili / Método EM, Sobre Mim, Como funciona o acompanhamento,
pilares, planos, resultados reais (antes/depois), blog, contato, agendamento,
login.

Conteúdo real disponível (de `./references`):
- Nutricionista clínico, especialista em emagrecimento funcional, hipertrofia e
  saúde.
- "2 anos mudando vidas" — experiência em capacitação em emagrecimento e nutrição.
- Abordagem: nutrição descomplicada, individualizada, sem comprometer rotina
  social; foco em flexibilidade e praticidade.
- Fluxo comercial: pré-consulta gratuita → boas-vindas no grupo do WhatsApp →
  onboarding com o time → preenchimento do formulário de anamnese → assinatura do
  contrato → consulta com o nutricionista.
- Identidade visual: logo "Enzo Mangili — Nutricionista", monograma EM, paleta
  azul-petróleo escuro (~#2f5566) + preto sobre off-white, tipografia
  serif/script para o nome + caixa-alta tracked para "NUTRICIONISTA".

Não disponível — **não inventar**, marcar `PENDENTE DE DEFINIÇÃO`: CRN, telefone,
endereço/localização do consultório, e-mail profissional, redes sociais,
depoimentos com nome/foto autorizados, fotos de antes/depois com consentimento
registrado.

### Pilares do acompanhamento (adaptados do material — "6 pilares")

Conteúdo original do PDF cita 6 pilares, incluindo "Grupo Exclusivo com a Equipe"
e "Comunidade VIP". Por decisão deste prompt, **Grupo Exclusivo é removido**. Os
pilares a exibir publicamente devem ser revisados com Enzo para decidir se
"Comunidade VIP" também sai ou é mantida (ela é uma comunidade whatsapp geral, não
o "grupo exclusivo" enunciado como removido — mas são conceitualmente parecidos).
**PENDENTE DE DEFINIÇÃO.**

Pilares que seguem válidos:
- Consultas com o nutricionista.
- Planejamento nutricional (planos alimentares individualizados, com ajustes).
- Aplicativo/plataforma de dieta (nosso próprio módulo de Cardápios substituirá o
  "aplicativo de dietas" citado no PDF — não usar app de terceiro).
- Acompanhamento de perto (check-in periódico com foto, peso e feedback — mapeia
  para os módulos de Avaliações + Feedback).

## 3. Planos

Regra geral: preço e conteúdo definidos neste prompt sobrepõem o PDF quando há
conflito explícito. Ver `DECISIONS.md §Preços` para o detalhe da reconciliação.

| Plano | Duração | Consultas | Valor | Observação |
|---|---|---|---|---|
| Consulta avulsa | única | 1 presencial | **R$ 230** | Definido neste prompt. Sem consulta online adicional, sem mensagem de feedback. Recebe demais benefícios aplicáveis a critério do profissional. |
| Trimestral | 3 meses | 3 presenciais + 2 online | **Extrair do PDF** — PDF lista R$ 1.050,00 (de) / 3x R$ 226,79 / R$ 600,00 à vista — ambíguo qual é o preço vigente | Split presencial/online definido neste prompt (PDF só dizia "3 consultas"). |
| Semestral | 6 meses | 6 presenciais + 5 online | **Extrair do PDF** — PDF lista R$ 2.100,00 (de) / 6x R$ 214,60 / R$ 1.080,00 à vista — mesma ambiguidade | Periodicidade "a cada 2 meses" citada no PDF é incompatível com 6 presenciais em 6 meses — **não fixar como regra**; deixar configurável. |
| Anual | 12 meses | 12 consultas (composição presencial/online não definida) | R$ 4.200,00 (de) / 12x R$ 210,33 / R$ 1.920,00 à vista (histórico) | Sistema deve suportar o plano, mas **não vender publicamente** agora (`active`, mas `publicly_visible=false`, `available_for_sale=false`). Existe para histórico/clientes antigos/reativação futura/previsão financeira. |

Benefícios adicionais listados no PDF para os planos multi-mês (avaliação
antropométrica/bioimpedância, formulário de anamnese, prescrição/análise de
exames laboratoriais, checklist quinzenal com feedback, acesso a app de dieta,
prescrição de manipulados/suplementos, suporte seg-sáb 08h-18h, lista de
compras/materiais complementares) permanecem válidos **exceto**:
- "Acesso a comunidade VIP e ao grupo exclusivo" → **remover a parte "grupo
  exclusivo"**; comunidade VIP fica pendente de confirmação.
- Bônus de indicação/cashback e garantia de 12 meses do material antigo (ligados
  ao plano Premium/Anual de 12 meses) — não mencionados neste prompt; manter como
  recurso apenas do plano anual histórico, não expor no site público enquanto o
  anual não for vendido.

Modelagem: `plans` deve ter `active`, `publicly_visible`, `available_for_sale`
como propriedades independentes, e uma tabela de benefícios versionável (não
hardcode de texto), pois os benefícios mudam por decisão do profissional com o
tempo.

## 4. Resultados (antes/depois)

Administrável pelo dashboard futuramente. Campos: título, descrição, período,
fotos de antes, fotos de depois, `published` (bool), `image_consent_id`
(obrigatório antes de publicar). **Nunca publicar sem consentimento registrado.**
O PDF contém 3 slides "Essas são algumas das vidas transformadas" com fotos de
pacientes — são dados sensíveis de terceiros; não extrair/reutilizar essas fotos
sem consentimento documentado e sem saber se são as mesmas pessoas que autorizariam
uso no novo site.

## 5. Blog / CMS próprio

Campos: título, slug, resumo, imagem de capa, conteúdo (rich text), categoria,
tags, autor, data, status (`DRAFT`/`PUBLISHED`/`ARCHIVED`), SEO title, meta
description, Open Graph. Materiais em PDF destinados a pacientes **não** viram
artigos públicos automaticamente — são entidades separadas (`patient_materials`).

## 6. Dashboard do nutricionista

Menu: Visão Geral, Agenda, Pacientes, Cardápios, Avaliações, Comentários,
Consultas, Financeiro, Blog, Resultados, Materiais, Configurações.

### Visão Geral
Cards: faturamento do mês, consultas do dia, total de pacientes ativos, previsão
de rendimento. Tabela de previsão de recebimentos por paciente: plano, duração,
valor contratado, valor recebido, receita estimada/futura, valor pendente, status
do pagamento, método de pagamento, próximo vencimento. Separação obrigatória:
contratado / recebido / pendente / previsto (ver exemplo em `DECISIONS.md`).

### Financeiro
Receita, despesa, saldo. Tabela: data, descrição, categoria, tipo, valor, método
de pagamento, status, origem, ações. Lançamentos manuais + lançamentos
automáticos gerados por `appointment → payment/charge → financial_transaction`,
sem dupla contabilização.

### Agenda
Visões dia/semana/mês. Consultas, bloqueios, férias, ausências, compromissos.
Configuração de horários de trabalho e bloqueios pelo nutricionista.
"Próximas sessões": data, horário, paciente, tipo, presencial/online, valor,
status da consulta, status do pagamento.

Status de consulta: `AGENDADA`, `CONFIRMADA`, `REALIZADA`, `FALTOU`, `CANCELADA`,
`REAGENDADA`.

### Pacientes
Cards: pacientes ativos, ticket médio, total de pacientes. Busca por nome,
filtros (todos/ativos/inativos). Tabela: nome, idade, plano, status, valor, data
de início, data prevista de término, próxima consulta, ações (visualizar, editar,
desativar; excluir só quando seguro — evitar hard delete com histórico).

Perfil do paciente: dados pessoais, contato, plano atual, histórico de contratos,
pagamentos, consultas, cardápio, avaliações, comentários, feedbacks,
suplementos, materiais, timeline.

### Comentários sobre sessões
Texto longo por paciente, consulta relacionada opcional, autor, data, conteúdo,
data de edição. Não apagar comentários antigos indiscriminadamente.

### Consultas (histórico)
Cards: total de sessões, realizadas, comparecimento, receita total relacionada.
Filtros por status. Tabela: data/hora, paciente, tipo, valor, método de
pagamento, status do pagamento, status da consulta.

### Cardápios
Seleção de paciente → plano alimentar semanal (SEG–DOM), refeições configuráveis
(padrão: café da manhã, lanche, almoço, lanche da tarde, jantar, ceia). Itens de
refeição: alimento, quantidade, unidade, calorias, proteínas, carboidratos,
gorduras, fibras (quando aplicável), instruções, observações, substituições.
Versionamento: `DRAFT`/`PUBLISHED`/`ARCHIVED`; paciente só vê a versão publicada;
histórico preservado.
Referência conceitual: sistemas como WebDiet — apenas inspiração funcional, sem
copiar interface/marca/texto/código.

### Avaliações (bioimpedância/evolução)
Métricas possíveis (não obrigatórias): peso, %gordura, massa magra, massa
muscular, água corporal, gordura visceral, IMC, circunferências. Observações
livres. Relatório/PDF. Nunca transformar avaliação em diagnóstico automático.

### Suplementos
Por paciente: nome, marca (opcional), orientação, horário, observação, link
externo de compra, imagem (opcional), status. Visível no portal do paciente. A
IA nunca prescreve suplementação.

### Feedbacks
Mensagens do nutricionista para o paciente: `patient_id`, `author_id`, `content`,
`created_at`, `read_at`. Não é chat em tempo real inicialmente. Gera notificação.

### Materiais
Upload de PDFs/arquivos, atribuição a um ou vários pacientes, remoção de acesso.
Storage privado, URLs assinadas.

### Configurações
Horários de disponibilidade, dados do profissional, integrações (e-mail,
WhatsApp, pagamento), templates de notificação — a detalhar na Fase 14.

## 7. Portal do paciente (`/paciente`)

Menu: Início, Meu Cardápio, Minha Evolução, Consultas, Suplementos, Feedbacks,
Materiais, Meu Perfil.

Início: próxima consulta, cardápio do dia, último feedback, última avaliação,
atalho para agendar, atalho para analisar refeição por foto.

Minha Evolução: gráficos por métrica selecionável, histórico. Sem diagnóstico
automático.

## 8. Agendamento (paciente + nutricionista)

Paciente agenda pelo site; disponibilidade real vem do banco (consultas
existentes, regras de disponibilidade, bloqueios, férias). Banco é fonte da
verdade. Double booking proibido — proteção no backend (constraint/transação),
não só no frontend.

Notificações: ao criar consulta → in-app + e-mail + WhatsApp (quando
configurado). Lembrete 5 dias antes (in-app + e-mail + WhatsApp), com opções
Confirmar/Reagendar, sem duplicar mensagens.

## 9. IA de análise de refeição por foto

Paciente tira/envia foto → sistema estima alimentos, porções aproximadas,
calorias e macros. **Sempre linguagem de estimativa** ("estimativa aproximada:
620–680 kcal"), nunca valor exato. Paciente pode confirmar/corrigir alimentos,
porções, molhos, óleo, bebidas, modo de preparo → recálculo. IA nunca altera
dieta, meta, suplementação ou cardápio — decisões ficam com o nutricionista.
Abstração: `FoodAnalysisProvider.analyzeMealImage()`, para trocar fornecedor no
futuro. Fotos privadas (paciente vê só as próprias; nutricionista só as de
pacientes autorizados); nunca bucket público.

## 10. Contratos e pagamentos

Paciente ≠ Plano ≠ Contrato ≠ Parcela ≠ Pagamento ≠ Consulta — entidades
separadas, histórico preservado (um paciente pode ter trimestral → semestral →
avulsa ao longo do tempo).

`PaymentProvider` abstrato; pagamento confirmado apenas via webhook
server-side, nunca por resposta do frontend. Idempotência, assinatura de
webhook, retry e logging seguro são requisitos (Fase 13).

## 11. Notificações

Estrutura conceitual: `notifications`, `notification_events`,
`notification_deliveries`. Canais: in-app, e-mail (Resend + React Email),
WhatsApp (Business Platform oficial ou BSP — nunca WhatsApp Web
automatizado em produção). Idempotência a implementar futuramente.

## 12. Autenticação e papéis

Papéis mínimos: `NUTRITIONIST`, `PATIENT`, `ADMIN` (só se necessário). Sem IDs
hardcoded. Paciente acessa só seus dados; nutricionista acessa pacientes sob sua
administração; autorização sempre validada no servidor.

## 13. Segurança e LGPD

Ver `docs/SECURITY.md` para o detalhamento completo (RLS, storage, auditoria,
consentimento, retenção).
