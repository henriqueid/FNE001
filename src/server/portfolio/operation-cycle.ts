/** Reativa somente ativos devolvidos quando uma nova compra autorizada inicia outro ciclo financeiro. */
import type { Operation } from "@/src/domain/core/types";
import { portfolioBalance, portfolioTitleFromReceivable } from "@/src/domain/portfolio/model";
import { receivablesFromOperation } from "@/src/domain/receivables/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadCurrentPortfolio, portfolioRequestHash, savePortfolioState } from "./repository";
export async function reactivateReturnedPortfolio(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  operation: Operation,
  purchaseEntryId: string,
) {
  const current = await loadCurrentPortfolio(db, tenantId),
    sources = new Map(
      receivablesFromOperation(operation).map(receivable => {
        const title = portfolioTitleFromReceivable(receivable);
        return [title.id, title] as const;
      }),
    );
  let changed = false;
  const titles = current.titles.map(title => {
    const source = sources.get(title.id);
    if (
      !source ||
      title.status !== "Cancelado" ||
      !title.events.some(event => event.action === "Devolução de operação")
    )
      return title;
    changed = true;
    return {
      ...source,
      openAmount: portfolioBalance(source),
      bankStatus: "Sem boleto" as const,
      ourNumber: "",
      bank: "",
      agency: "",
      account: "",
      wallet: "",
      agreement: "",
      payments: title.payments,
      collectionOccurrences: title.collectionOccurrences,
      confirmation: title.confirmation,
      events: [
        ...title.events,
        {
          id: `operation-reacquisition:${purchaseEntryId}:${title.id}`,
          at: new Date().toISOString(),
          by: actorId,
          action: "Reaquisição após devolução",
          detail: `Nova compra ${purchaseEntryId}; o ciclo anterior permanece no histórico.`,
        },
      ],
    };
  });
  if (!changed) return;
  const state = { ...current, titles },
    expectedVersion = current.persistenceVersion ?? 0,
    requestHash = await portfolioRequestHash({ tenantId, actorId, expectedVersion, state });
  if (
    !(await savePortfolioState(
      db,
      tenantId,
      { id: actorId, name: actorId },
      state,
      expectedVersion,
      `operation-reacquisition:${operation.id}:${purchaseEntryId}`,
      requestHash,
      { financialCommand: true },
    ))
  )
    throw new Error("A carteira mudou durante a reaquisição; nenhuma compra parcial foi confirmada.");
}
