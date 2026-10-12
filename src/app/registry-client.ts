import { getStratoTenantId } from "./tenant";
import type { Party } from "@/src/domain/registry/parties";
import type { RegistryPartySearchItem, RegistryPartyStats } from "@/src/server/registry/repository";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });
export async function loadRegistryParties(): Promise<Party[]> {
  const response = await fetch("/api/registry/parties", { cache: "no-store", headers: headers() });
  if (!response.ok) throw new Error("Não foi possível carregar os cadastros.");
  return ((await response.json()) as { parties: Party[] }).parties;
}
export async function searchRegistryParties(options: {
  role?: string;
  query?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: RegistryPartySearchItem[]; total: number }> {
  const params = new URLSearchParams();
  if (options.role) params.set("role", options.role);
  if (options.query) params.set("q", options.query);
  if (options.status) params.set("status", options.status);
  params.set("limit", String(options.limit ?? 50));
  params.set("offset", String(options.offset ?? 0));
  const response = await fetch(`/api/registry/parties?${params}`, { cache: "no-store", headers: headers() });
  if (!response.ok) throw new Error("Não foi possível consultar os cadastros.");
  return (await response.json()) as { items: RegistryPartySearchItem[]; total: number };
}
export async function loadRegistryPartyStats(): Promise<RegistryPartyStats> {
  const response = await fetch("/api/registry/parties?stats=1", { cache: "no-store", headers: headers() });
  if (!response.ok) throw new Error("Não foi possível carregar os totais dos cadastros.");
  return ((await response.json()) as { stats: RegistryPartyStats }).stats;
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
