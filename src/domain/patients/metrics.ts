/**
 * Métricas dos cards de /dashboard/pacientes (prompt Fase 5 §3–§5). Puras:
 * recebem linhas já filtradas/escopadas pelo data layer.
 *
 * TICKET MÉDIO = receita efetivamente recebida no período (pagamentos
 * CONFIRMED com `paid_at` dentro do mês corrente em America/Sao_Paulo)
 * ÷ quantidade de pacientes distintos que pagaram nesse período. Nunca
 * "valor contratado ÷ pacientes": contrato parcelado não é receita no ato
 * (docs/DATABASE.md, ledger). Sem pagantes => R$ 0,00 (nunca NaN/Infinity).
 */
export type ReceivedPayment = { patient_id: string; amount_cents: number };

export type AverageTicket = {
  averageCents: number;
  receivedCents: number;
  payingPatients: number;
};

export function computeAverageTicket(payments: ReceivedPayment[]): AverageTicket {
  const patients = new Set<string>();
  let receivedCents = 0;
  for (const payment of payments) {
    if (payment.amount_cents <= 0) continue;
    patients.add(payment.patient_id);
    receivedCents += payment.amount_cents;
  }
  const payingPatients = patients.size;
  return {
    averageCents: payingPatients === 0 ? 0 : Math.round(receivedCents / payingPatients),
    receivedCents,
    payingPatients,
  };
}
