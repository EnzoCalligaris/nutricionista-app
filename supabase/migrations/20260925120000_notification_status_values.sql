-- Fase 12 — Notificações (parte 1/2): valores novos do enum de status de
-- entrega. Ficam num arquivo próprio porque um valor de enum recém-adicionado
-- não pode ser referenciado na MESMA transação em que foi criado (funções
-- SQL, checks) — a parte 2 os usa. Nenhuma migration anterior é editada.
--
-- PENDING (elegível) → PROCESSING (claim do worker) → SENT (aceito pelo
-- provider) → DELIVERED (confirmado, quando o provider informa) | FAILED
-- (falha permanente ou limite de tentativas) | CANCELLED (evento cancelado:
-- reagendamento/cancelamento/conclusão) | SKIPPED (sem destinatário/canal
-- desligado — nunca falha o evento inteiro).

alter type public.notification_delivery_status add value if not exists 'PROCESSING';
alter type public.notification_delivery_status add value if not exists 'DELIVERED';
alter type public.notification_delivery_status add value if not exists 'CANCELLED';
alter type public.notification_delivery_status add value if not exists 'SKIPPED';
