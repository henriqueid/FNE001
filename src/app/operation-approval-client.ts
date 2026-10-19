/** Clientes dos comandos de alçada; a identidade e os resultados são definidos no servidor. */
import type { Operation } from "@/src/domain/core/types";
import type { ApprovalSlot } from "@/src/server/operations/approval-evidence";
import type { OperationApprovalCommand } from "@/src/server/operations/approval";
import type { ApprovalPolicyCommand } from "@/src/server/operations/approval-policy";
import { getStratoTenantId } from "./tenant";
import { operationSavedByServer } from "./operation-server-result";

async function request<T>(url: string, command?: unknown): Promise<T> {
  const options: RequestInit = {
    cache: "no-store",
    headers: { "x-strato-tenant-id": getStratoTenantId(), "content-type": "application/json" },
    ...(command ? { method: "POST", body: JSON.stringify(command) } : {}),
  };
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    response = await fetch(url, options);
  }
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar as alçadas.");
  return body;
}
export async function decideOperationApproval(command: Omit<OperationApprovalCommand, "commandId">) {
  return operationSavedByServer(
    (
      await request<{ operation: Operation }>("/api/operations/approval", {
        ...command,
        commandId: crypto.randomUUID(),
      })
    ).operation,
  );
}
export const loadOperationApproval = (operationId: string) =>
  request<{ slots: ApprovalSlot[] }>(`/api/operations/approval?operationId=${encodeURIComponent(operationId)}`);
export type ApprovalPolicyConfiguration = {
  version: number;
  policy?: { eventId: string; company: string; slots: ApprovalSlot[] };
  authorities: string[];
  proposals: { eventId: string; actorId: string; company: string; slots: ApprovalSlot[]; reason: string }[];
};
export const loadApprovalPolicy = (company: string) =>
  request<ApprovalPolicyConfiguration>(`/api/operations/approval-policy?company=${encodeURIComponent(company)}`);
type WithoutCommandId<T> = T extends unknown ? Omit<T, "commandId"> : never;
export const changeApprovalPolicy = (command: WithoutCommandId<ApprovalPolicyCommand>) =>
  request<ApprovalPolicyConfiguration>("/api/operations/approval-policy", {
    ...command,
    commandId: crypto.randomUUID(),
  });
