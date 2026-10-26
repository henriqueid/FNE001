/** Reconcilia a posição importada com pagamentos locais sem inferir compensações financeiras. */
import type { PortfolioTitleRecord } from "./model";
export function overlayPortfolioPosition(source: PortfolioTitleRecord, stored: PortfolioTitleRecord) {
  const local =
    stored.payments.some(payment => payment.financeTitleId) ||
    Boolean(stored.repurchaseReservation) ||
    stored.events.some(event => event.action === "Recompra estornada");
  const financial = (title: PortfolioTitleRecord) => ({
    openAmount: title.openAmount,
    paidAmount: title.paidAmount,
    discountAmount: title.discountAmount,
    repurchasedAmount: title.repurchasedAmount,
    repurchaseReservation: title.repurchaseReservation,
    abatementAmount: title.abatementAmount,
  });
  let positionReviewRequired: string | undefined;
  if (local && source.source === "Carteira anterior") {
    const snapshot = source.sourcePosition;
    const baseline = stored.sourcePosition;
    const totals = (value: { openAmount?: number; paidAmount: number; discountAmount: number }) =>
      JSON.stringify([value.openAmount, value.paidAmount, value.discountAmount]);
    const unchanged = snapshot && baseline && totals(snapshot) === totals(baseline);
    const reconciled = snapshot && totals(snapshot) === totals(stored);
    if (!unchanged && !reconciled)
      positionReviewRequired =
        "A nova posição importada diverge dos recebimentos locais. Reconcilie o arquivo de origem antes de receber, estornar ou emitir cobrança.";
  }
  return {
    ...source,
    ...(local ? financial(stored) : {}),
    ...(positionReviewRequired ? { sourcePosition: stored.sourcePosition } : {}),
    positionReviewRequired,
    status: local || stored.source === "Operação liberada" ? stored.status : source.status,
    bankWriteoff: stored.bankWriteoff,
    bankStatus: stored.ourNumber || source.source === "Operação liberada" ? stored.bankStatus : source.bankStatus,
    dueDate:
      source.source === "Carteira anterior" && source.sourcePosition?.id !== stored.sourcePosition?.id
        ? source.dueDate
        : stored.dueDate,
    protestOffice: stored.protestOffice,
    collectionInstruction: stored.collectionInstruction,
    payments: stored.payments,
    collectionOccurrences: stored.collectionOccurrences,
    confirmation: stored.confirmation,
    events: stored.events,
    ourNumber: stored.ourNumber ?? source.ourNumber,
    bank: stored.bank ?? source.bank,
    agency: stored.agency ?? source.agency,
    account: stored.account ?? source.account,
    wallet: stored.wallet ?? source.wallet,
    agreement: stored.agreement ?? source.agreement,
  };
}
