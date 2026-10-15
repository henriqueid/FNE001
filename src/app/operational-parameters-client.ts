import type { OperationalDefaultsState } from "@/src/domain/registry/operational-profile";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function body<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível acessar os parâmetros operacionais.");
  return payload;
}

export async function loadOperationalParameters() {
  const response = await fetch("/api/operational-parameters", { cache: "no-store", headers: headers() });
  return body<{ state: OperationalDefaultsState }>(response);
}

export async function persistOperationalParameters(state: OperationalDefaultsState) {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/operational-parameters", {
      method: "PUT",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ state, expectedVersion: state.persistenceVersion ?? 0, commandId }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return (await body<{ state: OperationalDefaultsState }>(response)).state;
}
