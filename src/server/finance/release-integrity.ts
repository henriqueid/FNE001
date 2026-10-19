/** Confere obrigações de liberação contra fatos bancários e contábeis equivalentes ao motor determinístico. */
import { assertDateOpen } from "@/src/domain/finance/closing";
import { round2 } from "@/src/domain/finance/ledger";
import { roleLedger, type FinanceState, type FinanceTitle, type JournalLine } from "@/src/domain/finance/model";

export type ReleaseIntegrityOptions = { allowNewReleaseTitles?: boolean; returningOperationId?: string };
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
const same = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const equalMoney = (left: number, right: number) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(round2(left) - round2(right)) < 0.001;
const release = (title: FinanceTitle) => title.origin === "Liberação de operação";
const identity = (title: FinanceTitle) => ({
  kind: title.kind,
  origin: title.origin,
  company: title.company,
  counterparty: title.counterparty,
  counterpartyDocument: title.counterpartyDocument,
  competenceDate: title.competenceDate,
  settlementLedger: title.settlementLedger,
  operationId: title.operationId,
  payableId: title.payableId,
  linkedTitleId: title.linkedTitleId,
  portfolioTitleId: title.portfolioTitleId,
  competenceEntryId: title.competenceEntryId,
});
const settlement = (title: FinanceTitle) => ({
  amount: title.amount,
  status: title.status,
  movementId: title.movementId,
  settledAt: title.settledAt,
  settledAccountId: title.settledAccountId,
  method: title.method,
});
const cleared = (title: FinanceTitle) =>
  !title.movementId && !title.settledAt && !title.settledAccountId && !title.method;
const lines = (values: JournalLine[]) =>
  values
    .filter(line => line.debit || line.credit)
    .map(line => ({ ledger: line.ledger, debit: round2(line.debit), credit: round2(line.credit) }))
    .sort((a, b) => a.ledger.localeCompare(b.ledger) || a.debit - b.debit || a.credit - b.credit);
const dateOpen = (state: FinanceState, company: string, date: string) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    return false;
  try {
    assertDateOpen(state, company, date);
    return true;
  } catch {
    return false;
  }
};

export function validTitleSettlement(
  previous: FinanceState,
  next: FinanceState,
  original: FinanceTitle,
  paid: FinanceTitle,
) {
  const outgoing = original.kind === "Pagar";
  if (
    !paid.movementId ||
    !paid.settledAt ||
    !paid.settledAccountId ||
    !paid.method?.trim() ||
    !dateOpen(previous, original.company, paid.settledAt) ||
    !Number.isFinite(paid.amount) ||
    round2(paid.amount) !== paid.amount ||
    paid.amount <= 0 ||
    paid.amount > original.amount
  )
    return false;
  const account = next.accounts.find(item => item.id === paid.settledAccountId);
  const movement = next.movements.find(item => item.id === paid.movementId);
  const entry = next.journal.find(item => item.id === movement?.entryId);
  if (
    !account?.active ||
    !(outgoing ? account.usage.payments : account.usage.receipts) ||
    account.company !== original.company ||
    !movement ||
    !entry ||
    previous.movements.some(item => item.id === movement.id) ||
    previous.journal.some(item => item.id === entry.id) ||
    movement.titleId !== paid.id ||
    movement.accountId !== account.id ||
    movement.kind !== (outgoing ? "Saída" : "Entrada") ||
    movement.date !== paid.settledAt ||
    (outgoing ? movement.amount >= 0 : movement.amount <= 0) ||
    entry.company !== original.company ||
    entry.date !== paid.settledAt ||
    entry.origin.type !== "Movimento" ||
    entry.origin.id !== movement.id
  )
    return false;
  const interestLedger = roleLedger(previous, outgoing ? "interestPaid" : "interestReceived");
  const discountLedger = roleLedger(previous, outgoing ? "discountsObtained" : "discountsGranted");
  const interest = entry.lines
    .filter(line => line.ledger === interestLedger)
    .reduce((sum, line) => sum + (outgoing ? line.debit : line.credit), 0);
  const discount = entry.lines
    .filter(line => line.ledger === discountLedger)
    .reduce((sum, line) => sum + (outgoing ? line.credit : line.debit), 0);
  if (![interest, discount].every(value => Number.isFinite(value) && value >= 0) || discount >= paid.amount + interest)
    return false;
  const net = round2(paid.amount + interest - discount);
  const expected = outgoing
    ? [
        { ledger: original.settlementLedger, debit: paid.amount, credit: 0 },
        { ledger: interestLedger, debit: interest, credit: 0 },
        { ledger: account.ledgerCode, debit: 0, credit: net },
        { ledger: discountLedger, debit: 0, credit: discount },
      ]
    : [
        { ledger: account.ledgerCode, debit: net, credit: 0 },
        { ledger: discountLedger, debit: discount, credit: 0 },
        { ledger: original.settlementLedger, debit: 0, credit: paid.amount },
        { ledger: interestLedger, debit: 0, credit: interest },
      ];
  return equalMoney(movement.amount, outgoing ? -net : net) && same(lines(entry.lines), lines(expected));
}

export function validTitleSettlementReversal(
  previous: FinanceState,
  next: FinanceState,
  original: FinanceTitle,
  reopened: FinanceTitle,
) {
  if (!cleared(reopened) || !equalMoney(original.amount, reopened.amount)) return false;
  const movement = previous.movements.find(item => item.id === original.movementId);
  const originalEntry = previous.journal.find(item => item.id === movement?.entryId);
  if (!movement || movement.reconciled || !originalEntry) return false;
  const updatedMovement = next.movements.find(item => item.id === movement.id);
  if (updatedMovement?.reversedBy && !movement.reversedBy) {
    const reversal = next.movements.find(item => item.id === updatedMovement.reversedBy);
    const entry = next.journal.find(item => item.id === reversal?.entryId);
    return Boolean(
      reversal &&
      entry &&
      !previous.movements.some(item => item.id === reversal.id) &&
      !previous.journal.some(item => item.id === entry.id) &&
      reversal.kind === "Estorno" &&
      reversal.reversalOf === movement.id &&
      reversal.titleId === original.id &&
      reversal.accountId === movement.accountId &&
      equalMoney(reversal.amount, -movement.amount) &&
      dateOpen(previous, original.company, reversal.date) &&
      entry.date === reversal.date &&
      entry.company === original.company &&
      entry.reversalOf === originalEntry.id &&
      next.journal.find(item => item.id === originalEntry.id)?.reversedBy === entry.id &&
      same(
        lines(entry.lines),
        lines(originalEntry.lines.map(line => ({ ledger: line.ledger, debit: line.credit, credit: line.debit }))),
      ),
    );
  }
  const bank = previous.accounts.find(item => item.id === movement.accountId);
  if (!bank || updatedMovement?.reversedBy !== movement.reversedBy) return false;
  const outgoing = original.kind === "Pagar";
  const recoveryLedger = roleLedger(previous, outgoing ? "recover" : "refund");
  const expected = originalEntry.lines.map(line => ({
    ledger: line.ledger === bank.ledgerCode ? recoveryLedger : line.ledger,
    debit: line.credit,
    credit: line.debit,
  }));
  const recovery = next.titles.filter(
    title =>
      !previous.titles.some(item => item.id === title.id) &&
      title.origin === (outgoing ? "Recuperação de pagamento" : "Devolução de recebimento") &&
      title.linkedTitleId === original.id &&
      title.kind === (outgoing ? "Receber" : "Pagar") &&
      title.status === "Em aberto" &&
      title.company === original.company &&
      title.counterpartyDocument === original.counterpartyDocument &&
      title.counterparty === original.counterparty &&
      equalMoney(title.amount, Math.abs(movement.amount)) &&
      title.settlementLedger === recoveryLedger &&
      cleared(title),
  );
  return (
    recovery.length === 1 &&
    dateOpen(previous, original.company, recovery[0].competenceDate) &&
    next.journal.some(
      entry =>
        !previous.journal.some(item => item.id === entry.id) &&
        entry.company === original.company &&
        entry.date === recovery[0].competenceDate &&
        entry.origin.type === "Título" &&
        entry.origin.id === original.id &&
        same(lines(entry.lines), lines(expected)),
    )
  );
}

export function releasePaymentIntegrityError(
  previous: FinanceState | null,
  next: FinanceState,
  options: ReleaseIntegrityOptions = {},
): string | null {
  const originals = previous?.titles ?? [];
  const splits = new Set<string>();
  for (const original of originals.filter(release)) {
    const candidate = next.titles.find(title => title.id === original.id);
    if (!candidate || !same(identity(original), identity(candidate)))
      return "A obrigação de liberação deve preservar origem, empresa, favorecido e vínculo aprovados.";
    if (same(settlement(original), settlement(candidate))) continue;
    if (
      options.returningOperationId === original.operationId &&
      candidate.status === "Cancelado" &&
      equalMoney(candidate.amount, original.amount) &&
      cleared(candidate)
    ) {
      if (
        original.status === "Em aberto" ||
        (original.status === "Baixado" && previous && validTitleSettlementReversal(previous, next, original, candidate))
      )
        continue;
      return "A devolução de uma obrigação paga exige estorno financeiro verificável antes do cancelamento.";
    }
    if (original.status === "Em aberto" && candidate.status === "Baixado") {
      if (!previous || !validTitleSettlement(previous, next, original, candidate))
        return "A baixa da liberação exige movimento bancário e partidas equivalentes ao pagamento determinístico.";
      const remainder = round2(original.amount - candidate.amount);
      if (remainder > 0) {
        const residuals = next.titles.filter(
          title =>
            !originals.some(item => item.id === title.id) && title.linkedTitleId === original.id && release(title),
        );
        if (residuals.length !== 1) return "A baixa parcial exige exatamente um saldo residual vinculado.";
        const residual = residuals[0];
        if (
          !equalMoney(residual.amount, remainder) ||
          residual.status !== "Em aberto" ||
          !cleared(residual) ||
          residual.kind !== original.kind ||
          residual.company !== original.company ||
          residual.operationId !== original.operationId ||
          residual.counterparty !== original.counterparty ||
          residual.counterpartyDocument !== original.counterpartyDocument ||
          residual.settlementLedger !== original.settlementLedger ||
          residual.competenceDate !== original.competenceDate ||
          residual.dueDate !== original.dueDate ||
          !residual.payableId?.startsWith(`${original.payableId}#saldo-`)
        )
          return "O saldo residual precisa preservar valor, favorecido e vínculo da liberação.";
        splits.add(residual.id);
      }
    } else if (original.status === "Baixado" && candidate.status === "Em aberto") {
      if (!previous || !validTitleSettlementReversal(previous, next, original, candidate))
        return "O estorno da liberação exige contrapartida bancária ou recuperação financeira verificável.";
    } else return "A obrigação de liberação só pode mudar por baixa ou estorno financeiro verificável.";
  }
  for (const title of next.titles.filter(
    title => release(title) && !originals.some(item => item.id === title.id) && !splits.has(title.id),
  )) {
    if (
      !options.allowNewReleaseTitles ||
      title.kind !== "Pagar" ||
      title.status !== "Em aberto" ||
      !title.operationId ||
      !title.payableId ||
      !cleared(title)
    )
      return "Novas obrigações de liberação exigem a materialização autorizada pelo servidor.";
  }
  const releaseIds = new Set([...originals, ...next.titles].filter(release).map(title => title.id));
  const newMoves = next.movements.filter(
    movement => releaseIds.has(movement.titleId ?? "") && !previous?.movements.some(item => item.id === movement.id),
  );
  for (const movement of newMoves) {
    const original = originals.find(title => title.id === movement.titleId);
    const candidate = next.titles.find(title => title.id === movement.titleId);
    const paid =
      original?.status === "Em aberto" && candidate?.status === "Baixado" && candidate.movementId === movement.id;
    const reversed =
      original?.status === "Baixado" &&
      ["Em aberto", "Cancelado"].includes(candidate?.status ?? "") &&
      previous?.movements.some(
        item =>
          item.id === original.movementId &&
          next.movements.find(saved => saved.id === item.id)?.reversedBy === movement.id,
      );
    if (!paid && !reversed) return "O movimento da liberação exige baixa ou estorno correspondente da obrigação.";
  }
  const releaseMovements = new Set(
    next.movements.filter(movement => releaseIds.has(movement.titleId ?? "")).map(movement => movement.id),
  );
  const newEntries = next.journal.filter(entry => !previous?.journal.some(item => item.id === entry.id));
  for (const entry of newEntries) {
    if (
      entry.origin.type === "Movimento" &&
      releaseMovements.has(entry.origin.id) &&
      !newMoves.some(movement => movement.entryId === entry.id)
    )
      return "A partida da liberação exige movimento validado correspondente.";
    if (entry.origin.type === "Título" && releaseIds.has(entry.origin.id)) {
      const original = originals.find(title => title.id === entry.origin.id);
      const candidate = next.titles.find(title => title.id === entry.origin.id);
      if (
        original?.status !== "Baixado" ||
        !["Em aberto", "Cancelado"].includes(candidate?.status ?? "") ||
        newEntries.filter(item => item.origin.type === "Título" && item.origin.id === entry.origin.id).length !== 1
      )
        return "A partida de recuperação da liberação exige estorno único e validado.";
    }
  }
  return null;
}
