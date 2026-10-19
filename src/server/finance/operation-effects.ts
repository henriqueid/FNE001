/** Deriva situação dos favorecidos de títulos persistidos, nunca de efeitos enviados pelo navegador. */
import type { FinanceState } from "@/src/domain/finance/model";
import { payableKey } from "@/src/domain/finance/releases";
import { round2 } from "@/src/domain/finance/ledger";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadOperationSnapshot, saveOperationRecord } from "@/src/server/operations/storage";

export async function syncOperationPaymentStatuses(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  previous: FinanceState | null,
  next: FinanceState,
  returningOperationId?: string,
) {
  const priorTitles = new Map(previous?.titles.map(title => [title.id, title]) ?? []);
  const affected = new Set(
    next.titles
      .filter(
        title =>
          title.origin === "Liberação de operação" &&
          title.operationId &&
          JSON.stringify(priorTitles.get(title.id)) !== JSON.stringify(title),
      )
      .map(title => title.operationId!),
  );
  for (const operationId of affected) {
    if (operationId === returningOperationId) {
      const obligations = next.titles.filter(
        title => title.operationId === operationId && title.origin === "Liberação de operação",
      );
      if (!obligations.length || obligations.some(title => title.status !== "Cancelado"))
        throw new Error("O comando de devolução precisa cancelar integralmente as obrigações da operação.");
      continue;
    }
    const operation = await loadOperationSnapshot(db, tenantId, operationId);
    if (!operation?.releaseReview || operation.releaseReview.status !== "Enviada ao financeiro")
      throw new Error("Uma obrigação financeira exige uma liberação aprovada no servidor.");
    const titles = next.titles.filter(
      title =>
        title.operationId === operationId && title.origin === "Liberação de operação" && title.status !== "Cancelado",
    );
    const payables = operation.releaseReview.payables ?? [];
    if (
      titles.some(
        title =>
          title.kind !== "Pagar" ||
          title.company !== operation.vehicle ||
          !payables.some(payable => title.payableId?.split("#saldo")[0] === payableKey(payable)),
      )
    )
      throw new Error("O título financeiro não corresponde ao pacote de liberação aprovado.");
    const changes: { at: string; by: string; action: string; detail: string }[] = [];
    const updated = payables.map(payable => {
      if (payable.status === "Cancelado") return payable;
      const linked = titles.filter(title => title.payableId?.split("#saldo")[0] === payableKey(payable));
      if (
        !linked.length ||
        Math.abs(round2(linked.reduce((sum, title) => sum + title.amount, 0)) - payable.amount) >= 0.01 ||
        linked.some(title => title.counterpartyDocument?.replace(/\D/g, "") !== payable.document.replace(/\D/g, ""))
      )
        throw new Error("Os títulos financeiros precisam preservar o favorecido e o valor aprovado da liberação.");
      const paid = linked.every(title => title.status === "Baixado");
      const status = paid ? ("Pago" as const) : ("Pendente de pagamento" as const);
      const paidAt = paid
        ? linked
            .map(title => title.settledAt ?? "")
            .sort()
            .at(-1)
        : undefined;
      if (paid && !paidAt) throw new Error("O pagamento precisa de uma data de liquidação.");
      if (payable.status === status && payable.paidAt === paidAt) return payable;
      changes.push({
        at: new Date().toISOString(),
        by: actorId,
        action: paid ? "Pagamento realizado" : "Pagamento estornado",
        detail: payable.id,
      });
      return { ...payable, status, paidAt };
    });
    if (!changes.length) continue;
    const saved = await saveOperationRecord(
      db,
      tenantId,
      actorId,
      {
        ...operation,
        releaseReview: {
          ...operation.releaseReview,
          payables: updated,
          audit: [...(operation.releaseReview.audit ?? []), ...changes],
        },
      },
      operation.persistenceVersion ?? 0,
    );
    if (!saved) throw new Error("A operação mudou durante o pagamento. Atualize e tente novamente.");
  }
}
