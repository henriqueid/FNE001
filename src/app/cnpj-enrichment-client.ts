import type { CnpjEvidence } from "@/src/domain/integrations/cnpj";
import { getStratoTenantId } from "./tenant";

export async function consultCnpj(partyId: string, force = false): Promise<CnpjEvidence> {
  const response = await fetch("/api/integrations/cnpj", {
    method: "POST",
    headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
    body: JSON.stringify({ partyId, force }),
  });
  const body = (await response.json().catch(() => ({}))) as { evidence?: CnpjEvidence; error?: string };
  if (!response.ok || !body.evidence) throw new Error(body.error ?? "Não foi possível consultar o CNPJ.");
  return body.evidence;
}

export async function consultLeadCnpj(document: string): Promise<CnpjEvidence> {
  const response = await fetch("/api/integrations/cnpj", {
    method: "POST",
    headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
    body: JSON.stringify({ document }),
  });
  const body = (await response.json().catch(() => ({}))) as { evidence?: CnpjEvidence; error?: string };
  if (!response.ok || !body.evidence) throw new Error(body.error ?? "Não foi possível consultar o CNPJ do lead.");
  return body.evidence;
}
