import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";

export type ScoreObservation = {
  key: string;
  value: number | string | boolean | null;
  source: "CADASTRO" | "CARTEIRA" | "OPERACAO" | "BUREAU" | "RELACIONAMENTO";
  observedAt: string;
};

export type ScoreOutcome = {
  kind: "PAGAMENTO" | "ATRASO" | "INADIMPLENCIA" | "RECOMPRA" | "DILUICAO" | "EXCECAO";
  value: number | string | boolean;
  occurredAt: string;
};

export type ScoreLearningRecord = {
  operationId: string;
  cedentId?: string;
  debtorIds: string[];
  observations: ScoreObservation[];
  outcomes: ScoreOutcome[];
};

/**
 * Prepara dados para um futuro score proprietário sem calcular um número arbitrário agora.
 * Resultados posteriores (pagamentos, atrasos, recompra etc.) serão anexados em `outcomes`.
 */
export function buildScoreLearningRecord({
  operation,
  cedent,
  debtors,
  observedAt,
}: {
  operation: Operation;
  cedent?: Cedent;
  debtors: Debtor[];
  observedAt: string;
}): ScoreLearningRecord {
  const debtorIds = [...new Set((operation.manualEntry?.entries ?? []).map(title => title.debtorId).filter(Boolean))];
  const relatedDebtors = debtors.filter(debtor => debtorIds.includes(debtor.id));
  const observations: ScoreObservation[] = [
    { key: "operation.faceAmount", value: operation.amount, source: "OPERACAO", observedAt },
    { key: "operation.titleCount", value: operation.titleCount, source: "OPERACAO", observedAt },
    { key: "operation.riskClassification", value: operation.risk, source: "OPERACAO", observedAt },
  ];
  if (cedent) {
    observations.push(
      { key: "cedent.currentScore", value: cedent.score, source: "CADASTRO", observedAt },
      { key: "cedent.usedLimit", value: cedent.usedLimit, source: "RELACIONAMENTO", observedAt },
      { key: "cedent.portfolioOverdue", value: cedent.portfolioOverdue, source: "CARTEIRA", observedAt },
      { key: "cedent.averageDelayDays", value: cedent.averageDelayDays, source: "CARTEIRA", observedAt },
      { key: "cedent.repurchases", value: cedent.repurchases, source: "CARTEIRA", observedAt },
    );
  }
  relatedDebtors.forEach(debtor => {
    observations.push(
      { key: `debtor.${debtor.id}.currentScore`, value: debtor.score ?? null, source: "CADASTRO", observedAt },
      {
        key: `debtor.${debtor.id}.portfolioOverdue`,
        value: debtor.portfolioOverdue ?? null,
        source: "CARTEIRA",
        observedAt,
      },
      {
        key: `debtor.${debtor.id}.averageDelayDays`,
        value: debtor.averageDelayDays ?? null,
        source: "CARTEIRA",
        observedAt,
      },
    );
  });
  return { operationId: operation.id, cedentId: cedent?.id, debtorIds, observations, outcomes: [] };
}
