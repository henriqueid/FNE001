import { cedentPortfolioTitles } from "@/src/domain/core/demo/portfolio";
import { type ManualEntry, type Operation, type OperationSource } from "@/src/domain/core/types";
import { isReleased } from "@/src/domain/home/metrics";

export type PortfolioTitleStatus =
  | "Em aberto"
  | "Pago"
  | "Protestado"
  | "Em cartório"
  | "Recomprado"
  | "Liquidado parcial"
  | "Recomprado parcial"
  | "Prorrogado"
  | "Abatido"
  | "Cancelado"
  | "Em cobrança";

export type PortfolioBankStatus = "Sem boleto" | "Pendente de integração" | "Registrado" | "Baixado" | "Liquidado";

export type PortfolioEvent = {
  id: string;
  at: string;
  by: string;
  action: string;
  detail: string;
};

export type PortfolioPayment = {
  id: string;
  date: string;
  amount: number;
  bank: string;
  agency?: string;
  account?: string;
  method?: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
};

export type CollectionChannel = "WhatsApp" | "Telefone" | "E-mail" | "Presencial" | "Outro";
export type CollectionOutcome =
  | "Contato realizado"
  | "Sem resposta"
  | "Boleto solicitado"
  | "Promessa de pagamento"
  | "Negociação em andamento"
  | "Recusa de pagamento";

export type PortfolioCollectionOccurrence = {
  id: string;
  chargedAt: string;
  channel: CollectionChannel;
  contactPerson: string;
  outcome: CollectionOutcome;
  notes: string;
  nextContactAt: string;
  promiseDate?: string;
  createdAt: string;
  createdBy: string;
};

export type ConfirmationStatus = "Não iniciada" | "Pendente" | "Confirmado" | "Divergente" | "Não localizado";

export type PortfolioConfirmation = {
  status: ConfirmationStatus;
  contactedAt?: string;
  channel?: CollectionChannel;
  contactPerson?: string;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type PortfolioTitleRecord = {
  id: string;
  status: PortfolioTitleStatus;
  bankStatus: PortfolioBankStatus;
  source: "Carteira anterior" | "Operação liberada";
  importSource?: OperationSource;
  receivableType?: string;
  company?: string;
  institution?: string;
  operationId?: string;
  proposal?: string;
  aditivoNumber?: string;
  borderoNumber?: string;
  operationType?: string;
  documentNumber: string;
  ownerName: string;
  ownerDocument: string;
  debtorName: string;
  debtorDocument: string;
  issueDate?: string;
  originalDueDate: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  repurchasedAmount: number;
  discountAmount: number;
  abatementAmount: number;
  payments: PortfolioPayment[];
  nfeKey?: string;
  ourNumber?: string;
  cfop?: string;
  observation?: string;
  cmc7?: string;
  bank?: string;
  agency?: string;
  account?: string;
  wallet?: string;
  agreement?: string;
  digitableLine?: string;
  barcode?: string;
  protestOffice?: string;
  collectionInstruction?: string;
  collectionOccurrences: PortfolioCollectionOccurrence[];
  confirmation: PortfolioConfirmation;
  compensation?: string;
  country?: string;
  state?: string;
  city?: string;
  commercialRepId?: string;
  events: PortfolioEvent[];
};

export type PortfolioState = {
  version: 3;
  titles: PortfolioTitleRecord[];
};

export type StoredPortfolioState = Omit<PortfolioState, "version"> & { version: 1 | 2 | 3 };

export type NewCollectionOccurrence = Omit<PortfolioCollectionOccurrence, "id" | "createdAt" | "createdBy"> & {
  id?: string;
  createdAt?: string;
  createdBy?: string;
};

export type PortfolioDisplayStatus = PortfolioTitleStatus | "A vencer" | "Vencido";

export function portfolioBalance(
  title: Pick<
    PortfolioTitleRecord,
    "originalAmount" | "paidAmount" | "repurchasedAmount" | "discountAmount" | "abatementAmount"
  >,
) {
  return Math.max(
    0,
    title.originalAmount -
      title.paidAmount -
      (title.repurchasedAmount ?? 0) -
      title.discountAmount -
      title.abatementAmount,
  );
}

export function portfolioDisplayStatus(title: PortfolioTitleRecord, today: string): PortfolioDisplayStatus {
  if (title.status !== "Em aberto") return title.status;
  return title.dueDate < today ? "Vencido" : "A vencer";
}

function operationEntry(op: Operation, entry: ManualEntry): PortfolioTitleRecord {
  return {
    id: `${op.id}-${entry.id}`,
    status: "Em aberto",
    bankStatus: entry.ourNumber ? "Pendente de integração" : "Sem boleto",
    source: "Operação liberada",
    importSource: op.source,
    receivableType: op.manualEntry?.receivableType,
    company: op.vehicle,
    institution: op.institution,
    operationId: op.id,
    proposal: op.proposal,
    aditivoNumber: op.aditivoNumber,
    borderoNumber: op.borderoNumber,
    operationType: op.operationType,
    documentNumber: entry.documentNumber,
    ownerName: op.cedent,
    ownerDocument: op.document,
    debtorName: entry.debtorName,
    debtorDocument: entry.debtorDocument,
    issueDate: entry.issueDate,
    originalDueDate: entry.dueDate,
    dueDate: entry.dueDate,
    originalAmount: entry.amount,
    paidAmount: 0,
    repurchasedAmount: 0,
    discountAmount: entry.discount ?? 0,
    abatementAmount: 0,
    payments: [],
    collectionOccurrences: [],
    confirmation: { status: "Não iniciada" },
    nfeKey: entry.nfeKey,
    ourNumber: entry.ourNumber,
    cfop: entry.cfop,
    observation: entry.observation,
    cmc7: entry.cmc7,
    bank: entry.bank,
    agency: entry.agency,
    account: entry.account,
    compensation: entry.compensation,
    country: entry.country,
    state: entry.state,
    city: entry.city,
    commercialRepId: op.commercialRepId,
    events: [
      {
        id: `origin-${op.id}-${entry.id}`,
        at: op.releaseReview?.releasedAt ?? op.enteredAt,
        by: op.releaseReview?.releasedBy ?? op.owner,
        action: "Entrada na carteira",
        detail: `Título recebido da ${op.proposal}, aditivo ${op.aditivoNumber} e borderô ${op.borderoNumber}.`,
      },
    ],
  };
}

function legacyScenario(id: string, amount: number): Partial<PortfolioTitleRecord> {
  if (id === "car-gz-002")
    return {
      status: "Pago",
      paidAmount: amount,
      payments: [
        {
          id: "pay-car-gz-002",
          date: "2026-09-25",
          amount,
          bank: "Banco Itaú",
          agency: "0642",
          account: "11839-8",
          method: "TED",
          reference: "LIQ-2026-10428",
          createdAt: "25/09/2026, 15:42",
          createdBy: "Henrique",
        },
      ],
    };
  if (id === "car-mc-001")
    return {
      status: "Liquidado parcial",
      paidAmount: 6000,
      payments: [
        {
          id: "pay-car-mc-001",
          date: "2026-09-28",
          amount: 6000,
          bank: "Banco Santander",
          agency: "3319",
          account: "88420-1",
          method: "PIX",
          reference: "PIX-E2E-DEMO-88420",
          createdAt: "28/09/2026, 10:18",
          createdBy: "Conciliação",
        },
      ],
    };
  if (id === "car-mva-002")
    return {
      status: "Protestado",
      protestOffice: "2º Tabelionato de Protesto de São Paulo",
      collectionInstruction: "Aguardar quitação no cartório",
    };
  if (id === "car-rci-001")
    return {
      status: "Em cartório",
      protestOffice: "1º Ofício de Protesto",
      collectionInstruction: "Título encaminhado; aguardando protocolo",
    };
  if (id === "car-ah-002") return { status: "Recomprado", repurchasedAmount: amount };
  if (id === "car-ns-002")
    return {
      status: "Recomprado parcial",
      repurchasedAmount: 15000,
      collectionInstruction: "Cobrar saldo remanescente do sacado",
    };
  return {};
}

function legacyTitles(ops: Operation[]): PortfolioTitleRecord[] {
  return cedentPortfolioTitles.map(title => {
    const ownerDocument = title.groupOwnerDocument ?? title.cedentDocument;
    const related = ops.find(op => op.document === title.cedentDocument || op.document === ownerDocument);
    const [aditivoPart, borderoPart] = title.acquisitionReference.split(" · ");
    const scenario = legacyScenario(title.id, title.faceAmount);
    const scenarioEvent: PortfolioEvent[] = scenario.status
      ? [
          {
            id: `scenario-${title.id}`,
            at: "30/09/2026, 09:30",
            by: "Carteira",
            action: scenario.status,
            detail:
              scenario.status === "Pago"
                ? "Liquidação integral conciliada."
                : scenario.status === "Liquidado parcial"
                  ? "Recebimento parcial conciliado; saldo mantido em aberto."
                  : scenario.status === "Recomprado" || scenario.status === "Recomprado parcial"
                    ? "Recompra registrada na conta gráfica do cedente."
                    : "Ocorrência de cobrança registrada.",
          },
        ]
      : [];
    return {
      id: title.id,
      status: "Em aberto",
      bankStatus: "Sem boleto",
      source: "Carteira anterior",
      receivableType: "Duplicata",
      company: related?.vehicle,
      institution: related?.institution,
      aditivoNumber: aditivoPart?.replace(/^Aditivo\s+/i, ""),
      borderoNumber: borderoPart?.replace(/^Borderô\s+/i, ""),
      documentNumber: title.documentNumber,
      ownerName: title.portfolioOwnerName ?? related?.cedent ?? ownerDocument,
      ownerDocument,
      debtorName: title.debtorName,
      debtorDocument: title.debtorDocument,
      originalDueDate: title.dueDate,
      dueDate: title.dueDate,
      originalAmount: title.faceAmount,
      paidAmount: 0,
      repurchasedAmount: 0,
      discountAmount: 0,
      abatementAmount: 0,
      payments: [],
      collectionOccurrences: [],
      confirmation: { status: "Não iniciada" },
      commercialRepId: related?.commercialRepId,
      observation: `Carteira histórica · aquisição ${title.acquisitionMethod} a ${title.acquisitionMonthlyRate.toLocaleString("pt-BR")}% a.m.`,
      events: [
        {
          id: `origin-${title.id}`,
          at: title.dueDate,
          by: "Migração da carteira",
          action: "Posição inicial",
          detail: title.acquisitionReference,
        },
        ...scenarioEvent,
      ],
      ...scenario,
    };
  });
}

function releasedOperationTitles(ops: Operation[]) {
  return ops.filter(isReleased).flatMap(op => {
    const decisions = op.riskReview?.titleDecisions ?? {};
    const hasDecisions = Object.keys(decisions).length > 0;
    return (op.manualEntry?.entries ?? [])
      .filter(entry => !hasDecisions || decisions[entry.id] === "Aprovado")
      .map(entry => operationEntry(op, entry));
  });
}

export function seedPortfolio(ops: Operation[]): PortfolioState {
  return { version: 3, titles: [...legacyTitles(ops), ...releasedOperationTitles(ops)] };
}

export function migratePortfolioState(restored: StoredPortfolioState, ops: Operation[]): PortfolioState {
  const baseline = seedPortfolio(ops);
  const baselineById = new Map(baseline.titles.map(title => [title.id, title]));
  const titles = restored.titles.map(title => {
    const fresh = baselineById.get(title.id);
    const legacyStatus = title.status as PortfolioTitleStatus | "Parcialmente pago" | "Liquidado";
    const status =
      legacyStatus === "Parcialmente pago" ? "Liquidado parcial" : legacyStatus === "Liquidado" ? "Pago" : legacyStatus;
    return {
      ...fresh,
      ...title,
      status: restored.version === 1 && title.status === "Em aberto" && fresh ? fresh.status : status,
      repurchasedAmount: title.repurchasedAmount ?? fresh?.repurchasedAmount ?? 0,
      payments: restored.version === 1 ? (fresh?.payments ?? []) : (title.payments ?? []),
      collectionOccurrences: title.collectionOccurrences ?? fresh?.collectionOccurrences ?? [],
      confirmation: title.confirmation ?? fresh?.confirmation ?? { status: "Não iniciada" },
      events: [...(title.events ?? []), ...(restored.version === 1 ? (fresh?.events.slice(1) ?? []) : [])],
    } as PortfolioTitleRecord;
  });
  const known = new Set(titles.map(title => title.id));
  return { version: 3, titles: [...titles, ...baseline.titles.filter(title => !known.has(title.id))] };
}

export function addCollectionOccurrence(
  state: PortfolioState,
  titleId: string,
  occurrence: NewCollectionOccurrence,
): PortfolioState {
  const createdAt = occurrence.createdAt ?? new Date().toISOString();
  const createdBy = occurrence.createdBy ?? "Henrique";
  const record: PortfolioCollectionOccurrence = {
    ...occurrence,
    id: occurrence.id ?? `collection-${titleId}-${Date.now()}`,
    createdAt,
    createdBy,
  };
  return {
    ...state,
    titles: state.titles.map(title =>
      title.id === titleId
        ? {
            ...title,
            status: title.status === "Em aberto" ? "Em cobrança" : title.status,
            collectionOccurrences: [...(title.collectionOccurrences ?? []), record],
            events: [
              ...title.events,
              {
                id: `event-${record.id}`,
                at: record.chargedAt,
                by: createdBy,
                action: `Cobrança · ${record.channel}`,
                detail: `${record.outcome}. ${record.notes} Retorno: ${record.nextContactAt}.`,
              },
            ],
          }
        : title,
    ),
  };
}

export function updatePortfolioConfirmation(
  state: PortfolioState,
  titleId: string,
  confirmation: PortfolioConfirmation,
): PortfolioState {
  return {
    ...state,
    titles: state.titles.map(title =>
      title.id === titleId
        ? {
            ...title,
            confirmation,
            events: [
              ...title.events,
              {
                id: `confirmation-${titleId}-${Date.now()}`,
                at: confirmation.contactedAt ?? confirmation.updatedAt ?? new Date().toISOString(),
                by: confirmation.updatedBy ?? "Henrique",
                action: `Controladoria · ${confirmation.status}`,
                detail: `${confirmation.channel ?? "Canal não informado"}${confirmation.contactPerson ? ` com ${confirmation.contactPerson}` : ""}. ${confirmation.notes ?? "Sem observações."}`,
              },
            ],
          }
        : title,
    ),
  };
}

/** Acrescenta títulos de operações recém-liberadas sem sobrescrever a manutenção já feita na carteira. */
export function syncPortfolio(state: PortfolioState, ops: Operation[]): PortfolioState {
  const known = new Set(state.titles.map(title => title.id));
  const additions = releasedOperationTitles(ops).filter(title => !known.has(title.id));
  return additions.length ? { ...state, titles: [...state.titles, ...additions] } : state;
}
