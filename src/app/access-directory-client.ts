"use client";

import { type AccessChangeRequest } from "@/src/domain/access/governance";
import { type AccessState, type AccessUser } from "@/src/domain/access/model";
import { authenticatedFetch } from "./session-client";

async function accessBody(response: Response) {
  const body = (await response.json()) as AccessState & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível sincronizar os usuários e acessos.");
  return body;
}

export async function loadAccessDirectory(tenantId: string) {
  return accessBody(await authenticatedFetch("/api/access/users", {}, tenantId));
}

export async function createManagedUser(
  tenantId: string,
  input: { name: string; email: string; loginName: string; cpf: string; password: string; department: string },
) {
  const response = await authenticatedFetch(
    "/api/access/users",
    { method: "POST", body: JSON.stringify(input) },
    tenantId,
  );
  const body = (await response.json()) as { state?: AccessState; createdUserId?: string; error?: string };
  if (!response.ok || !body.state || !body.createdUserId)
    throw new Error(body.error ?? "Não foi possível adicionar o usuário.");
  return { state: body.state, createdUserId: body.createdUserId };
}

export async function saveAccessDirectory(tenantId: string, state: AccessState) {
  return accessBody(
    await authenticatedFetch(
      "/api/access/users",
      { method: "PUT", body: JSON.stringify({ ...state, previewUserId: undefined }) },
      tenantId,
    ),
  );
}

/** Atualiza somente o perfil editado para não reenviar concessões antigas de outros usuários. */
export async function saveAccessUser(tenantId: string, state: AccessState, user: AccessUser) {
  return saveAccessDirectory(tenantId, { ...state, users: [user] });
}

async function accessChangesBody(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    applied?: boolean;
    requests?: AccessChangeRequest[];
    state?: AccessState;
    error?: string;
  } | null;
  if (!response.ok || !body) throw new Error(body?.error ?? "Não foi possível acessar as aprovações de acesso.");
  return body;
}

export async function loadAccessChangeRequests(tenantId: string) {
  const body = await accessChangesBody(
    await authenticatedFetch("/api/access/change-requests", { cache: "no-store" }, tenantId),
  );
  return body.requests ?? [];
}

export async function createAccessChangeRequest(
  tenantId: string,
  subjectUserId: string,
  proposed: AccessUser,
  reason: string,
) {
  const body = await accessChangesBody(
    await authenticatedFetch(
      "/api/access/change-requests",
      { method: "POST", body: JSON.stringify({ subjectUserId, proposed, reason }) },
      tenantId,
    ),
  );
  return body;
}

export async function decideAccessChangeRequest(
  tenantId: string,
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string,
) {
  return accessChangesBody(
    await authenticatedFetch(
      "/api/access/change-requests",
      { method: "PUT", body: JSON.stringify({ changeId, decision, reason }) },
      tenantId,
    ),
  );
}
