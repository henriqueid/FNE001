import type { FinanceState } from "@/src/domain/finance/model";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { ReceivableCommand } from "@/src/server/portfolio/financial-commands";
import { getStratoTenantId } from "./tenant";

export async function sendReceivableCommand(command: ReceivableCommand) {
  const request = () =>
    fetch("/api/portfolio/settlements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
      body: JSON.stringify(command),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  const body = (await response.json()) as { finance?: FinanceState; portfolio?: PortfolioState; error?: string };
  if (!response.ok || !body.finance || !body.portfolio)
    throw new Error(body.error ?? "Não foi possível confirmar o recebimento.");
  return { finance: body.finance, portfolio: body.portfolio };
}
