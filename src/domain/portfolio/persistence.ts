import type { PortfolioEvent, PortfolioState, PortfolioTitleRecord } from "./model";

const unique = (values: string[]) => new Set(values).size === values.length;
const validInstant = (value: string | undefined) =>
  !!value && (Number.isFinite(new Date(value).getTime()) || /^\d{2}\/\d{2}\/\d{4}(?:, \d{2}:\d{2})?$/.test(value));
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function validEvent(event: PortfolioEvent) {
  return (
    !!event.id.trim() && validInstant(event.at) && !!event.by.trim() && !!event.action.trim() && !!event.detail.trim()
  );
}

function validTitle(title: PortfolioTitleRecord) {
  if (!title.id.trim() || !title.documentNumber.trim() || !title.ownerDocument.trim() || !title.debtorDocument.trim())
    return false;
  if (!title.ownerName.trim() || !title.debtorName.trim() || !title.dueDate || title.originalAmount <= 0) return false;
  if (
    [
      title.originalAmount,
      title.openAmount ?? 0,
      title.paidAmount,
      title.repurchasedAmount,
      title.discountAmount,
      title.abatementAmount,
    ].some(value => !Number.isFinite(value) || value < 0)
  )
    return false;
  if (!Array.isArray(title.payments) || !unique(title.payments.map(payment => payment.id))) return false;
  if (
    title.payments.some(
      payment =>
        !payment.id.trim() ||
        !Number.isFinite(payment.amount) ||
        !validInstant(payment.createdAt) ||
        !validInstant(payment.date) ||
        !payment.createdBy.trim() ||
        [payment.principalAmount, payment.interestAmount, payment.discountAmount].some(
          value => value !== undefined && (!Number.isFinite(value) || value < 0),
        ),
    )
  )
    return false;
  if (!unique(title.events.map(event => event.id)) || !title.events.every(validEvent)) return false;
  if (!unique(title.collectionOccurrences.map(item => item.id))) return false;
  return title.collectionOccurrences.every(
    item =>
      validInstant(item.chargedAt) &&
      validInstant(item.nextContactAt) &&
      validInstant(item.createdAt) &&
      !!item.createdBy.trim() &&
      !!item.notes.trim(),
  );
}

export function validatePortfolioState(state: PortfolioState): string | null {
  if (state.version !== 3 || !Array.isArray(state.titles)) return "Versão do estado da Carteira não suportada.";
  if (!unique(state.titles.map(title => title.id))) return "Há títulos duplicados na Carteira.";
  if (!state.titles.every(validTitle)) return "Há título, saldo, ocorrência ou histórico inválido na Carteira.";
  return null;
}

const immutableSource = (title: PortfolioTitleRecord) => ({
  id: title.id,
  receivableId: title.receivableId,
  source: title.source,
  importSource: title.importSource,
  receivableType: title.receivableType,
  company: title.company,
  institution: title.institution,
  operationId: title.operationId,
  proposal: title.proposal,
  aditivoNumber: title.aditivoNumber,
  borderoNumber: title.borderoNumber,
  operationType: title.operationType,
  documentNumber: title.documentNumber,
  ownerName: title.ownerName,
  ownerDocument: title.ownerDocument,
  debtorName: title.debtorName,
  debtorDocument: title.debtorDocument,
  issueDate: title.issueDate,
  originalDueDate: title.originalDueDate,
  originalAmount: title.originalAmount,
});

/** Preserva a origem do ativo e torna ocorrências/eventos estritamente append-only. */
export function validatePortfolioTransition(
  previous: PortfolioState,
  next: PortfolioState,
  actorName: string,
  options: { financialCommand?: boolean } = {},
): string | null {
  const previousIds = new Set(previous.titles.map(title => title.id));
  const injected = next.titles.find(title => !previousIds.has(title.id));
  if (injected) return `O título ${injected.documentNumber} precisa existir na origem antes da manutenção.`;
  const nextById = new Map(next.titles.map(title => [title.id, title]));
  for (const prior of previous.titles) {
    const candidate = nextById.get(prior.id);
    if (!candidate) return `O título ${prior.documentNumber} não pode ser removido da Carteira.`;
    if (!same(immutableSource(prior), immutableSource(candidate)))
      return `A origem do título ${prior.documentNumber} é imutável.`;
    if (
      candidate.payments.length < prior.payments.length ||
      prior.payments.some((payment, index) => {
        const saved = candidate.payments[index];
        return (
          !saved ||
          !same({ ...payment, reversedBy: undefined }, { ...saved, reversedBy: undefined }) ||
          (!!payment.reversedBy && payment.reversedBy !== saved.reversedBy) ||
          (!!saved.reversedBy &&
            !candidate.payments.some(reversal => reversal.id === saved.reversedBy && reversal.reversalOf === saved.id))
        );
      })
    )
      return `Os pagamentos do título ${prior.documentNumber} são imutáveis; use estorno vinculado.`;
    if (candidate.payments.slice(prior.payments.length).some(payment => payment.createdBy !== actorName))
      return `A autoria do pagamento do título ${prior.documentNumber} não corresponde à sessão.`;
    const financial = (title: PortfolioTitleRecord) => ({
      openAmount: title.openAmount,
      sourcePosition: title.sourcePosition,
      positionReviewRequired: title.positionReviewRequired,
      paidAmount: title.paidAmount,
      repurchasedAmount: title.repurchasedAmount,
      discountAmount: title.discountAmount,
      abatementAmount: title.abatementAmount,
      payments: title.payments,
      repurchaseReservation: title.repurchaseReservation,
      bankStatus: title.bankStatus,
      bankWriteoff: title.bankWriteoff,
      ourNumber: title.ourNumber,
      bank: title.bank,
      agency: title.agency,
      account: title.account,
      wallet: title.wallet,
      agreement: title.agreement,
    });
    if (
      !options.financialCommand &&
      (!same(financial(prior), financial(candidate)) ||
        (prior.status !== candidate.status &&
          [prior.status, candidate.status].some(status =>
            ["Pago", "Liquidado parcial", "Recomprado", "Recomprado parcial", "Cancelado", "Abatido"].includes(status),
          )))
    )
      return `Saldos, pagamentos e registro bancário do título ${prior.documentNumber} exigem um comando financeiro no servidor.`;
    if (
      candidate.events.length < prior.events.length ||
      prior.events.some((event, index) => !same(event, candidate.events[index]))
    )
      return `O histórico do título ${prior.documentNumber} não pode ser reescrito.`;
    if (
      candidate.collectionOccurrences.length < prior.collectionOccurrences.length ||
      prior.collectionOccurrences.some((item, index) => !same(item, candidate.collectionOccurrences[index]))
    )
      return `As ocorrências do título ${prior.documentNumber} não podem ser reescritas.`;
    if (candidate.events.slice(prior.events.length).some(event => event.by !== actorName))
      return `A autoria do histórico do título ${prior.documentNumber} não corresponde à sessão.`;
    if (
      candidate.collectionOccurrences
        .slice(prior.collectionOccurrences.length)
        .some(item => item.createdBy !== actorName)
    )
      return `A autoria da cobrança do título ${prior.documentNumber} não corresponde à sessão.`;
    if (!same(prior.confirmation, candidate.confirmation) && candidate.confirmation.updatedBy !== actorName)
      return `A autoria da confirmação do título ${prior.documentNumber} não corresponde à sessão.`;
  }
  return null;
}
