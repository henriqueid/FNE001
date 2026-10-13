import type { EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar as políticas.");
  return body;
}

export async function loadEligibilityPolicyState(): Promise<EligibilityPolicyState | null> {
  const response = await fetch("/api/eligibility-policies", { cache: "no-store", headers: headers() });
  return (await responseBody<{ policies: EligibilityPolicyState | null }>(response)).policies;
}

export async function persistEligibilityPolicyState(policies: EligibilityPolicyState): Promise<EligibilityPolicyState> {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/eligibility-policies", {
      method: "PUT",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({
        policies,
        expectedVersion: policies.persistenceVersion ?? 0,
        commandId,
      }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return (await responseBody<{ policies: EligibilityPolicyState }>(response)).policies;
}
