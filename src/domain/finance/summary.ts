/**
 * Cálculos puros sobre linhas já agregadas (o banco agrega; aqui só
 * composição e checagens — prompt Fase 7 §5–§8/§43).
 */
export type PeriodSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  receivedCents: number;
  pendingCents: number;
  forecastCents: number;
  overdueCents: number;
};

export function computeBalance(incomeCents: number, expenseCents: number): number {
  return incomeCents - expenseCents;
}

export type ContractFinancials = {
  contractStatus: "ACTIVE" | "COMPLETED" | "CANCELLED";
  contractedCents: number;
  receivedCents: number;
  pendingCents: number;
  forecastCents: number;
};

/** Soma os resumos por contrato de um paciente (aba Financeiro do perfil). */
export function sumContractFinancials(contracts: ContractFinancials[]): Omit<ContractFinancials, "contractStatus"> {
  return contracts.reduce(
    (total, contract) => ({
      contractedCents: total.contractedCents + contract.contractedCents,
      receivedCents: total.receivedCents + contract.receivedCents,
      pendingCents: total.pendingCents + contract.pendingCents,
      forecastCents: total.forecastCents + contract.forecastCents,
    }),
    { contractedCents: 0, receivedCents: 0, pendingCents: 0, forecastCents: 0 },
  );
}

/** Previsão de rendimento (Home): só contratos ACTIVE projetam receita (§43). */
export function totalForecast(contracts: ContractFinancials[]): number {
  return contracts.filter((contract) => contract.contractStatus === "ACTIVE").reduce((sum, contract) => sum + contract.forecastCents, 0);
}
