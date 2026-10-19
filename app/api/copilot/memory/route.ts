/** Observações e revisões; texto livre nunca concede aprovação de crédito. */
import { copilotRequestContext, copilotFailure, CopilotHttpError } from "@/src/server/copilot/http";
import { appendMemory, listMemories, reviewMemory, reviewMemoryError } from "@/src/server/copilot/memory-repository";
import { loadCopilotSources } from "@/src/server/copilot/sources";
import { validateMemoryDraft } from "@/src/domain/copilot/behavior";
export async function GET(request: Request) {
  try {
    const { db, principal } = await copilotRequestContext(request);
    const sources = await loadCopilotSources(db, principal);
    return Response.json({ events: await listMemories(db, principal, sources.entityCompanies) });
  } catch (error) {
    return copilotFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db, principal } = await copilotRequestContext(request);
    const validation = validateMemoryDraft(await request.json().catch(() => null));
    if (!validation.ok) throw new CopilotHttpError(validation.error, 400);
    const sources = await loadCopilotSources(db, principal);
    if (sources.entityCompanies.get(validation.draft.entityId) !== validation.draft.company)
      throw new CopilotHttpError("Entidade ou empresa fora do seu acesso atual.", 403);
    return Response.json(
      { event: await appendMemory(db, principal, validation.draft, sources.entityCompanies) },
      { status: 201 },
    );
  } catch (error) {
    return copilotFailure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db, principal } = await copilotRequestContext(request);
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      status?: unknown;
      rationale?: unknown;
    } | null;
    if (
      !body ||
      typeof body.id !== "string" ||
      body.id.length > 100 ||
      !["validated", "rejected", "revoked"].includes(String(body.status)) ||
      typeof body.rationale !== "string" ||
      !body.rationale.trim() ||
      body.rationale.length > 2000
    )
      throw new CopilotHttpError("Informe memória, revisão e justificativa válidas.", 400);
    const sources = await loadCopilotSources(db, principal);
    const event = (await listMemories(db, principal, sources.entityCompanies)).find(event => event.id === body.id);
    if (!event) throw new CopilotHttpError("Memória indisponível para seu acesso.", 404);
    const error = reviewMemoryError(principal, event, body.status as "validated" | "rejected" | "revoked");
    if (error) throw new CopilotHttpError(error, 403);
    await reviewMemory(
      db,
      principal,
      body.id,
      body.status as "validated" | "rejected" | "revoked",
      body.rationale.trim(),
      sources.entityCompanies,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return copilotFailure(error);
  }
}
