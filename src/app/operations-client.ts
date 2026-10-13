import type { Operation } from "@/src/domain/core/types";
import { expectedOperationVersion } from "@/src/domain/operations/persistence";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar as operações.");
  return body;
}

export async function loadOperations(): Promise<Operation[]> {
  const response = await fetch("/api/operations", { cache: "no-store", headers: headers() });
  return (await responseBody<{ operations: Operation[] }>(response)).operations;
}

export async function persistOperation(operation: Operation): Promise<Operation> {
  const response = await fetch("/api/operations", {
    method: "PUT",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({ operation, expectedVersion: expectedOperationVersion(operation) }),
  });
  return (await responseBody<{ operation: Operation }>(response)).operation;
}
