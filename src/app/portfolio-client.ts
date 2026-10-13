import type { PortfolioState } from "@/src/domain/portfolio/model";
import { getStratoTenantId } from "./tenant";

export async function loadCurrentPortfolio(): Promise<PortfolioState> {
  const response = await fetch("/api/portfolio", {
    cache: "no-store",
    headers: { "x-strato-tenant-id": getStratoTenantId() },
  });
  const body = (await response.json().catch(() => ({}))) as { portfolio?: PortfolioState; error?: string };
  if (!response.ok || !body.portfolio) throw new Error(body.error ?? "Não foi possível carregar a carteira.");
  return body.portfolio;
}

export async function persistPortfolioState(portfolio: PortfolioState): Promise<PortfolioState> {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/portfolio", {
      method: "PUT",
      headers: { "x-strato-tenant-id": getStratoTenantId(), "content-type": "application/json" },
      body: JSON.stringify({ portfolio, expectedVersion: portfolio.persistenceVersion ?? 0, commandId }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  const body = (await response.json().catch(() => ({}))) as { portfolio?: PortfolioState; error?: string };
  if (!response.ok || !body.portfolio) throw new Error(body.error ?? "Não foi possível salvar a Carteira.");
  return body.portfolio;
}
