/** Intenções de execução e exceção; o servidor calcula fatos, política, autoria e alçada. */
import type { Operation } from "@/src/domain/core/types";
import type { EligibilityOverride, EligibilityRun } from "@/src/domain/eligibility/model";
import type { EligibilityDecisionCommand } from "@/src/server/operations/eligibility-exceptions";
import { getStratoTenantId } from "./tenant";
import { operationSavedByServer } from "./operation-server-result";
export type AuthoritativeEligibility = {
  run: EligibilityRun;
  runHash: string;
  overrides: EligibilityOverride[];
  version: number;
};
type Command<T> = T extends unknown ? Omit<T, "commandId"> : never;
async function request<T>(url: string, command?: unknown): Promise<T> {
  const options = {
    cache: "no-store" as const,
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
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar a análise autoritativa.");
  return body;
}
export const loadAuthoritativeEligibility = (operationId: string) =>
  request<AuthoritativeEligibility>(`/api/operations/eligibility?operationId=${encodeURIComponent(operationId)}`);
export async function decideEligibility(command: Command<EligibilityDecisionCommand>) {
  const response = await request<{ operation: Operation }>("/api/operations/eligibility", {
    ...command,
    commandId: crypto.randomUUID(),
  });
  return operationSavedByServer(response.operation);
}
