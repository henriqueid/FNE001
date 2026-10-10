import { type DecisionEvent, type DecisionEventDraft, type DecisionLedger } from "@/src/domain/decisions/model";
import { authenticatedFetch } from "@/src/app/session-client";

async function bodyOrError<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar a trilha de decisões.");
  return body;
}

export async function loadDecisionLedger(tenantId: string, decisionId: string) {
  const response = await authenticatedFetch(
    `/api/decisions?decisionId=${encodeURIComponent(decisionId)}`,
    {},
    tenantId,
  );
  return bodyOrError<DecisionLedger>(response);
}

export async function persistDecisionEvent(tenantId: string, event: DecisionEventDraft) {
  const response = await authenticatedFetch(
    "/api/decisions",
    { method: "POST", headers: { "idempotency-key": event.eventId }, body: JSON.stringify(event) },
    tenantId,
  );
  return (await bodyOrError<{ event: DecisionEvent }>(response)).event;
}
