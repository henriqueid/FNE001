import type { FinanceState } from "@/src/domain/finance/model";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar o Financeiro.");
  return body;
}

export async function loadFinanceState(): Promise<FinanceState | null> {
  const response = await fetch("/api/finance", { cache: "no-store", headers: headers() });
  return (await responseBody<{ finance: FinanceState | null }>(response)).finance;
}

export async function persistFinanceState(finance: FinanceState): Promise<FinanceState> {
  const response = await fetch("/api/finance", {
    method: "PUT",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ finance, expectedVersion: finance.persistenceVersion ?? 0 }),
  });
  return (await responseBody<{ finance: FinanceState }>(response)).finance;
}
