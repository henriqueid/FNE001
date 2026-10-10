import { type EligibilityReview } from "@/src/domain/eligibility/model";
import { type EnrichmentReview } from "@/src/domain/integrations/enrichment";

/**
 * Entidades centrais do domínio: operação, título (entrada manual), cedente, sacado, veículo e liberação.
 */
export type InstitutionType = "FIDC" | "Securitizadora" | "Factoring";

export type OperationSource = "XML NF-e" | "CNAB" | "Planilha" | "Digitação manual" | "Crédito estruturado";

export type OperationStatus =
  | "Em andamento"
  | "Aguardando terceiro"
  | "Em atenção"
  | "Pronta para formalizar"
  | "Pronta para liberar"
  | "Liberada ao financeiro"
  | "Cancelada";

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

export type EntryIntakeIssue = {
  id: string;
  severity: "ALERTA" | "BLOQUEIO";
  code: string;
  message: string;
  row?: number;
  field?: string;
};

export type EntryIntake = {
  id: string;
  source: OperationSource;
  fileName: string;
  fileHash: string;
  importedAt: string;
  format: "XML" | "CSV" | "CNAB" | "XLSX";
  status: "PRONTO" | "ATENCAO" | "BLOQUEADO";
  originalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  matchedDebtors: number;
  /** Sacados que não existiam na base e foram cadastrados automaticamente a partir do arquivo. */
  newDebtors?: Debtor[];
  issues: EntryIntakeIssue[];
};

export type BankAccount = {
  id: string;
  label: string;
  holder: string;
  document: string;
  bank: string;
  agency: string;
  account: string;
  pixKey?: string;
  balance?: number;
};

export type PaymentMethod = "PIX" | "TED" | "Crédito em conta-corrente";

export type ReleasePayee = {
  id: string;
  relation: "Cedente" | "Terceiro";
  name: string;
  document: string;
  method: PaymentMethod;
  accountId?: string;
  bank?: string;
  agency?: string;
  account?: string;
  pixKey?: string;
  amount: number;
  justification?: string;
};

export type ReleasePayable = {
  id: string;
  payee: string;
  document: string;
  method: PaymentMethod;
  destination: string;
  amount: number;
  dueDate: string;
  payingAccount: string;
  status: "Pendente de pagamento" | "Pago" | "Cancelado";
  createdAt: string;
  paidAt?: string;
};

export type ReleaseReview = {
  status: "Em preparação" | "Enviada ao financeiro";
  payingAccountId?: string;
  balanceCheckedAt?: string;
  paymentDate?: string;
  observation?: string;
  payees?: ReleasePayee[];
  payables?: ReleasePayable[];
  releasedAt?: string;
  releasedBy?: string;
  audit?: { at: string; by: string; action: string; detail: string }[];
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
  /** Importações podem criar uma identidade mínima até a complementação cadastral. */
  registrationStatus?: "Completo" | "Provisório";
  /** Score de qualidade interno (0–1000), calculado pela política de qualidade. Vazio = sacado novo. */
  score?: number;
  /** Score do bureau externo (Serasa, Boa Vista…), 0–1000. Entra no score interno como um componente. */
  bureauScore?: number;
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
  /** Score de qualidade interno (0–1000), calculado pela política de qualidade; 0 = conta nova. */
  score: number;
  /** Score do bureau externo (Serasa, Boa Vista…), 0–1000. Entra no score interno como um componente. */
  bureauScore?: number;
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
  /** Instante técnico da entrada, usado para medir o ciclo até a disponibilização. */
  receivedAtIso?: string;
  waitingFor: string;
  elapsedMinutes: number;
  clientAverageMinutes: number;
  historySample: number;
  risk: "Baixo" | "Médio" | "Alto";
  /** Comercial responsável pelo cliente na data da operação (vínculo do cadastro). */
  commercialRepId?: string;
  /** Gerente da conta responsável pela operação e pelo pós-venda. */
  accountManagerId?: string;
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
  /** Lote que originou os títulos importados, com hash, contagens e inconsistências. */
  entryIntake?: EntryIntake;
  /** Fotografia das fontes internas e externas usadas para enriquecer esta operação. */
  enrichmentReview?: EnrichmentReview;
  /** Execução congelada do motor e decisões humanas posteriores, preservadas para auditoria. */
  eligibilityReview?: EligibilityReview;
  riskReview?: {
    cedentDecision?: "Aprovado" | "Reprovado";
    debtorDecisions?: Record<string, "Aprovado" | "Reprovado">;
    titleDecisions?: Record<string, "Aprovado" | "Reprovado">;
    audit?: { entity: string; decision: "Aprovado" | "Reprovado"; by: string; at: string; policy: string }[];
  };
  lastroReview?: {
    items?: Record<
      string,
      {
        evidenceDecision?: "Validada" | "Pendente" | "Divergente";
        confirmation?:
          | "Pendente"
          | "Contato iniciado"
          | "Sem contato"
          | "Confirmado"
          | "Confirmado com ressalva"
          | "Não confirmado"
          | "Não confirma para terceiros"
          | "Recusado"
          | "Telefone inválido";
        attachmentName?: string;
        attachmentNotes?: string;
        confirmationNotes?: string;
        confirmationScope?: "Nota" | "Sacado";
        nextContactAt?: string;
        divergenceReason?:
          | "Documento ausente"
          | "Valor divergente"
          | "Vencimento divergente"
          | "Mercadoria ou serviço não reconhecido"
          | "Duplicidade"
          | "Documento inválido"
          | "Outro";
        contactAttempts?: number;
        attempts?: {
          channel: "Ligação" | "WhatsApp";
          result:
            | "Contato iniciado"
            | "Sem contato"
            | "Confirmado"
            | "Confirmado com ressalva"
            | "Não confirmado"
            | "Não confirma para terceiros"
            | "Recusado"
            | "Telefone inválido";
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
      }
    >;
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
    repurchaseTerms?: Record<
      string,
      {
        rateOverride?: number;
        lateInterestMonthly: number;
        penaltyPercent: number;
        action?: "Recompra" | "Baixar do banco" | "Baixar somente do sistema" | "Recompra parcial";
        partialAmount?: number;
      }
    >;
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
  releaseReview?: ReleaseReview;
  approvalReview?: {
    status: "Preparação" | "Em aprovação" | "Aprovada" | "Reprovada" | "Em formalização";
    submittedAt?: string;
    submittedBy?: string;
    observation?: string;
    finalDecision?: {
      outcome: "APROVADA" | "DEVOLVIDA" | "REPROVADA";
      decidedAt: string;
      decidedBy: string;
      justification: string;
    };
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
      method?: "Eletrônica" | "Manual";
      manualReason?: string;
      manualSignedDate?: string;
      attachmentName?: string;
      registeredBy?: string;
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
