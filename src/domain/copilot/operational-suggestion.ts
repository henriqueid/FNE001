import { type Operation } from "@/src/domain/core/types";

export type OperationalSuggestion = {
  title: string;
  body: string;
  action: string;
  view: "operations" | "finance" | "home";
};

const compactBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 2,
  });

export function operationalSuggestion(operations: Operation[], signals: { tone: string }[]): OperationalSuggestion {
  const blocked = operations
    .filter(operation => operation.blockers > 0 && operation.status !== "Cancelada")
    .sort((left, right) => right.amount - left.amount);
  const ready = operations.filter(operation => operation.status === "Pronta para liberar");
  const delayed = signals.filter(signal => signal.tone === "warning");

  if (blocked.length) {
    const priority = blocked[0];
    const blockers =
      priority.blockers === 1 ? "Há 1 impedimento para revisar" : `Há ${priority.blockers} impedimentos para revisar`;
    return {
      title: blocked.length === 1 ? "1 operação aguarda decisão" : `${blocked.length} operações aguardam decisão`,
      body: `${priority.cedent} tem a maior operação bloqueada, no valor de ${compactBRL(priority.amount)}. ${blockers}.`,
      action: "Abrir fila de decisões",
      view: "operations",
    };
  }

  if (ready.length)
    return {
      title: ready.length === 1 ? "1 operação pronta para liberar" : `${ready.length} operações prontas para liberar`,
      body: "Os requisitos anteriores estão concluídos. Confirme favorecidos e janela bancária.",
      action: "Abrir financeiro",
      view: "finance",
    };

  if (delayed.length)
    return {
      title: "O ritmo de uma operação saiu do padrão",
      body: "A recomendação considera o tempo atual comparado ao histórico do mesmo cliente.",
      action: "Ver a exceção",
      view: "operations",
    };

  return {
    title: "Fluxo dentro do padrão esperado",
    body: "Nenhuma exceção crítica nova. Continue pela etapa destacada na jornada.",
    action: "Ver visão geral",
    view: "home",
  };
}
