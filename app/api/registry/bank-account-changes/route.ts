import type { PartyBankAccount } from "@/src/domain/registry/parties";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  decideBankAccountChange,
  listBankAccountChanges,
  requestBankAccountChange,
  type BankAccountChangeStatus,
} from "@/src/server/registry/bank-account-changes";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("registry:edit"))
    return { error: json({ error: "Sem permissão para manter dados bancários cadastrais." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

function conflict(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Não foi possível processar a alteração bancária.";
  const status = /já recebeu|mudou depois|própria alteração|iguais às atuais|pendente/i.test(message) ? 409 : 400;
  return json({ error: message }, status);
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const value = new URL(request.url).searchParams.get("status")?.toUpperCase();
  const status = ["PENDING", "APPROVED", "REJECTED"].includes(value ?? "")
    ? (value as BankAccountChangeStatus)
    : undefined;
  return json({ changes: await listBankAccountChanges(access.db, access.tenantId, status) });
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as {
    partyId?: string;
    proposedAccounts?: PartyBankAccount[];
    reason?: string;
  } | null;
  if (!body?.partyId || !Array.isArray(body.proposedAccounts))
    return json({ error: "Solicitação bancária inválida." }, 400);
  try {
    const changeId = await requestBankAccountChange(
      access.db,
      access.tenantId,
      access.principal.id,
      body.partyId,
      body.proposedAccounts,
      body.reason ?? "",
    );
    return json({ changeId, status: "PENDING" }, 201);
  } catch (reason) {
    return conflict(reason);
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as {
    changeId?: string;
    decision?: "APPROVED" | "REJECTED";
    reason?: string;
  } | null;
  if (!body?.changeId || !body.decision || !["APPROVED", "REJECTED"].includes(body.decision))
    return json({ error: "Decisão bancária inválida." }, 400);
  try {
    const result = await decideBankAccountChange(
      access.db,
      access.tenantId,
      access.principal,
      body.changeId,
      body.decision,
      body.reason ?? "",
    );
    return json(result);
  } catch (reason) {
    return conflict(reason);
  }
}
