/** Materializa compra e contas a pagar no servidor, na transação da liberação. */
import type { Operation } from "@/src/domain/core/types";
import { normalizedPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { syncReleases } from "@/src/domain/finance/releases";
import { emptyFinance } from "@/src/domain/finance/setup";
import { validateFinanceState } from "@/src/domain/finance/persistence";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { financeRequestHash, FinanceTransitionError, loadFinanceState, saveFinanceState } from "./repository";
import { reactivateReturnedPortfolio } from "@/src/server/portfolio/operation-cycle";

export async function syncReleasedOperationFinance(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
) {
  if (operation.status !== "Liberada ao financeiro" || operation.releaseReview?.status !== "Enviada ao financeiro")
    return;
  const current = (await loadFinanceState(db, tenantId)) ?? emptyFinance();
  const calculated = operation.pricingReview ? pricingCalculation(operation, normalizedPricing(operation)) : null;
  const financials = {
    face: calculated?.face ?? operation.amount,
    discount: calculated?.originalDiscount ?? Math.max(0, operation.amount - operation.netAmount),
    fees: calculated?.fees ?? 0,
    revenue: 0,
    rate: 0,
    net: calculated?.net ?? operation.netAmount,
  };
  const next = syncReleases(current, [operation], { [operation.id]: financials }, actorId);
  if (next === current) return;
  const error = validateFinanceState(next);
  if (error) throw new FinanceTransitionError(error);
  const expectedVersion = current.persistenceVersion ?? 0;
  const requestHash = await financeRequestHash({ tenantId, actorId, expectedVersion, state: next });
  const saved = await saveFinanceState(
    db,
    tenantId,
    actorId,
    next,
    expectedVersion,
    `release:${operation.id}:${operation.persistenceVersion ?? 0}`,
    requestHash,
    { allowNewReleaseTitles: true },
  );
  if (!saved) throw new FinanceTransitionError("O Financeiro mudou durante a liberação. Atualize e tente novamente.");
  const priorPurchase = current.journal.find(entry => entry.id === current.purchasePosted[operation.id]);
  if (priorPurchase?.reversedBy && saved.purchasePosted[operation.id] !== priorPurchase.id)
    await reactivateReturnedPortfolio(db, tenantId, actorId, operation, saved.purchasePosted[operation.id]);
}
