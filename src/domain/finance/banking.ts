/**
 * Contas bancárias: saldo por data, transferência entre contas da mesma empresa, cadastro e conta padrão.
 */
import { type Result, hist, nextId, post, round2, run } from "./ledger";
import { nextChildCode, roleLedger, withBankLedgers, type CompanyBankAccount, type FinanceState } from "./model";

export function transfer(
  state: FinanceState,
  input: { from: string; to: string; date: string; amount: number; description: string },
  by: string,
): Result {
  return run(state, d => {
    const from = d.accounts.find(a => a.id === input.from),
      to = d.accounts.find(a => a.id === input.to);
    const amount = round2(input.amount);
    if (!from || !to || from.id === to.id) throw new Error("Escolha duas contas diferentes.");
    if (!(amount > 0)) throw new Error("Informe o valor da transferência.");
    if (from.company !== to.company)
      throw new Error(
        "Transferência entre empresas diferentes deve ser lançada como pagamento e recebimento (mútuo), não como transferência.",
      );
    const outId = nextId(d, "MV"),
      inId = nextId(d, "MV");
    const entryId = post(
      d,
      {
        date: input.date,
        company: from.company,
        history: `Transferência ${from.nickname} → ${to.nickname} · ${input.description}`,
        lines: [
          { ledger: to.ledgerCode, debit: amount, credit: 0 },
          { ledger: from.ledgerCode, debit: 0, credit: amount },
        ],
        origin: { type: "Transferência", id: outId },
      },
      by,
    );
    d.movements.push({
      id: outId,
      accountId: from.id,
      date: input.date,
      description: `Transferência para ${to.nickname} · ${input.description}`,
      amount: -amount,
      kind: "Transferência",
      reconciled: false,
      entryId,
      history: [hist(by, "Transferência", `${inId}`)],
    });
    d.movements.push({
      id: inId,
      accountId: to.id,
      date: input.date,
      description: `Transferência de ${from.nickname} · ${input.description}`,
      amount,
      kind: "Transferência",
      reconciled: false,
      entryId,
      history: [hist(by, "Transferência", `${outId}`)],
    });
    return { message: "Transferência registrada." };
  });
}

export function saveAccount(state: FinanceState, account: CompanyBankAccount): Result {
  return run(state, d => {
    const exists = d.accounts.findIndex(a => a.id === account.id);
    if (!account.agency.trim() || !account.account.trim()) throw new Error("Informe agência e conta.");
    if (exists >= 0) {
      const hasMoves = d.movements.some(m => m.accountId === account.id);
      const before = d.accounts[exists];
      if (
        hasMoves &&
        (before.openingBalance !== account.openingBalance ||
          before.openingDate !== account.openingDate ||
          before.company !== account.company)
      )
        throw new Error(
          "A conta já tem movimentos: empresa, saldo e data de abertura não podem mais ser alterados. Lance um ajuste.",
        );
      d.accounts[exists] = account;
    } else {
      const ledgerCode = nextChildCode(
        d.chart,
        roleLedger(d, "bankGroup"),
        d.accounts.map(a => a.ledgerCode),
      );
      const created = { ...account, id: nextId(d, "CB"), ledgerCode };
      d.accounts.push(created);
      post(
        d,
        {
          date: created.openingDate,
          company: created.company,
          history: `Saldo de abertura ${created.nickname}`,
          lines: [
            { ledger: ledgerCode, debit: created.openingBalance, credit: 0 },
            { ledger: roleLedger(d, "capital"), debit: 0, credit: created.openingBalance },
          ],
          origin: { type: "Abertura", id: created.id },
        },
        "Henrique",
      );
    }
    d.chart = withBankLedgers(d.chart, d.accounts);
    return { message: exists >= 0 ? "Conta atualizada." : "Conta cadastrada com saldo de abertura." };
  });
}

export function accountBalance(state: FinanceState, accountId: string, upTo?: string) {
  const a = state.accounts.find(x => x.id === accountId);
  if (!a) return 0;
  return round2(
    a.openingBalance +
      state.movements
        .filter(m => m.accountId === accountId && (!upTo || m.date <= upTo))
        .reduce((s, m) => s + m.amount, 0),
  );
}

export const inScope = (company: string, scope: string) => scope === "Consolidado" || company === scope;

export function scopedAccounts(state: FinanceState, scope: string) {
  return state.accounts.filter(a => a.active && inScope(a.company, scope));
}

export function defaultAccountFor(state: FinanceState, company: string, kind: "Pagar" | "Receber") {
  return state.accounts.find(
    a => a.active && a.company === company && (kind === "Pagar" ? a.usage.payments : a.usage.receipts),
  );
}
