import type { CommercialState } from "@/src/domain/commercial/types";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function body<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível acessar o Comercial.");
  return payload;
}

export async function loadCommercialState(): Promise<CommercialState | null> {
  const response = await fetch("/api/commercial", { cache: "no-store", headers: headers() });
  return (await body<{ commercial: CommercialState | null }>(response)).commercial;
}

export async function persistCommercialState(commercial: CommercialState): Promise<CommercialState> {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/commercial", {
      method: "PUT",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({
        commercial,
        expectedVersion: commercial.persistenceVersion ?? 0,
        commandId,
      }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return (await body<{ commercial: CommercialState }>(response)).commercial;
}
