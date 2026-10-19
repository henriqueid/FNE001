/** Liquidação do ativo e contrapartida de caixa em um resultado indivisível, executado pelo servidor. */
import { assertDateOpen } from "@/src/domain/finance/closing";
import { hist, patchTitle, round2, run } from "@/src/domain/finance/ledger";
import { roleLedger, type FinanceState } from "@/src/domain/finance/model";
import { createTitleDraft, reverseDraft, settleDraft } from "@/src/domain/finance/titles";
import { portfolioBalance, type PortfolioPayment, type PortfolioState, type PortfolioTitleRecord } from "./model";

export type ReceivableSettlementInput = {
  accountId: string;
  date: string;
  principal: number;
  interest: number;
  discount: number;
  method: string;
};
export type ReceivableReversalInput = { date: string; reason: string; cashMoved: boolean };
export type ReceivableSettlementResult = {
  finance: FinanceState;
  portfolio: PortfolioState;
  error?: string;
  message?: string;
};

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

const update = (portfolio: PortfolioState, title: PortfolioTitleRecord): PortfolioState => ({
  ...portfolio,
  titles: portfolio.titles.map(candidate => (candidate.id === title.id ? title : candidate)),
});

export function settleReceivable(
  finance: FinanceState,
  portfolio: PortfolioState,
  titleId: string,
  input: ReceivableSettlementInput,
  actor: string,
  commandId: string,
): ReceivableSettlementResult {
  const fail = (error: string) => ({ finance, portfolio, error });
  const title = portfolio.titles.find(candidate => candidate.id === titleId);
  if (title?.positionReviewRequired) return fail(title.positionReviewRequired);
  if (!title?.company || ["Pago", "Recomprado", "Cancelado"].includes(title.status))
    return fail("Título não encontrado ou sem saldo liquidável.");
  if (!validDate(input.date) || !input.method.trim()) return fail("Informe data e método válidos para a liquidação.");
  if (
    [input.principal, input.interest, input.discount].some(
      value => !Number.isFinite(value) || value < 0 || round2(value) !== value,
    ) ||
    input.principal <= 0 ||
    input.principal > portfolioBalance(title) ||
    input.discount > input.principal
  )
    return fail("Valor principal, juros ou desconto inválidos para o saldo do recebível.");
  if (title.payments.some(payment => payment.id === commandId))
    return fail("Este comando de liquidação já foi registrado.");
  const account = finance.accounts.find(candidate => candidate.id === input.accountId);
  if (!account || account.company !== title.company) return fail("Escolha uma conta da mesma empresa do recebível.");
  let financeTitleId = "";
  const financial = run(finance, draft => {
    assertDateOpen(finance, title.company!, input.date);
    financeTitleId = createTitleDraft(
      draft,
      {
        kind: "Receber",
        description: `Liquidação ${title.documentNumber}`,
        counterparty: title.debtorName,
        counterpartyDocument: title.debtorDocument,
        company: title.company!,
        competenceDate: input.date,
        dueDate: input.date,
        amount: input.principal,
        settlementLedger: roleLedger(draft, "acquired"),
        skipCompetence: true,
        operationId: title.operationId,
        portfolioTitleId: title.id,
      },
      actor,
    );
    settleDraft(
      draft,
      financeTitleId,
      {
        accountId: account.id,
        date: input.date,
        method: input.method,
        amount: input.principal,
        interest: input.interest,
        discount: input.discount,
      },
      actor,
    );
    return {};
  });
  if (financial.error) return fail(financial.error);
  const balance = round2(portfolioBalance(title) - input.principal);
  const payment: PortfolioPayment = {
    id: commandId,
    date: input.date,
    amount: round2(input.principal + input.interest - input.discount),
    bank: account.bankName,
    agency: account.agency,
    account: account.account,
    accountId: account.id,
    method: input.method,
    reference: financeTitleId,
    financeTitleId,
    principalAmount: input.principal,
    interestAmount: input.interest,
    discountAmount: input.discount,
    createdAt: new Date().toISOString(),
    createdBy: actor,
    previousStatus: title.status,
    previousBankStatus: title.bankStatus,
  };
  const nextTitle: PortfolioTitleRecord = {
    ...title,
    status: balance === 0 ? "Pago" : "Liquidado parcial",
    bankStatus: balance === 0 ? "Liquidado" : title.bankStatus,
    openAmount: balance,
    paidAmount: round2(title.paidAmount + input.principal - input.discount),
    discountAmount: round2(title.discountAmount + input.discount),
    payments: [...title.payments, payment],
    events: [
      ...title.events,
      {
        id: `settlement:${commandId}`,
        at: payment.createdAt,
        by: actor,
        action: "Liquidação de recebível",
        detail: `${financeTitleId} · principal ${input.principal.toFixed(2)} · juros ${input.interest.toFixed(2)} · desconto ${input.discount.toFixed(2)}`,
      },
    ],
  };
  return {
    finance: financial.state,
    portfolio: update(portfolio, nextTitle),
    message: "Recebível liquidado com atualização da carteira, caixa e contabilidade.",
  };
}

export function reverseReceivableSettlement(
  finance: FinanceState,
  portfolio: PortfolioState,
  titleId: string,
  paymentId: string,
  input: ReceivableReversalInput,
  actor: string,
  commandId: string,
): ReceivableSettlementResult {
  const fail = (error: string) => ({ finance, portfolio, error });
  const title = portfolio.titles.find(candidate => candidate.id === titleId);
  const payment = title?.payments.find(candidate => candidate.id === paymentId);
  if (title?.positionReviewRequired) return fail(title.positionReviewRequired);
  if (
    !title?.company ||
    !payment?.financeTitleId ||
    !payment.principalAmount ||
    payment.reversedBy ||
    payment.reversalOf
  )
    return fail("Liquidação não encontrada, já estornada ou sem vínculo financeiro verificável.");
  if (!validDate(input.date) || !input.reason.trim() || typeof input.cashMoved !== "boolean")
    return fail("Informe data e motivo do estorno e a situação do caixa.");
  if (title.payments.some(candidate => candidate.id === commandId))
    return fail("Este comando de estorno já foi registrado.");
  const financial = run(finance, draft => {
    assertDateOpen(finance, title.company!, input.date);
    reverseDraft(
      draft,
      payment.financeTitleId!,
      { reason: input.reason, cashMoved: input.cashMoved },
      actor,
      input.date,
    );
    // Este CR materializa apenas o recebimento; a obrigação do sacado permanece no ativo da Carteira.
    // Após desfazer a baixa, encerra a materialização para não deixar um CR duplicado no próximo ciclo.
    patchTitle(
      draft,
      payment.financeTitleId!,
      { status: "Cancelado" },
      hist(actor, "Recebimento da Carteira estornado", `${commandId} · ${input.reason}`),
    );
    return {};
  });
  if (financial.error) return fail(financial.error);
  const discount = payment.discountAmount ?? 0;
  const balance = round2(portfolioBalance(title) + payment.principalAmount);
  const paidAmount = round2(title.paidAmount - payment.principalAmount + discount);
  const discountAmount = round2(title.discountAmount - discount);
  if (paidAmount < 0 || discountAmount < 0)
    return fail("A posição da carteira diverge da liquidação; confira antes de estornar.");
  const reversal: PortfolioPayment = {
    ...payment,
    id: commandId,
    date: input.date,
    amount: -payment.amount,
    reversalOf: payment.id,
    reversedBy: undefined,
    createdAt: new Date().toISOString(),
    createdBy: actor,
  };
  const payments = [
    ...title.payments.map(candidate =>
      candidate.id === payment.id ? { ...candidate, reversedBy: commandId } : candidate,
    ),
    reversal,
  ];
  const active = payments.filter(candidate => !candidate.reversalOf && !candidate.reversedBy);
  const original = title.payments.find(candidate => candidate.financeTitleId && !candidate.reversalOf);
  const nextTitle: PortfolioTitleRecord = {
    ...title,
    openAmount: balance,
    paidAmount,
    discountAmount,
    payments,
    status: active.length ? "Liquidado parcial" : (original?.previousStatus ?? "Em aberto"),
    bankStatus: original?.previousBankStatus ?? "Registrado",
    events: [
      ...title.events,
      {
        id: `settlement-reversal:${commandId}`,
        at: reversal.createdAt,
        by: actor,
        action: "Estorno de liquidação",
        detail: `${payment.financeTitleId} · ${input.reason} · ${input.cashMoved ? "valor a devolver ao sacado" : "movimento bancário revertido"}`,
      },
    ],
  };
  return {
    finance: financial.state,
    portfolio: update(portfolio, nextTitle),
    message: "Liquidação estornada com recomposição da carteira e contrapartida financeira.",
  };
}
