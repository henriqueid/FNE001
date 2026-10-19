/** Serializa alterações financeiras do tenant na transação externa, inclusive coordenação de operações. */
import type { DecisionDatabase } from "@/src/server/decisions/repository";

export async function inTenantFinanceTransaction<T>(
  db: DecisionDatabase,
  tenantId: string,
  work: (transaction: DecisionDatabase) => Promise<T>,
): Promise<T> {
  // O adaptador de uma transação já aberta não expõe transaction novamente.
  if (!db.transaction) return work(db);
  return db.transaction(async transaction => {
    await transaction
      .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
      .bind(`strato.finance:${tenantId}`)
      .run();
    return work(transaction);
  });
}
