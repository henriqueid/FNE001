import type { CompanyDestination, CompanyDestinationDraft } from "@/src/domain/company/destination";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() });

async function bodyOf<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar as empresas e veículos.");
  return body;
}

export async function loadCompanyDestinations() {
  const response = await fetch("/api/company/destinations", { cache: "no-store", headers: headers() });
  return (await bodyOf<{ destinations: CompanyDestination[] }>(response)).destinations;
}

export async function createCompanyDestination(input: CompanyDestinationDraft) {
  const response = await fetch("/api/company/destinations", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  return (await bodyOf<{ destination: CompanyDestination }>(response)).destination;
}
