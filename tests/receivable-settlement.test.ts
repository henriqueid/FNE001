/** A liquidação do ativo precisa fechar carteira, caixa e razão juntos, com estorno rastreável. */
import { describe, expect, it } from "vitest";
import { openingEntries, emptyState } from "@/src/domain/finance/ledger";
import { accountBalance } from "@/src/domain/finance/banking";
import { seedPortfolio, portfolioBalance } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { settleReceivable, reverseReceivableSettlement } from "@/src/domain/portfolio/settlement";

function states() {
  const finance = openingEntries(emptyState("2026-10-18"));
  const portfolio = seedPortfolio(initialOperations);
  const title = portfolio.titles[0];
  Object.assign(title, {
    company: finance.accounts[0].company,
    originalAmount: 1000,
    openAmount: 1000,
    paidAmount: 0,
    discountAmount: 0,
    repurchasedAmount: 0,
    abatementAmount: 0,
    payments: [],
    status: "Em aberto",
    bankStatus: "Registrado",
  });
  return { finance, portfolio, titleId: title.id, accountId: finance.accounts[0].id };
}

describe("liquidação integrada de recebíveis", () => {
  it("novo recebimento após estorno não duplica contas a receber pendentes", () => {
    const { finance, portfolio, titleId, accountId } = states();
    const input = { accountId, date: "2026-10-18", principal: 1000, interest: 0, discount: 0, method: "Manual" };
    const first = settleReceivable(finance, portfolio, titleId, input, "Ator", "cycle-first");
    const reversed = reverseReceivableSettlement(
      first.finance,
      first.portfolio,
      titleId,
      "cycle-first",
      { date: "2026-10-18", reason: "Correção", cashMoved: false },
      "Ator",
      "cycle-reverse",
    );
    const second = settleReceivable(reversed.finance, reversed.portfolio, titleId, input, "Ator", "cycle-second");
    expect(second.error).toBeUndefined();
    expect(
      second.finance.titles.filter(title => title.portfolioTitleId === titleId && title.status === "Em aberto"),
    ).toHaveLength(0);
    expect(portfolioBalance(second.portfolio.titles.find(title => title.id === titleId)!)).toBe(0);
  });
  it("baixa parcial com juros e desconto atualiza saldo do ativo, caixa e contabilização", () => {
    const { finance, portfolio, titleId, accountId } = states();
    const before = accountBalance(finance, accountId);
    const result = settleReceivable(
      finance,
      portfolio,
      titleId,
      { accountId, date: "2026-10-18", principal: 400, interest: 20, discount: 10, method: "Manual" },
      "financeiro-a",
      "settlement-a",
    );
    expect(result.error).toBeUndefined();
    const title = result.portfolio.titles.find(title => title.id === titleId)!;
    expect(title).toMatchObject({ status: "Liquidado parcial", paidAmount: 390, discountAmount: 10, openAmount: 600 });
    expect(portfolioBalance(title)).toBe(600);
    expect(accountBalance(result.finance, accountId)).toBe(before + 410);
    const entry = result.finance.journal.at(-1)!;
    expect(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0)).toBe(0);
    expect(title.payments[0]).toMatchObject({
      id: "settlement-a",
      principalAmount: 400,
      interestAmount: 20,
      discountAmount: 10,
      amount: 410,
      createdBy: "financeiro-a",
    });
  });

  it("liquidação total zera o ativo e estorno sem caixa real recompõe ambas as posições", () => {
    const { finance, portfolio, titleId, accountId } = states();
    const settled = settleReceivable(
      finance,
      portfolio,
      titleId,
      { accountId, date: "2026-10-18", principal: 1000, interest: 0, discount: 0, method: "Manual" },
      "financeiro-a",
      "settlement-a",
    );
    expect(settled.error).toBeUndefined();
    expect(settled.portfolio.titles.find(title => title.id === titleId)?.status).toBe("Pago");
    const reversed = reverseReceivableSettlement(
      settled.finance,
      settled.portfolio,
      titleId,
      "settlement-a",
      { date: "2026-10-19", reason: "Registro equivocado", cashMoved: false },
      "financeiro-b",
      "reversal-a",
    );
    expect(reversed.error).toBeUndefined();
    const title = reversed.portfolio.titles.find(title => title.id === titleId)!;
    expect(portfolioBalance(title)).toBe(1000);
    expect(title.status).toBe("Em aberto");
    expect(title.payments).toHaveLength(2);
    expect(title.payments[0].reversedBy).toBe("reversal-a");
    expect(accountBalance(reversed.finance, accountId)).toBe(accountBalance(finance, accountId));
    const again = reverseReceivableSettlement(
      reversed.finance,
      reversed.portfolio,
      titleId,
      "settlement-a",
      { date: "2026-10-19", reason: "Duplicado", cashMoved: false },
      "financeiro-b",
      "reversal-b",
    );
    expect(again.error).toBeTruthy();
    expect(again.finance).toBe(reversed.finance);
  });

  it("rejeita valor acima do saldo e conta de outra empresa sem efeitos parciais", () => {
    const { finance, portfolio, titleId, accountId } = states();
    const tooMuch = settleReceivable(
      finance,
      portfolio,
      titleId,
      { accountId, date: "2026-10-18", principal: 1001, interest: 0, discount: 0, method: "Manual" },
      "financeiro",
      "bad-amount",
    );
    expect(tooMuch.error).toBeTruthy();
    expect(tooMuch.finance).toBe(finance);
    expect(tooMuch.portfolio).toBe(portfolio);
    const otherBank = finance.accounts.find(account => account.company !== finance.accounts[0].company)!;
    const wrongAccount = settleReceivable(
      finance,
      portfolio,
      titleId,
      { accountId: otherBank.id, date: "2026-10-18", principal: 100, interest: 0, discount: 0, method: "Manual" },
      "financeiro",
      "bad-bank",
    );
    expect(wrongAccount.error).toBeTruthy();
    expect(wrongAccount.finance).toBe(finance);
    expect(wrongAccount.portfolio).toBe(portfolio);
  });
});
