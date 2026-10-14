import { getStratoTenantId } from "./tenant";
import type { Party, PartyBankAccount } from "@/src/domain/registry/parties";
import type { RegistryPartySearchItem, RegistryPartyStats } from "@/src/server/registry/repository";
import type { BankAccountChange } from "@/src/server/registry/bank-account-changes";

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

async function bankChangeRequest(path = "", init?: RequestInit) {
  const response = await fetch(`/api/registry/bank-account-changes${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...headers(), ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível processar a alteração bancária.");
  return body;
}

export async function loadBankAccountChanges(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  const body = (await bankChangeRequest(`?status=${status}`)) as { changes: BankAccountChange[] };
  return body.changes;
}

export async function requestRegistryBankAccountChange(
  partyId: string,
  proposedAccounts: PartyBankAccount[],
  reason: string,
) {
  return bankChangeRequest("", {
    method: "POST",
    body: JSON.stringify({ partyId, proposedAccounts, reason }),
  }) as Promise<{ changeId: string; status: "PENDING" }>;
}

export async function decideRegistryBankAccountChange(
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string,
) {
  return bankChangeRequest("", { method: "PUT", body: JSON.stringify({ changeId, decision, reason }) });
}
