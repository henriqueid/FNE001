import type { DecisionEvent, DecisionEventType } from "@/src/domain/decisions/model";

export class DecisionGovernanceError extends Error {}

const terminalEvents = new Set<DecisionEventType>(["EXCEPTION_APPROVED", "EXCEPTION_REJECTED"]);

export function assertExceptionMakerChecker(events: DecisionEvent[], actorId: string, eventType: DecisionEventType) {
  if (!terminalEvents.has(eventType)) return;
  const requestIndex = events.findLastIndex(event => event.eventType === "EXCEPTION_REQUESTED");
  if (requestIndex < 0)
    throw new DecisionGovernanceError("A exceção precisa ser solicitada antes de receber uma decisão de alçada.");
  const request = events[requestIndex];
  if (request.actorId === actorId)
    throw new DecisionGovernanceError("Quem solicitou a exceção não pode decidir a própria solicitação.");
  if (events.slice(requestIndex + 1).some(event => terminalEvents.has(event.eventType)))
    throw new DecisionGovernanceError("Esta solicitação de exceção já recebeu uma decisão de alçada.");
}
