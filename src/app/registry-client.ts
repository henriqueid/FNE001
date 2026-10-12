import { getStratoTenantId } from "./tenant";
import type { Party } from "@/src/domain/registry/parties";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });
export async function loadRegistryParties(): Promise<Party[]> {
  const response = await fetch("/api/registry/parties", { cache: "no-store", headers: headers() });
  if (!response.ok) throw new Error("Não foi possível carregar os cadastros.");
  return ((await response.json()) as { parties: Party[] }).parties;
}
export async function persistRegistryParty(party: Party) {
  const response = await fetch("/api/registry/parties", {
    method: "PUT",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify(party),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o cadastro no banco.");
}
