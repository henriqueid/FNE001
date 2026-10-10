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

export async function saveAccessDirectory(tenantId: string, state: AccessState) {
  return accessBody(
    await authenticatedFetch(
      "/api/access/users",
      { method: "PUT", body: JSON.stringify({ ...state, previewUserId: undefined }) },
      tenantId,
    ),
  );
}
