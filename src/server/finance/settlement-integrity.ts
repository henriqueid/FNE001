/** Fronteira compartilhada das baixas e estornos de títulos fora da liberação. */
import { round2 } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { validTitleSettlement, validTitleSettlementReversal } from "./release-integrity";
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, stable(item)]),
        )
      : value;
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const cleared = (title: FinanceTitle) =>
  !title.movementId && !title.settledAt && !title.settledAccountId && !title.method;
const identity = (title: FinanceTitle) => ({
  kind: title.kind,
  origin: title.origin,
  company: title.company,
  operationId: title.operationId,
  payableId: title.payableId,
  linkedTitleId: title.linkedTitleId,
  portfolioTitleId: title.portfolioTitleId,
});
const accountingIdentity = (title: FinanceTitle) => ({
  ...identity(title),
  counterparty: title.counterparty,
  counterpartyDocument: title.counterpartyDocument,
  settlementLedger: title.settlementLedger,
  competenceDate: title.competenceDate,
  competenceEntryId: title.competenceEntryId,
  categoryId: title.categoryId,
});
const payment = (title: FinanceTitle) => ({
  amount: title.amount,
  status: title.status,
  movementId: title.movementId,
  settledAt: title.settledAt,
  settledAccountId: title.settledAccountId,
  method: title.method,
});

export function settlementIntegrityError(previous: FinanceState | null, next: FinanceState): string | null {
  const base = previous ?? { ...next, titles: [], movements: [], journal: [] };
  const oldById = new Map(base.titles.map(title => [title.id, title]));
  const paidMovements = new Set<string>();
  const reversedMovements = new Set<string>();
  const residuals = new Set<string>();
  const selected = next.titles.filter(title => title.origin !== "Liberação de operação");
  for (const candidate of selected) {
    const existing = oldById.get(candidate.id);
    if (!existing && ["Recuperação de pagamento", "Devolução de recebimento"].includes(candidate.origin)) {
      const parent = oldById.get(candidate.linkedTitleId ?? "");
      const reopened = next.titles.find(title => title.id === parent?.id);
      if (
        !parent ||
        !reopened ||
        parent.status !== "Baixado" ||
        !["Em aberto", "Cancelado"].includes(reopened.status) ||
        !validTitleSettlementReversal(base, next, parent, reopened)
      )
        return "Recuperação ou devolução exige estorno validado do título original.";
    }
    if (existing && !same(identity(existing), identity(candidate)))
      return "A liquidação não pode alterar origem, empresa ou vínculo do título financeiro.";
    if (candidate.status === "Em aberto" && existing?.status !== "Baixado") {
      if (!cleared(candidate)) return "Um título em aberto não pode carregar uma baixa sem estorno verificável.";
      continue;
    }
    if (existing?.status === "Cancelado") {
      if (
        !same(payment(existing), payment(candidate)) ||
        !same(accountingIdentity(existing), accountingIdentity(candidate))
      )
        return "Um título cancelado não pode ser reaberto ou reescrito.";
      continue;
    }
    if (existing?.status === "Baixado" && candidate.status === "Baixado") {
      if (
        !same(payment(existing), payment(candidate)) ||
        !same(accountingIdentity(existing), accountingIdentity(candidate))
      )
        return "Um título baixado não pode ser reescrito; estorne a baixa antes.";
      continue;
    }
    if (existing?.status === "Baixado" && ["Em aberto", "Cancelado"].includes(candidate.status)) {
      if (
        !same(accountingIdentity(existing), accountingIdentity(candidate)) ||
        !validTitleSettlementReversal(base, next, existing, candidate)
      )
        return "O estorno exige caixa ou recuperação/devolução e partidas contábeis equivalentes ao motor.";
      const reversed = next.movements.find(movement => movement.id === existing.movementId)?.reversedBy;
      if (reversed) reversedMovements.add(reversed);
      continue;
    }
    if (candidate.status === "Cancelado") {
      if (!cleared(candidate) || (existing && !same(accountingIdentity(existing), accountingIdentity(candidate))))
        return "O cancelamento não pode apagar baixa ou alterar identidade do título.";
      if (
        existing?.competenceEntryId &&
        !next.journal.find(entry => entry.id === existing.competenceEntryId)?.reversedBy
      )
        return "O cancelamento exige estorno do lançamento de competência.";
      continue;
    }
    if (candidate.status !== "Baixado") return "Transição financeira de título inválida.";
    const children = selected.filter(
      title => !oldById.has(title.id) && title.linkedTitleId === candidate.id && title.origin === candidate.origin,
    );
    const original: FinanceTitle = existing ?? {
      ...candidate,
      amount: round2(candidate.amount + children.reduce((sum, title) => sum + title.amount, 0)),
      status: "Em aberto",
      movementId: undefined,
      settledAt: undefined,
      settledAccountId: undefined,
      method: undefined,
    };
    if (
      !same(accountingIdentity(original), accountingIdentity(candidate)) ||
      !validTitleSettlement(base, next, original, candidate)
    )
      return "A baixa exige conta da mesma empresa, movimento bancário e partidas equivalentes ao motor determinístico.";
    paidMovements.add(candidate.movementId!);
    const remainder = round2(original.amount - candidate.amount);
    if (remainder > 0) {
      if (children.length !== 1) return "A baixa parcial exige um único saldo residual vinculado.";
      const residual = children[0];
      if (
        residual.amount !== remainder ||
        residual.status !== "Em aberto" ||
        !cleared(residual) ||
        !same(
          {
            ...accountingIdentity(residual),
            linkedTitleId: original.linkedTitleId,
            competenceEntryId: original.competenceEntryId,
          },
          accountingIdentity(original),
        )
      )
        return "O saldo da baixa parcial deve preservar empresa, favorecido, conta contábil e valor restante.";
      residuals.add(residual.id);
    }
  }
  for (const title of base.titles.filter(title => title.origin !== "Liberação de operação"))
    if (!next.titles.some(candidate => candidate.id === title.id))
      return "Títulos financeiros não podem ser removidos.";
  for (const movement of next.movements.filter(
    item => !base.movements.some(old => old.id === item.id) && selected.some(title => title.id === item.titleId),
  )) {
    if (!paidMovements.has(movement.id) && !reversedMovements.has(movement.id))
      return "O movimento financeiro exige baixa ou estorno correspondente do título.";
  }
  const linkedMovements = next.movements.filter(movement => selected.some(title => title.id === movement.titleId));
  const recoveryEntries = new Set<string>();
  for (const entry of next.journal.filter(item => !base.journal.some(old => old.id === item.id))) {
    if (
      entry.origin.type === "Movimento" &&
      linkedMovements.some(movement => movement.id === entry.origin.id) &&
      !linkedMovements.some(
        movement =>
          movement.entryId === entry.id && (paidMovements.has(movement.id) || reversedMovements.has(movement.id)),
      )
    )
      return "A partida de liquidação exige movimento validado correspondente.";
    if (entry.origin.type !== "Título") continue;
    const candidate = selected.find(title => title.id === entry.origin.id);
    if (!candidate) continue;
    const original = oldById.get(candidate.id);
    if (
      candidate.competenceEntryId === entry.id ||
      (original?.competenceEntryId && entry.reversalOf === original.competenceEntryId)
    )
      continue;
    if (
      original?.status !== "Baixado" ||
      !["Em aberto", "Cancelado"].includes(candidate.status) ||
      recoveryEntries.has(candidate.id) ||
      !validTitleSettlementReversal(base, next, original, candidate)
    )
      return "A partida de recuperação ou competência não corresponde à transição do título.";
    recoveryEntries.add(candidate.id);
  }
  for (const title of selected.filter(
    title => !oldById.has(title.id) && title.linkedTitleId && !residuals.has(title.id),
  )) {
    const parent = oldById.get(title.linkedTitleId!);
    if (parent && title.origin === parent.origin)
      return "Não é permitido acrescentar saldo residual sem baixa parcial correspondente.";
  }
  return null;
}
