import { type AccessUser } from "@/src/domain/access/model";
import { type DecisionEvent, type DecisionEventDraft, type DecisionLedger } from "@/src/domain/decisions/model";

const headersFor = (actor: AccessUser, tenantId: string) => ({
  "content-type": "application/json",
  "x-strato-user-id": actor.id,
  "x-strato-tenant-id": tenantId,
});

async function bodyOrError<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar a trilha de decisões.");
  return body;
}

export async function loadDecisionLedger(actor: AccessUser, tenantId: string, decisionId: string) {
  const response = await fetch(`/api/decisions?decisionId=${encodeURIComponent(decisionId)}`, {
    headers: headersFor(actor, tenantId),
  });
  return bodyOrError<DecisionLedger>(response);
}

export async function persistDecisionEvent(actor: AccessUser, tenantId: string, event: DecisionEventDraft) {
  const response = await fetch("/api/decisions", {
    method: "POST",
    headers: headersFor(actor, tenantId),
    body: JSON.stringify(event),
  });
  return (await bodyOrError<{ event: DecisionEvent }>(response)).event;
}
