"use client";

import { type AccessState } from "@/src/domain/access/model";
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
