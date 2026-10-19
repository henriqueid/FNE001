/** Persiste operação, recebíveis e obrigações financeiras na mesma transação. */
import type { Operation } from "@/src/domain/core/types";
import { hydrateOperationReceivables } from "@/src/domain/receivables/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import { syncReleasedOperationFinance } from "@/src/server/finance/operation-sync";
import { syncOperationReceivables } from "@/src/server/receivables/repository";
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
    const saved = await saveOperationRecord(transaction, tenantId, actorId, operation, expectedVersion);
    if (!saved) return null;
    const receivables = await syncOperationReceivables(transaction, tenantId, actorId, operation);
    const hydrated = hydrateOperationReceivables(saved, receivables);
    await syncReleasedOperationFinance(transaction, tenantId, actorId, hydrated);
    return hydrated;
  });
}
