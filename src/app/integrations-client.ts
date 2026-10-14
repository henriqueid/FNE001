import type { IntegrationState } from "@/src/domain/integrations/model";
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
