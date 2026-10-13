/**
 * Tipos do Comercial: comerciais, vínculos de clientes, negócios, visitas, comitês, funil e comissões.
 */
export type RepKind = "CLT" | "Agente autônomo";

export type SalesRep = {
  id: string;
  name: string;
  initials: string;
  role: string;
  kind: RepKind;
  region: string;
  email: string;
  phone: string;
  document: string;
  company: string;
  monthlyGoal: number;
  flatRate?: number;
  active: boolean;
  since: string;
};

/** Gerentes de conta cuidam da operação recorrente e do pós-venda da carteira. */
export const isAccountManager = (rep: SalesRep) => rep.role.toLocaleLowerCase("pt-BR").includes("gerente");

export type LinkOrigin =
  | "Prospecção ativa"
  | "Indicação"
  | "Indicação interna"
  | "Inbound"
  | "Site / marketing"
  | "Evento"
  | "Parceiro / canal"
  | "Base própria"
  | "Reativação"
  | "Carteira transferida";

export type ClientLink = {
  id: string;
  clientName: string;
  document: string;
  repId: string;
  /** Responsável pelas operações recorrentes e pelo pós-venda da conta. */
  managerId?: string;
  since: string;
  origin: LinkOrigin;
  status: "Em onboarding" | "Ativo" | "Inativo";
  approvedLimit: number;
  segment: string;
  city: string;
  transfers: { from: string; to: string; at: string; by: string; reason: string }[];
};

export type Deal = {
  id: string;
  date: string;
  bordero: string;
  clientName: string;
  document: string;
  repId: string;
  vehicle: string;
  face: number;
  discount: number;
  fees: number;
  revenue: number;
  /** Valor líquido liberado na operação (VOP). */
  net?: number;
  rate: number;
  titles: number;
  repurchased?: number;
  operationId?: string;
  live?: boolean;
};

export type VisitKind = "Prospecção" | "Relacionamento" | "Renegociação" | "Pós-venda" | "Cobrança";

export type Visit = {
  id: string;
  date: string;
  time: string;
  repId: string;
  target: string;
  prospectId?: string;
  document?: string;
  kind: VisitKind;
  status: "Agendada" | "Realizada" | "Cancelada" | "Não realizada";
  address: string;
  notes?: string;
  outcome?: string;
  nextStep?: string;
};

export type CommitteeRequest =
  "Limite inicial" | "Aumento de limite" | "Taxa especial" | "Renovação de limite" | "Concentração de sacado";

export type CommitteeStatus = "Em pauta" | "Aprovado" | "Aprovado com ressalvas" | "Reprovado" | "Adiado";

export type Committee = {
  id: string;
  /** Originação inicial: a pauta nasce obrigatoriamente de um prospect no funil. */
  prospectId?: string;
  date: string;
  clientName: string;
  document?: string;
  repId: string;
  request: CommitteeRequest;
  requested: number;
  approved?: number;
  rate?: number;
  status: CommitteeStatus;
  commercialOpinion: string;
  riskOpinion?: string;
  conditions?: string;
  members: string[];
  decidedAt?: string;
  decidedBy?: string;
  history: { at: string; by: string; action: string; detail: string }[];
};

export type FunnelStage = "Lead" | "Visita" | "Proposta" | "Comitê" | "Aprovado";

export const funnelStages: FunnelStage[] = ["Lead", "Visita", "Proposta", "Comitê", "Aprovado"];

export type ProspectDocumentChecklist = {
  companyRegistration: boolean;
  partnerDocuments: boolean;
  financialStatements: boolean;
  receivablesSample: boolean;
  bankStatements: boolean;
};

export type ProspectDossier = {
  document: string;
  legalName: string;
  tradeName: string;
  segment: string;
  city: string;
  state: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  monthlyRevenue: number;
  requestedLimit: number;
  proposedRate: number;
  averageTermDays: number;
  receivableType: string;
  debtorCount: number;
  largestDebtorPercent: number;
  hasRestrictiveIssues: boolean;
  restrictiveIssues: string;
  commercialSummary: string;
  documents: ProspectDocumentChecklist;
  updatedAt: string;
};

export type ProspectHistoryEntry = {
  at: string;
  by: string;
  action: string;
  detail: string;
};

export type Prospect = {
  id: string;
  name: string;
  document?: string;
  repId: string;
  stage: FunnelStage;
  potential: number;
  createdAt: string;
  updatedAt: string;
  nextStep: string;
  source: LinkOrigin;
  lost?: string;
  dossier?: ProspectDossier;
  history?: ProspectHistoryEntry[];
  rejectedAt?: string;
  convertedAt?: string;
};

export type CommissionTier = { from: number; rate: number };

export type CommissionRules = {
  /** `volume` é mantido para compatibilidade e equivale a `originacao`. */
  base: "receita" | "volume" | "originacao" | "vop";
  tiers: CommissionTier[];
  newAccountBonus: number; // pago na competência da 1ª operação da conta nova
  newAccountWindow: number; // dias entre o vínculo e a 1ª operação para contar como conta nova ativada
  clawback: boolean; // estorna a comissão da parte recomprada
};

export type CommissionLine = {
  repId: string;
  base: number;
  goal: number;
  attainment: number;
  rate: number;
  commission: number;
  bonus: number;
  bonusAccounts: string[];
  clawback: number;
  total: number;
  deals: number;
};

export type CommissionClosing = {
  month: string;
  status: "Fechada" | "Enviada ao financeiro";
  closedAt: string;
  closedBy: string;
  lines: CommissionLine[];
  rules: CommissionRules;
  financeTitles?: string[];
  sentAt?: string;
};

export type CommercialState = {
  version: 1;
  persistenceVersion?: number;
  reps: SalesRep[];
  links: ClientLink[];
  deals: Deal[];
  visits: Visit[];
  committees: Committee[];
  prospects: Prospect[];
  rules: CommissionRules;
  closings: Record<string, CommissionClosing>;
  seq: number;
  /** Eventos vindos da Carteira (recompras), calculados a partir das operações; não são persistidos. */
  carteiraEvents?: CarteiraEvent[];
};

/** Evento da carteira que afeta o comercial: recompra de títulos de um cliente. */
export type CarteiraEvent = {
  kind: "Recompra";
  document: string;
  clientName: string;
  date: string;
  amount: number;
  reference: string;
  operationId?: string;
};

export type OpFinancials = Record<
  string,
  { face: number; discount: number; fees: number; revenue: number; rate: number; net: number }
>;

export type CResult = { state: CommercialState; error?: string; message?: string };
