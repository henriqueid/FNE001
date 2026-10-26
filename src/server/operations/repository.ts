/** Persiste operação, recebíveis e obrigações financeiras na mesma transação. */
import type { Operation } from "@/src/domain/core/types";
import { hydrateOperationReceivables } from "@/src/domain/receivables/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import { syncReleasedOperationFinance } from "@/src/server/finance/operation-sync";
import { syncOperationReceivables } from "@/src/server/receivables/repository";
import { normalizedPricing, pricingCalculation, roundPricing } from "@/src/domain/operations/pricing";
import { applyRepurchases } from "./repurchase";
import { loadCurrentPortfolio, portfolioRequestHash, savePortfolioState } from "@/src/server/portfolio/repository";
import { OperationGovernanceError } from "./governance";
import { validateRepurchaseBankWriteoff } from "@/src/server/banking/service";
import { loadFinanceState } from "@/src/server/finance/repository";
import { saveOperationRecord } from "./storage";
export { loadOperations, loadOperationSnapshot } from "./storage";

export async function saveOperation(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
  expectedVersion: number,
): Promise<Operation | null> {
  return inTenantFinanceTransaction(db, tenantId, async transaction => {
    let next = operation;
    let portfolioChange: ReturnType<typeof applyRepurchases> | undefined;
    if (
      operation.status === "Liberada ao financeiro" &&
      operation.pricingReview?.repurchaseTitleIds?.length &&
      !operation.repurchaseApplications?.some(a => !a.reversedAt)
    ) {
      portfolioChange = applyRepurchases(
        operation,
        await loadCurrentPortfolio(transaction, tenantId),
        actorId,
        new Date().toISOString(),
      );
      next = portfolioChange.operation;
      const queued = portfolioChange.portfolio.titles.filter(
        title =>
          title.bankWriteoff &&
          next.repurchaseApplications?.some(
            application => !application.reversedAt && application.id === title.bankWriteoff!.applicationId,
          ),
      );
      if (queued.length) {
        const finance = await loadFinanceState(transaction, tenantId);
        for (const title of queued) {
          const error = await validateRepurchaseBankWriteoff(transaction, tenantId, finance, title);
          if (error) throw new OperationGovernanceError(error);
        }
      }
      const offsets = (next.repurchaseApplications ?? [])
        .filter(a => !a.reversedAt)
        .reduce((sum, a) => sum + a.amount, 0);
      const net = roundPricing(pricingCalculation(next, normalizedPricing(next)).net - offsets);
      const payables = roundPricing(
        (next.releaseReview?.payables ?? [])
          .filter(p => p.status !== "Cancelado")
          .reduce((sum, p) => sum + p.amount, 0),
      );
      if (!Number.isFinite(net) || net <= 0 || roundPricing(next.netAmount) !== net || payables !== net)
        throw new OperationGovernanceError("O líquido e os favorecidos devem refletir o saldo atual da recompra.");
    }
    const saved = await saveOperationRecord(transaction, tenantId, actorId, next, expectedVersion);
    if (!saved) return null;
    if (portfolioChange) {
      const portfolio = portfolioChange.portfolio;
      const version = portfolio.persistenceVersion ?? 0;
      const requestHash = await portfolioRequestHash({ tenantId, actorId, expectedVersion: version, state: portfolio });
      if (
        !(await savePortfolioState(
          transaction,
          tenantId,
          { id: actorId, name: actorId },
          portfolio,
          version,
          `repurchase:${operation.id}:${saved.persistenceVersion}`,
          requestHash,
          { financialCommand: true },
        ))
      )
        throw new OperationGovernanceError("A carteira mudou durante a recompra.");
    }
    const receivables = await syncOperationReceivables(transaction, tenantId, actorId, next);
    const hydrated = hydrateOperationReceivables({ ...saved, repurchaseContext: next.repurchaseContext }, receivables);
    await syncReleasedOperationFinance(transaction, tenantId, actorId, hydrated);
    return hydrated;
  });
}
