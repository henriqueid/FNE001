/** Cliente do comando de revisão da Aprovação, sem transportar snapshot decisório. */
import type { Operation } from "@/src/domain/core/types";
import { getStratoTenantId } from "@/src/app/tenant";
import { operationSavedByServer } from "@/src/app/operation-server-result";

export async function returnApprovalToRisk(
  operationId: string,
  expectedVersion: number,
  reason: string,
): Promise<Operation> {
  const body = JSON.stringify({ operationId, expectedVersion, reason, commandId: crypto.randomUUID() });
  const send = () =>
    fetch("/api/operations/return-to-risk", {
      method: "POST",
      cache: "no-store",
      headers: { "x-strato-tenant-id": getStratoTenantId(), "content-type": "application/json" },
      body,
    });
  let response: Response;
  try {
    response = await send();
  } catch {
    response = await send();
  }
  const result = (await response.json()) as { operation?: Operation; error?: string };
  if (!response.ok || !result.operation) throw new Error(result.error ?? "A devolução ao Risco não foi confirmada.");
  return operationSavedByServer(result.operation);
}
