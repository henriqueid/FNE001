/**
 * Integração Operação → Financeiro: liberações viram títulos a pagar e o lançamento da compra; cobrança
 * (remessa/confirmação) e devolução da operação em ordem inversa.
 */
import { type Operation } from "@/src/domain/core/types";
import { type OpFin, type Result, draftOf, post, reverseEntry, round2, run, todayIso } from "./ledger";
import { nowStamp, roleLedger, type FinanceState, type JournalLine } from "./model";
import { cancelDraft, createTitleDraft, reverseDraft } from "./titles";

export const payableKey = (p: { id: string; createdAt: string }) => `${p.id}@${p.createdAt}`;

export function syncReleases(
  state: FinanceState,
  operations: Operation[],
  fin: Record<string, OpFin>,
  by = "Sistema",
): FinanceState {
  let changed = false;
  const d = draftOf(state);
  operations.forEach(op => {
    const review = op.releaseReview;
    if (op.status !== "Liberada ao financeiro" || review?.status !== "Enviada ao financeiro") return;
    const payables = (review.payables ?? []).filter(p => p.status !== "Cancelado");
    const priorPurchase = d.journal.find(entry => entry.id === d.purchasePosted[op.id]);
    const newCycle = Boolean(priorPurchase?.reversedBy);
    if (newCycle && payables.some(payable => d.titles.some(title => title.payableId === payableKey(payable))))
      throw new Error("A reaquisição exige novos identificadores de favorecidos para preservar o ciclo anterior.");
    const date = /^\d{4}-\d{2}-\d{2}T/.test(review.releasedAt ?? "")
      ? review.releasedAt!.slice(0, 10)
      : review.releasedAt?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        ? review.releasedAt.replace(/.*?(\d{2})\/(\d{2})\/(\d{4}).*/, "$3-$2-$1")
        : todayIso();
    if ((!d.purchasePosted[op.id] || newCycle) && payables.length) {
      const f = fin[op.id];
      const face = f?.face || op.amount;
      const toPay = round2(payables.reduce((s, p) => s + p.amount, 0));
      const discount = round2(f?.discount ?? 0),
        fees = round2(f?.fees ?? 0);
      const rest = round2(face - toPay - discount - fees);
      const lines: JournalLine[] = [
        { ledger: roleLedger(d, "acquired"), debit: face, credit: 0 },
        { ledger: roleLedger(d, "assignorsPayable"), debit: 0, credit: toPay },
        { ledger: roleLedger(d, "deferredDiscount"), debit: 0, credit: discount },
        { ledger: roleLedger(d, "feeRevenue"), debit: 0, credit: fees },
        rest >= 0
          ? { ledger: roleLedger(d, "retentions"), debit: 0, credit: rest }
          : { ledger: roleLedger(d, "retentions"), debit: -rest, credit: 0 },
      ];
      d.purchasePosted[op.id] = post(
        d,
        {
          date,
          company: op.vehicle,
          history: `Compra de direitos creditórios · aditivo ${op.aditivoNumber} · borderô ${op.borderoNumber} · ${op.cedent}`,
          lines,
          origin: { type: "Operação", id: op.id },
        },
        by,
      );
      changed = true;
    }
    payables.forEach(p => {
      const key = payableKey(p);
      if (d.titles.some(t => t.payableId === key)) return;
      createTitleDraft(
        d,
        {
          kind: "Pagar",
          origin: "Liberação de operação",
          description: `Liberação aditivo ${op.aditivoNumber}`,
          counterparty: p.payee,
          counterpartyDocument: p.document,
          company: op.vehicle,
          competenceDate: date,
          dueDate: p.dueDate,
          amount: p.amount,
          settlementLedger: roleLedger(d, "assignorsPayable"),
          skipCompetence: true,
          operationId: op.id,
          payableId: key,
        },
        by,
      );
      changed = true;
    });
  });
  return changed ? d : state;
}

export const isOperationLocked = (state: FinanceState, operationId: string) =>
  Boolean(state.registrations[operationId]?.confirmedAt);

export function sendCollection(state: FinanceState, operation: Operation, accountId: string, _by: string): Result {
  return run(state, d => {
    const account = d.accounts.find(a => a.id === accountId);
    if (!account?.usage.collection) throw new Error("Escolha uma conta com carteira de cobrança configurada.");
    const titles = operation.manualEntry?.entries?.length ?? operation.titleCount;
    d.registrations[operation.id] = { sentAt: nowStamp(), titles, account: account.nickname };
    return {
      message: `Remessa gerada com ${titles} título(s) para ${account.nickname}. Aguardando confirmação do banco.`,
    };
  });
}

export function confirmCollection(state: FinanceState, operationId: string): Result {
  return run(state, d => {
    const reg = d.registrations[operationId];
    if (!reg) throw new Error("Gere a remessa antes de confirmar o retorno.");
    d.registrations[operationId] = { ...reg, confirmedAt: nowStamp() };
    return {
      message:
        "Registro confirmado pelo banco. A operação está em cobrança e não pode mais ser devolvida ou estornada.",
    };
  });
}

export function returnOperation(
  state: FinanceState,
  operation: Operation,
  opts: { targetStage: number; reason: string; cashMoved: boolean; date?: string },
  by: string,
): Result & { operationPatch?: Partial<Operation> } {
  if (!Number.isInteger(opts.targetStage) || opts.targetStage < 1 || opts.targetStage > 5)
    return { state, error: "Escolha uma etapa de destino entre Entrada e Aprovação." };
  if (operation.status !== "Liberada ao financeiro" || operation.releaseReview?.status !== "Enviada ao financeiro")
    return { state, error: "Somente uma operação liberada ao financeiro pode ser devolvida." };
  if (typeof opts.cashMoved !== "boolean") return { state, error: "Informe a situação do caixa." };
  if (isOperationLocked(state, operation.id))
    return {
      state,
      error:
        "Os títulos desta operação já foram enviados e confirmados pelo banco. A operação está em cobrança e não pode ser devolvida nem estornada.",
    };
  if (!opts.reason.trim()) return { state, error: "Informe o motivo da devolução." };
  const date = opts.date ?? todayIso();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date
  )
    return { state, error: "Informe uma data válida para a devolução." };
  const result = run(state, d => {
    const titles = d.titles.filter(
      t => t.operationId === operation.id && t.origin === "Liberação de operação" && t.status !== "Cancelado",
    );
    titles.forEach(t => {
      if (t.status === "Baixado")
        reverseDraft(d, t.id, { reason: `Devolução da operação: ${opts.reason}`, cashMoved: opts.cashMoved }, by, date);
      cancelDraft(d, t.id, `Devolução da operação: ${opts.reason}`, by, date, true);
    });
    const purchase = d.purchasePosted[operation.id];
    if (purchase) {
      reverseEntry(d, purchase, date, `Devolução da operação ${operation.aditivoNumber}: ${opts.reason}`, by);
    }
    const pendingRegistration = d.registrations[operation.id];
    return {
      message: `Operação devolvida para ${["", "Entrada", "Risco", "Lastro", "Preço", "Aprovação", "Liberação"][opts.targetStage]}. ${titles.length} lançamento(s) estornado(s)${pendingRegistration ? "; o registro bancário anterior permanece no histórico" : ""}.`,
    };
  });
  if (result.error) return result;
  const review = operation.releaseReview;
  const stamp = nowStamp();
  const operationPatch: Partial<Operation> = {
    stage: opts.targetStage,
    status: "Em andamento",
    nextAction: "Revisar operação devolvida pelo financeiro",
    stageCompletions: (operation.stageCompletions ?? []).filter(s => s.stageId < opts.targetStage),
    releaseReview: review
      ? {
          ...review,
          status: "Em preparação",
          releasedAt: undefined,
          releasedBy: undefined,
          payables: (review.payables ?? []).map(p => ({ ...p, status: "Cancelado" as const })),
          audit: [
            ...(review.audit ?? []),
            {
              at: stamp,
              by,
              action: "Devolvida pelo financeiro",
              detail: `${opts.reason} · ${opts.cashMoved ? "pagamento já tinha saído do caixa: valor a recuperar do cedente" : "sem saída de caixa"}`,
            },
          ],
        }
      : review,
  };
  return { ...result, operationPatch };
}
