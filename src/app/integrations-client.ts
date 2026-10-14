import type {
  IntegrationChangeProposal,
  IntegrationCapability,
  IntegrationState,
} from "@/src/domain/integrations/model";
import { getStratoTenantId } from "./tenant";

export async function loadIntegrationState(): Promise<IntegrationState> {
  const response = await fetch("/api/integrations/configuration", {
    cache: "no-store",
    headers: { "x-strato-tenant-id": getStratoTenantId() },
  });
  const body = (await response.json().catch(() => ({}))) as { integrations?: IntegrationState; error?: string };
  if (!response.ok || !body.integrations)
    throw new Error(body.error ?? "Não foi possível carregar a disponibilidade das integrações.");
  return body.integrations;
}

async function integrationResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { integrations?: IntegrationState; error?: string };
  if (!response.ok || !payload.integrations)
    throw new Error(payload.error ?? "Não foi possível alterar a configuração das integrações.");
  return payload.integrations;
}

export async function proposeIntegrationChange(
  capability: IntegrationCapability,
  proposed: IntegrationChangeProposal[],
  reason: string,
) {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/integrations/configuration", {
      method: "POST",
      headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
      body: JSON.stringify({ capability, proposed, reason, commandId }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return integrationResponse(response);
}

export async function decideIntegrationChange(changeId: string, decision: "APPROVED" | "REJECTED", reason: string) {
  const response = await fetch("/api/integrations/configuration", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
    body: JSON.stringify({ changeId, decision, reason }),
  });
  return integrationResponse(response);
}
