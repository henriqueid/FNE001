/**
 * Ritmo da operação comparado ao padrão histórico do cliente (mais rápida, no padrão, mais lenta, aprendendo).
 */
import { type Operation } from "@/src/domain/core/types";
import { formatDuration } from "./format";

export function paceFor(operation: Operation) {
  if (operation.historySample < 5 || operation.clientAverageMinutes <= 0) {
    return { tone: "learning", label: "criando padrão", detail: "histórico ainda insuficiente" };
  }
  const difference = operation.elapsedMinutes - operation.clientAverageMinutes;
  const ratio = operation.elapsedMinutes / operation.clientAverageMinutes;
  if (ratio > 1.15)
    return {
      tone: "slower",
      label: `${formatDuration(difference)} mais lenta`,
      detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações`,
    };
  if (ratio < 0.85)
    return {
      tone: "faster",
      label: `${formatDuration(Math.abs(difference))} mais rápida`,
      detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações`,
    };
  return {
    tone: "standard",
    label: "dentro do padrão",
    detail: `Média ${formatDuration(operation.clientAverageMinutes)} · ${operation.historySample} operações`,
  };
}

export function needsIntervention(operation: Operation) {
  if (operation.status === "Cancelada" || operation.status === "Liberada ao financeiro") return false;
  return (
    operation.blockers > 0 ||
    operation.alerts > 1 ||
    paceFor(operation).tone === "slower" ||
    (operation.stage <= 3 && operation.automation < 80)
  );
}
