export type InstitutionType = "FIDC" | "Securitizadora" | "Factoring";
export type OperationSource = "XML NF-e" | "CNAB" | "Planilha" | "Digitação manual" | "Crédito estruturado";
export type OperationStatus = "Em andamento" | "Aguardando terceiro" | "Em atenção" | "Pronta para formalizar" | "Pronta para liberar" | "Cancelada";

export type CancellationMemory = {
  category: string;
  reason: string;
  cancelledAt: string;
  cancelledBy: string;
  stage: number;
  stageName: string;
  operationSignature: string;
};

export type ManualEntry = {
  id: string;
  documentNumber: string;
  amount: number;
  dueDate: string;
  debtorId: string;
  debtorName: string;
  debtorDocument: string;
  discount?: number;
  issueDate?: string;
  nfeKey?: string;
  ourNumber?: string;
  cfop?: string;
  observation?: string;
  cmc7?: string;
  bank?: string;
  agency?: string;
  account?: string;
  compensation?: string;
  country?: string;
  state?: string;
  city?: string;
};

export type ManualEntryData = {
  receivableType: "Duplicata" | "Cheque" | "Nota promissória" | "Transferibilidade" | "Garantia";
  mode: "parcelado" | "individual";
  entries: ManualEntry[];
};

export type PortfolioPosition = { count: number; amount: number };

export type DebtorPortfolioMetrics = {
  settledOnTime: PortfolioPosition;
  settledLate: PortfolioPosition;
  repurchased: PortfolioPosition;
  protested: PortfolioPosition;
  courtSettled: PortfolioPosition;
  extendedSettled: PortfolioPosition;
  openDue: PortfolioPosition;
  openOverdue: PortfolioPosition;
  openExtended: PortfolioPosition;
  openNegotiation: PortfolioPosition;
  concentrationPercent: number;
};

export type Debtor = {
  id: string;
  document: string;
  name: string;
  tradeName?: string;
  address: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  email?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  source: "Sistema" | "Integração" | "Cadastro manual";
  score?: number;
  portfolioReceivable?: number;
  portfolioOverdue?: number;
  settlements?: number;
  lateSettlements?: number;
  averageDelayDays?: number;
  repurchases?: number;
  incidents?: number;
  publicStatus?: string;
  scoreReasons?: string[];
  incidentDetails?: string[];
  portfolioMetrics?: DebtorPortfolioMetrics;
  groupName?: string;
  groupCompanies?: number;
  groupExposure?: number;
  groupOverdue?: number;
  groupScore?: number;
};

export type Cedent = {
  id: string;
  document: string;
  name: string;
  score: number;
  creditLimit: number;
  usedLimit: number;
  portfolioReceivable: number;
  portfolioOverdue: number;
  settlements: number;
  lateSettlements: number;
  averageDelayDays: number;
  repurchases: number;
  incidents: number;
  publicStatus: string;
  scoreReasons?: string[];
  incidentDetails?: string[];
  portfolioMetrics?: DebtorPortfolioMetrics;
};

export type CedentPortfolioTitle = {
  id: string;
  cedentDocument: string;
  debtorName: string;
  debtorDocument: string;
  documentNumber: string;
  dueDate: string;
  faceAmount: number;
  acquisitionMonthlyRate: number;
  acquisitionMethod: "Nominal" | "Efetiva" | "Mista" | "Composta Mista";
  acquisitionReference: string;
  portfolioOwnerName?: string;
  groupOwnerDocument?: string;
  status: "Em aberto";
};

export type CedentSettlementAdjustment = {
  id: string;
  cedentDocument: string;
  groupOwnerDocument?: string;
  ownerName: string;
  kind: "Pendência" | "Crédito";
  description: string;
  reference: string;
  amount: number;
};

export type Stage = {
  id: number;
  short: string;
  title: string;
  description: string;
};

export type Operation = {
  id: string;
  proposal: string;
  aditivoNumber: string;
  borderoNumber: string;
  institution: InstitutionType;
  vehicle: string;
  cedent: string;
  document: string;
  amount: number;
  netAmount: number;
  titleCount: number;
  stage: number;
  status: OperationStatus;
  owner: string;
  ownerInitials: string;
  enteredAt: string;
  waitingFor: string;
  elapsedMinutes: number;
  clientAverageMinutes: number;
  historySample: number;
  risk: "Baixo" | "Médio" | "Alto";
  automation: number;
  blockers: number;
  alerts: number;
  nextAction: string;
  policy: string;
  fundClass?: string;
  participants?: string[];
  source?: OperationSource;
  operationType?: string;
  financialObservation?: string;
  stageCompletions?: {
    stageId: number;
    completedBy: string;
    completedAt: string;
  }[];
  cancellation?: CancellationMemory;
  manualEntry?: ManualEntryData;
  riskReview?: {
    cedentDecision?: "Aprovado" | "Reprovado";
    debtorDecisions?: Record<string, "Aprovado" | "Reprovado">;
    titleDecisions?: Record<string, "Aprovado" | "Reprovado">;
    audit?: { entity: string; decision: "Aprovado" | "Reprovado"; by: string; at: string; policy: string }[];
  };
  lastroReview?: {
    items?: Record<string, {
      evidenceDecision?: "Validada" | "Pendente" | "Divergente";
      confirmation?: "Pendente" | "Contato iniciado" | "Sem contato" | "Confirmado" | "Confirmado com ressalva" | "Recusado" | "Telefone inválido";
      attachmentName?: string;
      attachmentNotes?: string;
      confirmationNotes?: string;
      confirmationScope?: "Nota" | "Sacado";
      nextContactAt?: string;
      divergenceReason?: "Documento ausente" | "Valor divergente" | "Vencimento divergente" | "Mercadoria ou serviço não reconhecido" | "Duplicidade" | "Documento inválido" | "Outro";
      contactAttempts?: number;
      attempts?: {
        channel: "Ligação" | "WhatsApp";
        result: "Contato iniciado" | "Sem contato" | "Confirmado" | "Confirmado com ressalva" | "Recusado" | "Telefone inválido";
        at: string;
        by: string;
        nextContactAt?: string;
      }[];
      checklist?: {
        identityConfirmed?: boolean;
        deliveryConfirmed?: boolean;
        amountAndDueDateConfirmed?: boolean;
        noDisputeReported?: boolean;
      };
      updatedAt?: string;
      updatedBy?: string;
    }>;
  };
  pricingReview?: {
    method: "Nominal" | "Efetiva" | "Mista" | "Composta Mista";
    vaEnabled: boolean;
    monthlyRate: number;
    targetFinalRateMonthly?: number;
    fundingCostMonthly: number;
    floatDays: number;
    minimumTermDays: number;
    operationFee: number;
    feePerTitle: number;
    adValoremPercent: number;
    guaranteePercent: number;
    manualRetention: number;
    manualFees?: Array<{
      id: string;
      description: string;
      amount: number;
      kind: "Esporádica";
    }>;
    repurchaseTitleIds?: string[];
    settlementAdjustmentIds?: string[];
    repurchaseTerms?: Record<string, {
      rateOverride?: number;
      lateInterestMonthly: number;
      penaltyPercent: number;
      action?: "Recompra" | "Baixar do banco" | "Baixar somente do sistema" | "Recompra parcial";
      partialAmount?: number;
    }>;
    feeAllocation: "Por valor" | "Por valor × prazo";
    regress: "Com regresso" | "Sem regresso";
    regressDays: number;
    coobligation: boolean;
    status: "Simulação" | "Condição salva";
    savedAt?: string;
    savedBy?: string;
    version?: number;
    locked?: boolean;
    audit?: Array<{
      version: number;
      at: string;
      by: string;
      action: "Condição salva" | "Nova versão iniciada";
      reason?: string;
      face: number;
      commercialNet: number;
      repurchaseAndCompensations: number;
      borderoNet: number;
      monthlyRate: number;
      method: "Nominal" | "Efetiva" | "Mista" | "Composta Mista";
    }>;
  };
  approvalReview?: {
    status: "Preparação" | "Em aprovação" | "Aprovada" | "Reprovada" | "Em formalização";
    submittedAt?: string;
    submittedBy?: string;
    observation?: string;
    approvals?: Array<{
      id: string;
      role: string;
      approver: string;
      status: "Aprovado" | "Pendente" | "Reprovado";
      decidedAt?: string;
      note?: string;
    }>;
    documents?: Array<{
      id: string;
      name: string;
      required: boolean;
      status: "Pronto" | "Pendente" | "Dispensado";
      source: string;
    }>;
    signatures?: Array<{
      id: string;
      party: string;
      signer: string;
      status: "Não enviado" | "Enviado" | "Assinado" | "Recusado";
      sentAt?: string;
      signedAt?: string;
    }>;
    audit?: Array<{
      at: string;
      by: string;
      action: string;
      detail: string;
    }>;
  };
};

export type Destination = {
  name: string;
  institution: InstitutionType;
  detail: string;
};

export const destinations: Destination[] = [
  { name: "Lastro Prime FIDC · Classe Sênior", institution: "FIDC", detail: "Classe Sênior · Subclasse A" },
  { name: "Aurora Recebíveis FIDC · Classe Única", institution: "FIDC", detail: "Classe Única" },
  { name: "Órbita Securitizadora S.A.", institution: "Securitizadora", detail: "Companhia securitizadora" },
  { name: "Lastro Fomento Mercantil", institution: "Factoring", detail: "Factoring com regresso" },
];

export const initialDebtors: Debtor[] = [
  { id: "sacado-1", document: "44.659.901/0001-65", name: "L.V. Carvalho Gutierrez Ltda", tradeName: "L.V. Carvalho", address: "Rua Paraná", number: "1511", district: "Centro", city: "Cascavel", state: "PR", zipCode: "85801-050", email: "financeiro@lvcarvalho.com.br", phone: "(45) 3035-4100", source: "Sistema", score: 812, portfolioReceivable: 486834.22, portfolioOverdue: 0, settlements: 42, lateSettlements: 1, averageDelayDays: 1, repurchases: 0, incidents: 0, publicStatus: "Ativa e regular", scoreReasons: ["Carteira sem títulos vencidos", "42 liquidações com atraso médio de 1 dia", "Nenhuma recompra registrada", "Cadastro público regular"], portfolioMetrics: { settledOnTime: { count: 41, amount: 1280430.18 }, settledLate: { count: 1, amount: 28400 }, repurchased: { count: 0, amount: 0 }, protested: { count: 0, amount: 0 }, courtSettled: { count: 0, amount: 0 }, extendedSettled: { count: 1, amount: 19800 }, openDue: { count: 9, amount: 486834.22 }, openOverdue: { count: 0, amount: 0 }, openExtended: { count: 0, amount: 0 }, openNegotiation: { count: 0, amount: 0 }, concentrationPercent: 18.4 }, groupName: "Grupo Carvalho", groupCompanies: 3, groupExposure: 724190.8, groupOverdue: 0, groupScore: 784 },
  { id: "sacado-2", document: "07.583.481/0001-54", name: "Carlos Marco Distribuidora Ltda", tradeName: "Carlos Marco", address: "Av. Brasil", number: "2840", district: "São Cristóvão", city: "Cascavel", state: "PR", zipCode: "85816-290", phone: "(45) 3224-8890", source: "Sistema", score: 548, portfolioReceivable: 192450, portfolioOverdue: 28600, settlements: 19, lateSettlements: 6, averageDelayDays: 12, repurchases: 2, incidents: 1, publicStatus: "Ativa · 1 apontamento cadastral", scoreReasons: ["R$ 28.600,00 vencidos na carteira", "6 de 19 liquidações ocorreram após o vencimento", "Atraso médio de 12 dias", "2 recompras registradas"], incidentDetails: ["Apontamento cadastral em monitoramento"], portfolioMetrics: { settledOnTime: { count: 13, amount: 552000 }, settledLate: { count: 6, amount: 184900 }, repurchased: { count: 2, amount: 48000 }, protested: { count: 1, amount: 19000 }, courtSettled: { count: 0, amount: 0 }, extendedSettled: { count: 2, amount: 74000 }, openDue: { count: 5, amount: 163850 }, openOverdue: { count: 2, amount: 28600 }, openExtended: { count: 1, amount: 22600 }, openNegotiation: { count: 1, amount: 28600 }, concentrationPercent: 11.2 }, groupName: "Grupo Marco", groupCompanies: 2, groupExposure: 338900, groupOverdue: 42600, groupScore: 526 },
  { id: "sacado-3", document: "75.846.394/0001-00", name: "Supermercado Haag Ltda", address: "Rua das Flores", number: "830", district: "Jardim América", city: "Toledo", state: "PR", zipCode: "85905-180", email: "contato@haag.com.br", source: "Sistema", score: 721, portfolioReceivable: 118900, portfolioOverdue: 4200, settlements: 31, lateSettlements: 3, averageDelayDays: 4, repurchases: 1, incidents: 0, publicStatus: "Ativa e regular", scoreReasons: ["Baixa proporção de vencidos na carteira", "31 liquidações no histórico", "Atraso médio controlado em 4 dias", "Cadastro público regular"], portfolioMetrics: { settledOnTime: { count: 28, amount: 910400 }, settledLate: { count: 3, amount: 103200 }, repurchased: { count: 1, amount: 29000 }, protested: { count: 0, amount: 0 }, courtSettled: { count: 0, amount: 0 }, extendedSettled: { count: 2, amount: 54000 }, openDue: { count: 4, amount: 114700 }, openOverdue: { count: 1, amount: 4200 }, openExtended: { count: 1, amount: 31000 }, openNegotiation: { count: 0, amount: 0 }, concentrationPercent: 7.6 }, groupName: "Grupo Haag", groupCompanies: 4, groupExposure: 582440, groupOverdue: 12300, groupScore: 698 },
];

export const initialCedents: Cedent[] = [
  { id: "ced-1", document: "52.927.676/0001-29", name: "GZ Transportes Ltda", score: 742, creditLimit: 1500000, usedLimit: 548977.45, portfolioReceivable: 1063584.06, portfolioOverdue: 0, settlements: 186, lateSettlements: 7, averageDelayDays: 3, repurchases: 2, incidents: 0, publicStatus: "Ativa e regular", scoreReasons: ["36,6% do limite utilizado", "Carteira sem vencidos", "Atraso médio de 3 dias", "186 liquidações no histórico"], portfolioMetrics: { settledOnTime: { count: 179, amount: 6842100 }, settledLate: { count: 7, amount: 274800 }, repurchased: { count: 2, amount: 65400 }, protested: { count: 1, amount: 32000 }, courtSettled: { count: 0, amount: 0 }, extendedSettled: { count: 4, amount: 188400 }, openDue: { count: 22, amount: 1063584.06 }, openOverdue: { count: 0, amount: 0 }, openExtended: { count: 2, amount: 84200 }, openNegotiation: { count: 0, amount: 0 }, concentrationPercent: 18.4 } },
  { id: "ced-2", document: "59.264.846/0001-81", name: "Mundo das Canecas Fantasia", score: 684, creditLimit: 500000, usedLimit: 198412.25, portfolioReceivable: 286740.1, portfolioOverdue: 15469.25, settlements: 74, lateSettlements: 8, averageDelayDays: 6, repurchases: 1, incidents: 0, publicStatus: "Ativa e regular" },
  { id: "ced-3", document: "12.482.991/0001-08", name: "Metalúrgica Vale do Aço Ltda", score: 619, creditLimit: 900000, usedLimit: 612340.8, portfolioReceivable: 578220.4, portfolioOverdue: 42180, settlements: 93, lateSettlements: 14, averageDelayDays: 9, repurchases: 4, incidents: 1, publicStatus: "Ativa · atenção cadastral" },
  { id: "ced-4", document: "08.411.620/0001-44", name: "Alimentos Horizonte S.A.", score: 836, creditLimit: 3200000, usedLimit: 1248700, portfolioReceivable: 1985400, portfolioOverdue: 0, settlements: 264, lateSettlements: 3, averageDelayDays: 1, repurchases: 0, incidents: 0, publicStatus: "Ativa e regular" },
  { id: "ced-5", document: "33.907.118/0001-62", name: "Distribuidora Nova Serra", score: 706, creditLimit: 1100000, usedLimit: 426900, portfolioReceivable: 734120, portfolioOverdue: 6800, settlements: 112, lateSettlements: 6, averageDelayDays: 3, repurchases: 1, incidents: 0, publicStatus: "Ativa e regular" },
  { id: "ced-6", document: "44.362.223/0001-74", name: "Rede Clínica Integra", score: 571, creditLimit: 5000000, usedLimit: 4100000, portfolioReceivable: 4686400, portfolioOverdue: 298600, settlements: 138, lateSettlements: 29, averageDelayDays: 14, repurchases: 7, incidents: 2, publicStatus: "Ativa · 2 apontamentos cadastrais", scoreReasons: ["82% do limite de crédito já utilizado", "R$ 298.600,00 vencidos na carteira", "29 liquidações após o vencimento", "Atraso médio de 14 dias", "7 recompras registradas"], incidentDetails: ["Restrição cadastral financeira em monitoramento", "Concentração elevada no grupo econômico"], portfolioMetrics: { settledOnTime: { count: 109, amount: 11342000 }, settledLate: { count: 29, amount: 1840600 }, repurchased: { count: 7, amount: 612000 }, protested: { count: 4, amount: 338000 }, courtSettled: { count: 2, amount: 176000 }, extendedSettled: { count: 11, amount: 980000 }, openDue: { count: 76, amount: 4387800 }, openOverdue: { count: 8, amount: 298600 }, openExtended: { count: 12, amount: 742000 }, openNegotiation: { count: 5, amount: 384000 }, concentrationPercent: 32.6 } },
];

// Posição analítica da carteira própria de cada cedente. Em produção, esta lista
// será alimentada pelo módulo de carteira e conciliação, sem depender da operação atual.
export const cedentPortfolioTitles: CedentPortfolioTitle[] = [
  { id: "car-gz-001", cedentDocument: "52.927.676/0001-29", debtorName: "L.V. Carvalho Gutierrez Ltda", debtorDocument: "44.659.901/0001-65", documentNumber: "GZ-9081/01", dueDate: "2026-10-08", faceAmount: 48750, acquisitionMonthlyRate: 2.35, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260718004 · Borderô 0003271", status: "Em aberto" },
  { id: "car-gz-002", cedentDocument: "52.927.676/0001-29", debtorName: "Supermercado Haag Ltda", debtorDocument: "75.846.394/0001-00", documentNumber: "GZ-9134/02", dueDate: "2026-11-03", faceAmount: 72900, acquisitionMonthlyRate: 2.2, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260802002 · Borderô 0003319", status: "Em aberto" },
  { id: "car-mc-001", cedentDocument: "59.264.846/0001-81", debtorName: "Empório Central Ltda", debtorDocument: "31.998.442/0001-07", documentNumber: "MC-4418/01", dueDate: "2026-09-12", faceAmount: 15469.25, acquisitionMonthlyRate: 2.65, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260711001 · Borderô 0003244", status: "Em aberto" },
  { id: "car-mc-002", cedentDocument: "59.264.846/0001-81", debtorName: "Presentes Sul Comércio Ltda", debtorDocument: "18.443.120/0001-52", documentNumber: "MC-4471/01", dueDate: "2026-10-18", faceAmount: 32600, acquisitionMonthlyRate: 2.45, acquisitionMethod: "Mista", acquisitionReference: "Aditivo 20260809003 · Borderô 0003338", status: "Em aberto" },
  { id: "car-mva-001", cedentDocument: "12.482.991/0001-08", debtorName: "Construtora Prado S.A.", debtorDocument: "17.038.290/0001-40", documentNumber: "MVA-7821/03", dueDate: "2026-08-29", faceAmount: 24780, acquisitionMonthlyRate: 3.1, acquisitionMethod: "Nominal", acquisitionReference: "Aditivo 20260614002 · Borderô 0003182", status: "Em aberto" },
  { id: "car-mva-002", cedentDocument: "12.482.991/0001-08", debtorName: "Indústria Técnica Paraná Ltda", debtorDocument: "05.820.311/0001-18", documentNumber: "MVA-7902/01", dueDate: "2026-09-19", faceAmount: 17400, acquisitionMonthlyRate: 2.95, acquisitionMethod: "Nominal", acquisitionReference: "Aditivo 20260728001 · Borderô 0003296", status: "Em aberto" },
  { id: "car-mva-003", cedentDocument: "12.482.991/0001-08", debtorName: "Obrasul Engenharia Ltda", debtorDocument: "23.610.748/0001-81", documentNumber: "MVA-8015/02", dueDate: "2026-10-22", faceAmount: 56800, acquisitionMonthlyRate: 2.9, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260819004 · Borderô 0003360", status: "Em aberto" },
  { id: "car-ah-001", cedentDocument: "08.411.620/0001-44", debtorName: "Rede Mercantil Nacional S.A.", debtorDocument: "02.349.771/0001-63", documentNumber: "AH-12004/01", dueDate: "2026-10-15", faceAmount: 184500, acquisitionMonthlyRate: 1.85, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260801005 · Borderô 0003316", status: "Em aberto" },
  { id: "car-ah-002", cedentDocument: "08.411.620/0001-44", debtorName: "Atacado Boa Mesa Ltda", debtorDocument: "61.204.937/0001-09", documentNumber: "AH-12028/02", dueDate: "2026-11-12", faceAmount: 96800, acquisitionMonthlyRate: 1.95, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260822002 · Borderô 0003368", status: "Em aberto" },
  { id: "car-ns-001", cedentDocument: "33.907.118/0001-62", debtorName: "Mercado Serra Azul Ltda", debtorDocument: "16.991.428/0001-70", documentNumber: "NS-3340/01", dueDate: "2026-09-20", faceAmount: 6800, acquisitionMonthlyRate: 2.75, acquisitionMethod: "Mista", acquisitionReference: "Aditivo 20260709002 · Borderô 0003238", status: "Em aberto" },
  { id: "car-ns-002", cedentDocument: "33.907.118/0001-62", debtorName: "Comercial Norte Sul Ltda", debtorDocument: "28.440.013/0001-22", documentNumber: "NS-3397/03", dueDate: "2026-10-30", faceAmount: 44750, acquisitionMonthlyRate: 2.6, acquisitionMethod: "Mista", acquisitionReference: "Aditivo 20260816001 · Borderô 0003351", status: "Em aberto" },
  { id: "car-rci-001", cedentDocument: "44.362.223/0001-74", debtorName: "Hospital Santa Helena S.A.", debtorDocument: "34.001.780/0001-15", documentNumber: "RCI-5518/01", dueDate: "2026-08-14", faceAmount: 112400, acquisitionMonthlyRate: 2.3, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260521003 · Borderô 0003122", status: "Em aberto" },
  { id: "car-rci-002", cedentDocument: "44.362.223/0001-74", debtorName: "Clínica São Lucas Ltda", debtorDocument: "09.832.117/0001-02", documentNumber: "RCI-5580/02", dueDate: "2026-09-02", faceAmount: 98100, acquisitionMonthlyRate: 2.4, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260618001 · Borderô 0003191", status: "Em aberto" },
  { id: "car-rci-003", cedentDocument: "44.362.223/0001-74", debtorName: "Centro Médico Primavera Ltda", debtorDocument: "40.733.298/0001-44", documentNumber: "RCI-5601/01", dueDate: "2026-09-18", faceAmount: 88100, acquisitionMonthlyRate: 2.25, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260704002 · Borderô 0003225", status: "Em aberto" },
  { id: "car-rci-004", cedentDocument: "44.362.223/0001-74", debtorName: "Laboratório Vida S.A.", debtorDocument: "11.620.948/0001-36", documentNumber: "RCI-5664/04", dueDate: "2026-10-19", faceAmount: 146900, acquisitionMonthlyRate: 2.15, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260815003 · Borderô 0003348", status: "Em aberto" },
  { id: "car-grp-mc-001", cedentDocument: "71.208.314/0001-09", groupOwnerDocument: "59.264.846/0001-81", portfolioOwnerName: "Mundo Presentes Distribuidora Ltda", debtorName: "Magazine Oeste Ltda", debtorDocument: "37.905.118/0001-22", documentNumber: "MP-2088/02", dueDate: "2026-09-08", faceAmount: 12800, acquisitionMonthlyRate: 2.55, acquisitionMethod: "Composta Mista", acquisitionReference: "Aditivo 20260719002 · Borderô 0003275", status: "Em aberto" },
  { id: "car-grp-gz-001", cedentDocument: "06.991.420/0001-31", groupOwnerDocument: "52.927.676/0001-29", portfolioOwnerName: "GZ Logística Integrada Ltda", debtorName: "Cooperativa Vale Verde", debtorDocument: "80.114.221/0001-63", documentNumber: "GZL-1092/01", dueDate: "2026-10-11", faceAmount: 28400, acquisitionMonthlyRate: 2.3, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260812004 · Borderô 0003343", status: "Em aberto" },
  { id: "car-grp-rci-001", cedentDocument: "29.101.875/0001-54", groupOwnerDocument: "44.362.223/0001-74", portfolioOwnerName: "Integra Serviços Hospitalares Ltda", debtorName: "Plano Saúde Regional S.A.", debtorDocument: "14.662.089/0001-80", documentNumber: "ISH-4901/03", dueDate: "2026-08-31", faceAmount: 76500, acquisitionMonthlyRate: 2.2, acquisitionMethod: "Efetiva", acquisitionReference: "Aditivo 20260602001 · Borderô 0003150", status: "Em aberto" },
];

export const cedentSettlementAdjustments: CedentSettlementAdjustment[] = [
  { id: "adj-mc-pend-01", cedentDocument: "59.264.846/0001-81", ownerName: "Mundo das Canecas Fantasia", kind: "Pendência", description: "Custas de cartório pendentes", reference: "PEN-2026-0184", amount: 860 },
  { id: "adj-mc-cred-01", cedentDocument: "59.264.846/0001-81", ownerName: "Mundo das Canecas Fantasia", kind: "Crédito", description: "Crédito de liquidação excedente", reference: "CRED-2026-0091", amount: 2450.75 },
  { id: "adj-mc-grp-01", cedentDocument: "71.208.314/0001-09", groupOwnerDocument: "59.264.846/0001-81", ownerName: "Mundo Presentes Distribuidora Ltda", kind: "Pendência", description: "Tarifa operacional não liquidada", reference: "PEN-2026-0202", amount: 540 },
  { id: "adj-gz-pend-01", cedentDocument: "52.927.676/0001-29", ownerName: "GZ Transportes Ltda", kind: "Pendência", description: "Despesa de cobrança em aberto", reference: "PEN-2026-0168", amount: 1180 },
  { id: "adj-gz-cred-01", cedentDocument: "52.927.676/0001-29", ownerName: "GZ Transportes Ltda", kind: "Crédito", description: "Saldo credor de conciliação", reference: "CRED-2026-0077", amount: 3690.4 },
  { id: "adj-rci-pend-01", cedentDocument: "44.362.223/0001-74", ownerName: "Rede Clínica Integra", kind: "Pendência", description: "Reembolso de consulta cadastral", reference: "PEN-2026-0199", amount: 1840 },
  { id: "adj-rci-cred-01", cedentDocument: "44.362.223/0001-74", ownerName: "Rede Clínica Integra", kind: "Crédito", description: "Crédito por pagamento em duplicidade", reference: "CRED-2026-0088", amount: 8120 },
];

export const stages: Stage[] = [
  { id: 1, short: "Entrada", title: "Entrada e pré-validação", description: "Recebíveis, documentos fiscais e duplicidade" },
  { id: 2, short: "Risco", title: "Risco e elegibilidade", description: "Cedente, sacados, histórico e decisões" },
  { id: 3, short: "Lastro", title: "Lastro e confirmação", description: "Evidências, amostra e confirmação do sacado" },
  { id: 4, short: "Preço", title: "Preço e estrutura", description: "Deságio, tarifas, retenções e condições" },
  { id: 5, short: "Aprovação", title: "Aprovação e formalização", description: "Alçadas, documentos e assinaturas" },
  { id: 6, short: "Liquidação", title: "Registro, pagamento e conciliação", description: "Registro do ativo, liberação e baixa" },
];

export const initialOperations: Operation[] = [
  {
    id: "op-3408", proposal: "#3408", aditivoNumber: "20260925004", borderoNumber: "0003408", institution: "FIDC", vehicle: "Lastro Prime FIDC · Classe Sênior",
    cedent: "GZ Transportes Ltda", document: "52.927.676/0001-29", amount: 354528.02, netAmount: 342184.77,
    titleCount: 36, stage: 2, status: "Em atenção", owner: "Marina Alves", ownerInitials: "MA",
    enteredAt: "Hoje, 09:42", waitingFor: "12 min", elapsedMinutes: 12, clientAverageMinutes: 58, historySample: 42, risk: "Médio", automation: 78,
    blockers: 1, alerts: 2, nextAction: "Revisar concentração do maior sacado", policy: "FIDC Mercantil v4.2",
    fundClass: "Classe Sênior · Subclasse A", participants: ["Gestora Atlas", "Adm. Fiduciário Orbe", "Custodiante Nexus"],
    source: "XML NF-e", operationType: "Duplicata mercantil com NF-e", manualEntry: { receivableType: "Duplicata", mode: "individual", entries: [
      { id: "risk-3408-1", documentNumber: "NF-98341/01", amount: 118176, discount: 3820, issueDate: "2026-09-20", dueDate: "2026-10-10", debtorId: "sacado-1", debtorName: "L.V. Carvalho Gutierrez Ltda", debtorDocument: "44.659.901/0001-65", nfeKey: "41260952927676000129550010000983411002468102", ourNumber: "9834101", cfop: "5102", observation: "Entrega confirmada" },
      { id: "risk-3408-2", documentNumber: "NF-77125/02", amount: 104352.02, discount: 3510.4, issueDate: "2026-09-18", dueDate: "2026-10-30", debtorId: "sacado-2", debtorName: "Carlos Marco Distribuidora Ltda", debtorDocument: "07.583.481/0001-54", nfeKey: "41260952927676000129550010000771251003157244", ourNumber: "7712502", cfop: "6102", observation: "Monitoramento cadastral reforçado" },
      { id: "risk-3408-3", documentNumber: "NF-66420/01", amount: 132000, discount: 4650.85, issueDate: "2026-09-22", dueDate: "2026-11-15", debtorId: "sacado-3", debtorName: "Supermercado Haag Ltda", debtorDocument: "75.846.394/0001-00", nfeKey: "", ourNumber: "6642001", cfop: "5949", observation: "Chave NF-e aguardando retorno da integração" },
    ] },
  },
  {
    id: "op-3407", proposal: "#3407", aditivoNumber: "20260925003", borderoNumber: "0003407", institution: "Securitizadora", vehicle: "Órbita Securitizadora S.A.",
    cedent: "Mundo das Canecas Fantasia", document: "59.264.846/0001-81", amount: 100000, netAmount: 96540,
    titleCount: 8, stage: 4, status: "Pronta para formalizar", owner: "Rafael Costa", ownerInitials: "RC",
    enteredAt: "Hoje, 08:16", waitingFor: "1h 38min", elapsedMinutes: 98, clientAverageMinutes: 125, historySample: 31, risk: "Baixo", automation: 91,
    blockers: 0, alerts: 0, nextAction: "Revisar pacote e enviar para assinatura", policy: "Comercial Padrão v3.8",
    source: "XML NF-e", operationType: "Duplicata mercantil com NF-e", manualEntry: { receivableType: "Duplicata", mode: "individual", entries: [
      { id: "price-3407-1", documentNumber: "NF-4418/01", amount: 15469.25, discount: 0, issueDate: "2026-09-12", dueDate: "2026-10-12", debtorId: "sacado-1", debtorName: "Empório Central Ltda", debtorDocument: "31.998.442/0001-07", nfeKey: "41260959264846000181550010000441811002110204", ourNumber: "441801", cfop: "5102", observation: "Título aprovado no risco e validado no lastro" },
      { id: "price-3407-2", documentNumber: "NF-4421/01", amount: 12500, discount: 0, issueDate: "2026-09-14", dueDate: "2026-10-20", debtorId: "sacado-2", debtorName: "Presentes Sul Comércio Ltda", debtorDocument: "18.443.120/0001-52", nfeKey: "41260959264846000181550010000442111002111489", ourNumber: "442101", cfop: "5102", observation: "Entrega confirmada" },
      { id: "price-3407-3", documentNumber: "NF-4430/02", amount: 9800, discount: 0, issueDate: "2026-09-15", dueDate: "2026-10-28", debtorId: "sacado-3", debtorName: "Comercial Oeste Ltda", debtorDocument: "25.410.398/0001-20", nfeKey: "41260959264846000181550010000443021002112610", ourNumber: "443002", cfop: "6102", observation: "Confirmação automática concluída" },
      { id: "price-3407-4", documentNumber: "NF-4438/01", amount: 17800, discount: 0, issueDate: "2026-09-16", dueDate: "2026-11-05", debtorId: "sacado-1", debtorName: "Empório Central Ltda", debtorDocument: "31.998.442/0001-07", nfeKey: "41260959264846000181550010000443811002113871", ourNumber: "443801", cfop: "5102", observation: "Título aprovado" },
      { id: "price-3407-5", documentNumber: "NF-4442/01", amount: 11230.75, discount: 0, issueDate: "2026-09-18", dueDate: "2026-11-12", debtorId: "sacado-2", debtorName: "Presentes Sul Comércio Ltda", debtorDocument: "18.443.120/0001-52", nfeKey: "41260959264846000181550010000444211002114054", ourNumber: "444201", cfop: "5102", observation: "Título aprovado" },
      { id: "price-3407-6", documentNumber: "NF-4450/01", amount: 8300, discount: 0, issueDate: "2026-09-19", dueDate: "2026-11-18", debtorId: "sacado-3", debtorName: "Comercial Oeste Ltda", debtorDocument: "25.410.398/0001-20", nfeKey: "41260959264846000181550010000445011002115227", ourNumber: "445001", cfop: "6102", observation: "Título aprovado" },
      { id: "price-3407-7", documentNumber: "NF-4456/02", amount: 14000, discount: 0, issueDate: "2026-09-20", dueDate: "2026-11-25", debtorId: "sacado-1", debtorName: "Empório Central Ltda", debtorDocument: "31.998.442/0001-07", nfeKey: "41260959264846000181550010000445621002116462", ourNumber: "445602", cfop: "5102", observation: "Título aprovado" },
      { id: "price-3407-8", documentNumber: "NF-4461/01", amount: 10900, discount: 0, issueDate: "2026-09-21", dueDate: "2026-12-02", debtorId: "sacado-2", debtorName: "Presentes Sul Comércio Ltda", debtorDocument: "18.443.120/0001-52", nfeKey: "41260959264846000181550010000446111002117603", ourNumber: "446101", cfop: "5102", observation: "Título aprovado" },
    ] }, riskReview: {
      cedentDecision: "Aprovado",
      debtorDecisions: { "sacado-1": "Aprovado", "sacado-2": "Aprovado", "sacado-3": "Aprovado" },
      titleDecisions: { "price-3407-1": "Aprovado", "price-3407-2": "Aprovado", "price-3407-3": "Aprovado", "price-3407-4": "Aprovado", "price-3407-5": "Aprovado", "price-3407-6": "Aprovado", "price-3407-7": "Aprovado", "price-3407-8": "Aprovado" },
      audit: [{ entity: "operacao", decision: "Aprovado", by: "Henrique", at: "25/09/2026, 08:42", policy: "Comercial Padrão v3.8" }],
    }, lastroReview: { items: {
      "price-3407-1": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Sacado", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, confirmationNotes: "Entrega e vencimento confirmados com o contas a pagar.", updatedAt: "25/09/2026, 09:02", updatedBy: "Henrique" },
      "price-3407-2": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Nota", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, confirmationNotes: "Confirmação da NF-e registrada.", updatedAt: "25/09/2026, 09:05", updatedBy: "Henrique" },
      "price-3407-3": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Nota", contactAttempts: 0, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, confirmationNotes: "Confirmação automática pela integração.", updatedAt: "25/09/2026, 09:06", updatedBy: "Motor de regras" },
      "price-3407-4": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Sacado", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, updatedAt: "25/09/2026, 09:02", updatedBy: "Henrique" },
      "price-3407-5": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Nota", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, updatedAt: "25/09/2026, 09:05", updatedBy: "Henrique" },
      "price-3407-6": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Nota", contactAttempts: 0, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, updatedAt: "25/09/2026, 09:06", updatedBy: "Motor de regras" },
      "price-3407-7": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Sacado", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, updatedAt: "25/09/2026, 09:02", updatedBy: "Henrique" },
      "price-3407-8": { evidenceDecision: "Validada", confirmation: "Confirmado", confirmationScope: "Nota", contactAttempts: 1, checklist: { identityConfirmed: true, deliveryConfirmed: true, amountAndDueDateConfirmed: true, noDisputeReported: true }, updatedAt: "25/09/2026, 09:05", updatedBy: "Henrique" },
    } },
  },
  {
    id: "op-3406", proposal: "#3406", aditivoNumber: "20260924002", borderoNumber: "0003406", institution: "Factoring", vehicle: "Lastro Fomento Mercantil",
    cedent: "Metalúrgica Vale do Aço Ltda", document: "12.482.991/0001-08", amount: 198410.61, netAmount: 190884.35,
    titleCount: 14, stage: 3, status: "Em andamento", owner: "Você", ownerInitials: "HF",
    enteredAt: "Ontem, 16:54", waitingFor: "18h", elapsedMinutes: 1080, clientAverageMinutes: 720, historySample: 18, risk: "Médio", automation: 64,
    blockers: 0, alerts: 3, nextAction: "Confirmar amostra com 3 sacados", policy: "Fomento com regresso v2.6",
  },
  {
    id: "op-3405", proposal: "#3405", aditivoNumber: "20260924001", borderoNumber: "0003405", institution: "FIDC", vehicle: "Aurora Recebíveis FIDC · Classe Única",
    cedent: "Alimentos Horizonte S.A.", document: "08.411.620/0001-44", amount: 812450, netAmount: 786934.22,
    titleCount: 72, stage: 6, status: "Pronta para liberar", owner: "Camila Nunes", ownerInitials: "CN",
    enteredAt: "Ontem, 14:21", waitingFor: "21h", elapsedMinutes: 1260, clientAverageMinutes: 1320, historySample: 57, risk: "Baixo", automation: 96,
    blockers: 0, alerts: 0, nextAction: "Autorizar pagamento e registro", policy: "FIDC Diversificado v5.1",
    fundClass: "Classe Única", participants: ["Gestora Aurora", "Banco Administrador", "CSD Registradora"],
  },
  {
    id: "op-3404", proposal: "#3404", aditivoNumber: "20260925002", borderoNumber: "0003404", institution: "Securitizadora", vehicle: "Órbita Securitizadora S.A.",
    cedent: "Distribuidora Nova Serra", document: "33.907.118/0001-62", amount: 267900, netAmount: 256391.12,
    titleCount: 21, stage: 1, status: "Em andamento", owner: "Você", ownerInitials: "HF",
    enteredAt: "Hoje, 10:03", waitingFor: "4 min", elapsedMinutes: 4, clientAverageMinutes: 35, historySample: 24, risk: "Baixo", automation: 45,
    blockers: 0, alerts: 1, nextAction: "Conferir 2 documentos sem chave", policy: "Comercial Padrão v3.8",
  },
  {
    id: "op-3403", proposal: "#3403", aditivoNumber: "20260925001", borderoNumber: "0003403", institution: "FIDC", vehicle: "Lastro Prime FIDC · Classe Sênior",
    cedent: "Rede Clínica Integra", document: "44.362.223/0001-74", amount: 4686400, netAmount: 4532058.90,
    titleCount: 118, stage: 2, status: "Em atenção", owner: "Beatriz Lima", ownerInitials: "BL",
    enteredAt: "Ontem, 11:08", waitingFor: "23h", elapsedMinutes: 1380, clientAverageMinutes: 720, historySample: 12, risk: "Alto", automation: 52,
    blockers: 2, alerts: 4, nextAction: "Deliberar exceção de concentração", policy: "FIDC Saúde v1.9",
    fundClass: "Classe Sênior · Subclasse B", participants: ["Gestora Atlas", "Adm. Fiduciário Orbe", "Custodiante Nexus"],
  },
];

export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const preciseMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
