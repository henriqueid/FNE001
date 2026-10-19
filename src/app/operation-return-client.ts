/** Cliente do comando atômico de devolução com repetição segura após falha de transporte. */
import type { OperationReturnCommand, OperationReturnResult } from "@/src/server/operations/return";
import { getStratoTenantId } from "./tenant";
export async function returnReleasedOperation(command: OperationReturnCommand): Promise<OperationReturnResult> {
  const send = () =>
    fetch("/api/operations/return", {
      method: "POST",
      headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
      body: JSON.stringify(command),
    });
  let response: Response;
  try {
    response = await send();
  } catch {
    response = await send();
  }
  const body = (await response.json()) as { result?: OperationReturnResult; error?: string };
  if (!response.ok || !body.result) throw new Error(body.error ?? "A devolução não foi confirmada.");
  return body.result;
}
