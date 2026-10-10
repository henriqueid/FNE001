import { env } from "cloudflare:workers";
import { type DecisionEventType } from "@/src/domain/decisions/model";
import { assertDecisionPermission, DecisionAccessError, decisionPrincipal } from "@/src/server/decisions/access";
import { appendDecisionEvent, DecisionConflictError, listDecisionEvents } from "@/src/server/decisions/repository";
import { parseDecisionEventDraft } from "@/src/server/decisions/validation";

const json = (body: unknown, status = 200) => Response.json(body, { status });

function failure(error: unknown) {
  if (error instanceof DecisionAccessError) return json({ error: error.message }, error.status);
  if (error instanceof DecisionConflictError) return json({ error: error.message }, 409);
  if (error instanceof Error) return json({ error: error.message }, 400);
  return json({ error: "Falha inesperada na trilha de decisões." }, 500);
}

export async function GET(request: Request) {
  try {
    const principal = await decisionPrincipal(env.DB, request.headers);
    assertDecisionPermission(principal.user);
    const decisionId = new URL(request.url).searchParams.get("decisionId")?.trim();
    if (!decisionId) return json({ error: "Decisão não informada." }, 400);
    const events = await listDecisionEvents(env.DB, principal.tenantId, decisionId);
    return json({ version: 1, events });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await decisionPrincipal(env.DB, request.headers);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200)
      return json({ error: "Chave de idempotência ausente ou inválida." }, 400);
    const draft = parseDecisionEventDraft(await request.json());
    assertDecisionPermission(principal.user, draft.eventType as DecisionEventType, draft.authorityId);
    const result = await appendDecisionEvent(
      env.DB,
      { tenantId: principal.tenantId, actorId: principal.user.id, actorRole: principal.user.role },
      draft,
      idempotencyKey,
    );
    return json(result, result.replayed ? 200 : 201);
  } catch (error) {
    return failure(error);
  }
}
