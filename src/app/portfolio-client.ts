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
