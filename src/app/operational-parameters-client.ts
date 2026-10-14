import type {
  OperationalDefaultsState,
  OperationalParameterChangeRequest,
} from "@/src/domain/registry/operational-profile";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function body<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível acessar os parâmetros operacionais.");
  return payload;
}

export async function loadOperationalParameters() {
  const response = await fetch("/api/operational-parameters", { cache: "no-store", headers: headers() });
  return body<{ state: OperationalDefaultsState; requests: OperationalParameterChangeRequest[] }>(response);
}

export async function proposeOperationalParameters(
  proposed: OperationalDefaultsState,
  expectedVersion: number,
  reason: string,
) {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/operational-parameters", {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ proposed, expectedVersion, reason, commandId }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return (await body<{ requests: OperationalParameterChangeRequest[] }>(response)).requests;
}

export async function decideOperationalParameters(changeId: string, decision: "APPROVED" | "REJECTED", reason: string) {
  const response = await fetch("/api/operational-parameters", {
    method: "PUT",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ changeId, decision, reason }),
  });
  return body<{ state: OperationalDefaultsState; requests: OperationalParameterChangeRequest[] }>(response);
}
