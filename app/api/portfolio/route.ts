import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import { validatePortfolioState } from "@/src/domain/portfolio/persistence";
import {
  loadCurrentPortfolio,
  PortfolioCommandConflictError,
  portfolioRequestHash,
  PortfolioTransitionError,
  savePortfolioState,
} from "@/src/server/portfolio/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  return json({ portfolio: await loadCurrentPortfolio(db, tenantId) });
}

export async function PUT(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return json({ error: "Empresa não informada." }, 400);
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return json({ error: "Sessão ausente ou expirada." }, 401);
  if (!principal.permissions.includes("portfolio:manage") && !principal.permissions.includes("controlleria:formalize"))
    return json({ error: "Sem permissão para manter a Carteira." }, 403);
  const command = (await request.json().catch(() => null)) as {
    portfolio?: PortfolioState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.portfolio ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    !command.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando da Carteira inválido." }, 400);
  const validationError = validatePortfolioState(command.portfolio);
  if (validationError) return json({ error: validationError }, 400);
  const expectedVersion = Number(command.expectedVersion);
  const requestHash = await portfolioRequestHash({
    tenantId,
    actorId: principal.id,
    expectedVersion,
    state: command.portfolio,
  });
  try {
    const portfolio = await savePortfolioState(
      db,
      tenantId,
      { id: principal.id, name: principal.name },
      command.portfolio,
      expectedVersion,
      command.commandId,
      requestHash,
    );
    if (!portfolio)
      return json({ error: "A Carteira foi alterada por outra pessoa. Atualize a página e tente novamente." }, 409);
    return json({ portfolio });
  } catch (reason) {
    if (reason instanceof PortfolioCommandConflictError || reason instanceof PortfolioTransitionError)
      return json({ error: reason.message }, 409);
    console.error("portfolio_state_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar a Carteira. Tente novamente." }, 500);
  }
}
