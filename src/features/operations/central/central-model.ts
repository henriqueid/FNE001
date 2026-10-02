/**
 * Regras puras da central de operações: filas, filtros de tela, indicadores
 * financeiros/da fila e colunas do kanban.
 */
import { type Operation } from "@/src/domain/core/types";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";
import { needsIntervention } from "@/src/domain/operations/pace";
import { normalizedPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { operationSearchText } from "@/src/domain/operations/queries";

export type QueueScope = "active" | "intervention" | "formalization" | "released" | "cancelled";
export type DisplayMode = "list" | "kanban";
export type DatePreset = "today" | "custom" | "all";
export type ScreenFilters = { query: string; stageFilter: string; statusFilter: string; sourceFilter: string };
export type CentralMetrics = ReturnType<typeof centralMetricsFor>;
export type KanbanColumn = ReturnType<typeof kanbanColumnsFor>[number];

/** Pronta para formalização: sem bloqueios, na etapa 4 e com automação alta. */
function readyForFormalization(op: Operation) {
  return op.status !== "Cancelada" && op.blockers === 0 && op.stage === 4 && op.automation >= 80;
}

/** Filtros de etapa, status, origem e busca textual aplicados à tela. */
export function matchesScreenFilters(op: Operation, { query, stageFilter, statusFilter, sourceFilter }: ScreenFilters) {
  const q = query.trim().toLowerCase();
  return (
    (stageFilter === "Todas" || String(op.stage) === stageFilter) &&
    (statusFilter === "Todos" || op.status === statusFilter) &&
    (sourceFilter === "Todas" || op.source === sourceFilter) &&
    (!q || operationSearchText(op).includes(q))
  );
}

/** Operação pertence à fila selecionada. */
export function inQueue(op: Operation, scope: QueueScope) {
  return scope === "active"
    ? op.status !== "Cancelada" && op.status !== "Liberada ao financeiro"
    : scope === "released"
      ? op.status === "Liberada ao financeiro"
      : scope === "intervention"
        ? needsIntervention(op)
        : scope === "formalization"
          ? readyForFormalization(op)
          : op.status === "Cancelada";
}

/** Indicadores do topo e contadores das filas sobre as operações filtradas. */
export function centralMetricsFor(screenOperations: Operation[]) {
  const activeOperations = screenOperations.filter(op => op.status !== "Cancelada");
  const inProgressOperations = activeOperations.filter(op => op.status !== "Liberada ao financeiro");
  const releasedOperations = activeOperations.filter(op => op.status === "Liberada ao financeiro");
  const releasedValue = releasedOperations.reduce(
    (sum, op) =>
      sum +
      (op.releaseReview?.payables ?? [])
        .filter(item => item.status !== "Cancelado")
        .reduce((acc, item) => acc + item.amount, 0),
    0,
  );
  const total = inProgressOperations.reduce((sum, op) => sum + op.amount, 0);
  const readyValue = activeOperations
    .filter(op => op.status === "Pronta para liberar")
    .reduce((sum, op) => sum + op.amount, 0);
  const exceptionCount = inProgressOperations.filter(op => {
    const route = op.eligibilityReview ? eligibilityRouteFor(op) : undefined;
    return route ? !route.canAdvance || route.alerts > 0 : op.blockers > 0 || op.alerts > 1;
  }).length;
  const decisionCount = inProgressOperations.filter(op =>
    op.eligibilityReview ? eligibilityRouteFor(op).requiresHumanDecision : op.blockers > 0,
  ).length;
  const interventionCount = screenOperations.filter(needsIntervention).length;
  const formalizationCount = screenOperations.filter(readyForFormalization).length;
  const cancellationCount = screenOperations.filter(op => op.status === "Cancelada").length;
  const financialSnapshot = activeOperations.map(op => {
    const opPricing = normalizedPricing(op);
    const calc = pricingCalculation(op, opPricing);
    const face = calc.face || op.amount;
    const gain = calc.face > 0 ? calc.originalDiscount + calc.fees : Math.max(0, op.amount - op.netAmount);
    const finalRate = calc.face > 0 && calc.allInMonthly > 0 ? calc.allInMonthly : opPricing.monthlyRate;
    return { face, gain, baseRate: opPricing.monthlyRate, finalRate };
  });
  const totalGain = financialSnapshot.reduce((sum, item) => sum + item.gain, 0);
  const snapshotFace = financialSnapshot.reduce((sum, item) => sum + item.face, 0);
  const averageFinalRate = snapshotFace
    ? financialSnapshot.reduce((sum, item) => sum + item.finalRate * item.face, 0) / snapshotFace
    : 0;
  const averageBaseRate = snapshotFace
    ? financialSnapshot.reduce((sum, item) => sum + item.baseRate * item.face, 0) / snapshotFace
    : 0;
  const gainPercent = snapshotFace ? (totalGain / snapshotFace) * 100 : 0;
  const readyCount = activeOperations.filter(op => op.status === "Pronta para liberar").length;
  return {
    inProgressOperations,
    releasedOperations,
    releasedValue,
    total,
    readyValue,
    exceptionCount,
    decisionCount,
    interventionCount,
    formalizationCount,
    cancellationCount,
    totalGain,
    averageFinalRate,
    averageBaseRate,
    gainPercent,
    readyCount,
  };
}

/** Colunas do kanban operacional (antes dos filtros de tela). */
export function kanbanColumnsFor(inProgressOperations: Operation[], releasedOperations: Operation[]) {
  return [
    {
      id: "processing",
      title: "Entrada e processamento",
      description: "Fluxo automático em execução",
      tone: "processing",
      operations: inProgressOperations.filter(op => !needsIntervention(op) && op.stage <= 3),
    },
    {
      id: "intervention",
      title: "Intervenção humana",
      description: "Exigem análise ou decisão",
      tone: "intervention",
      operations: inProgressOperations.filter(needsIntervention),
    },
    {
      id: "automatic",
      title: "Processada automaticamente",
      description: "Condição sendo consolidada",
      tone: "automatic",
      operations: inProgressOperations.filter(
        op => !needsIntervention(op) && op.stage === 4 && !(op.blockers === 0 && op.automation >= 80),
      ),
    },
    {
      id: "formalization",
      title: "Pronta para formalizar",
      description: "Pacote pronto para conferência",
      tone: "formalization",
      operations: inProgressOperations.filter(
        op =>
          !needsIntervention(op) && ((op.stage === 4 && op.blockers === 0 && op.automation >= 80) || op.stage === 5),
      ),
    },
    {
      id: "release",
      title: "Pronta para liberar",
      description: "Aprovação e assinatura concluídas",
      tone: "release",
      operations: inProgressOperations.filter(op => !needsIntervention(op) && op.stage === 6),
    },
    {
      id: "released",
      title: "Liberadas ao financeiro",
      description: "Aguardando ou com pagamento no financeiro",
      tone: "released",
      operations: releasedOperations,
    },
  ];
}
