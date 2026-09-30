// Financeiro e contábil: tipos, plano de contas modelo, categorias gerenciais e dados de demonstração.
// Regra central: todo fato gera um título (a pagar/receber) ou um evento do sistema; o título gera o
// lançamento de competência; a baixa gera o movimento bancário e o lançamento de caixa. Nada é apagado:
// excluir cancela com estorno e estornar lança a contrapartida.

export type AccountNature = "Ativo" | "Passivo" | "Patrimônio líquido" | "Receita" | "Despesa";

export type ChartAccount = {
  code: string;
  name: string;
  nature: AccountNature;
  analytic: boolean;
  shortCode?: string;
  referential?: string;
};

/* Contas-chave: papéis que os lançamentos automáticos usam. O motor nunca usa um código fixo; ele pergunta
   ao estado qual conta cumpre cada papel. Assim o cliente pode importar o próprio plano e só apontar o de-para. */
export type LedgerRole =
  | "capital"
  | "payables"
  | "receivables"
  | "recover"
  | "refund"
  | "acquired"
  | "assignorsPayable"
  | "retentions"
  | "deferredDiscount"
  | "feeRevenue"
  | "interestReceived"
  | "discountsObtained"
  | "interestPaid"
  | "discountsGranted"
  | "bankGroup";

export const ledgerRoles: {
  key: LedgerRole;
  label: string;
  nature: AccountNature;
  analytic: boolean;
  code: string;
  use: string;
}[] = [
  {
    key: "bankGroup",
    label: "Grupo das contas bancárias",
    nature: "Ativo",
    analytic: false,
    code: "1.1.1",
    use: "Novas contas bancárias viram subcontas deste grupo",
  },
  {
    key: "acquired",
    label: "Títulos adquiridos a vencer",
    nature: "Ativo",
    analytic: true,
    code: "1.1.2.01",
    use: "Débito na compra de recebíveis",
  },
  {
    key: "receivables",
    label: "Contas a receber (padrão)",
    nature: "Ativo",
    analytic: true,
    code: "1.1.3.01",
    use: "Lançamentos a receber sem conta própria",
  },
  {
    key: "recover",
    label: "Valores a recuperar",
    nature: "Ativo",
    analytic: true,
    code: "1.1.3.02",
    use: "Estorno de pagamento já pago e saída não identificada",
  },
  {
    key: "payables",
    label: "Contas a pagar (padrão)",
    nature: "Passivo",
    analytic: true,
    code: "2.1.1",
    use: "Lançamentos a pagar sem conta própria",
  },
  {
    key: "assignorsPayable",
    label: "Cedentes a pagar (liberações)",
    nature: "Passivo",
    analytic: true,
    code: "2.1.2",
    use: "Crédito na compra; baixa na liberação",
  },
  {
    key: "retentions",
    label: "Retenções de cedentes",
    nature: "Passivo",
    analytic: true,
    code: "2.1.3",
    use: "Retenções e compensações da operação",
  },
  {
    key: "deferredDiscount",
    label: "Deságio a apropriar",
    nature: "Passivo",
    analytic: true,
    code: "2.1.5.01",
    use: "Deságio da compra até a apropriação",
  },
  {
    key: "refund",
    label: "Créditos a identificar / a devolver",
    nature: "Passivo",
    analytic: true,
    code: "2.1.6",
    use: "Estorno de recebimento e entrada não identificada",
  },
  {
    key: "capital",
    label: "Contrapartida do saldo de abertura",
    nature: "Patrimônio líquido",
    analytic: true,
    code: "3.1",
    use: "Saldo inicial das contas bancárias",
  },
  {
    key: "feeRevenue",
    label: "Receita de tarifas e ad valorem",
    nature: "Receita",
    analytic: true,
    code: "4.1.02",
    use: "Tarifas cobradas na operação",
  },
  {
    key: "interestReceived",
    label: "Juros e mora recebidos",
    nature: "Receita",
    analytic: true,
    code: "4.1.03",
    use: "Juros informados na baixa de recebimento",
  },
  {
    key: "discountsObtained",
    label: "Descontos obtidos",
    nature: "Receita",
    analytic: true,
    code: "4.1.05",
    use: "Desconto informado na baixa de pagamento",
  },
  {
    key: "interestPaid",
    label: "Juros e multas pagos",
    nature: "Despesa",
    analytic: true,
    code: "5.1.10",
    use: "Juros informados na baixa de pagamento",
  },
  {
    key: "discountsGranted",
    label: "Descontos concedidos",
    nature: "Despesa",
    analytic: true,
    code: "5.1.11",
    use: "Desconto informado na baixa de recebimento",
  },
];

export type ChartImportLog = {
  at: string;
  by: string;
  file: string;
  mode: "substituir" | "acrescentar";
  accounts: number;
  reclassified: number;
};

export type BankAccountType =
  "Conta movimento" | "Conta cobrança" | "Conta vinculada (escrow)" | "Aplicação automática" | "Caixa interno";

export type CompanyBankAccount = {
  id: string;
  company: string; // empresa ou veículo dono da conta
  bankCode: string;
  bankName: string;
  agency: string;
  account: string;
  type: BankAccountType;
  nickname: string;
  usage: { payments: boolean; receipts: boolean; collection: boolean };
  pixKey?: string;
  collection?: { agreement: string; wallet: string; layout: "CNAB 240" | "CNAB 400"; nextOurNumber: number };
  openingBalance: number;
  openingDate: string;
  minimumBalance: number;
  ledgerCode: string; // conta contábil analítica do banco
  active: boolean;
};

export type Category = { id: string; name: string; kind: "Receita" | "Despesa"; ledgerCode: string; group: string };

export type HistoryEntry = { at: string; by: string; action: string; detail: string };

export type TitleOrigin =
  "Manual" | "Liberação de operação" | "Recuperação de pagamento" | "Devolução de recebimento" | "Recorrente";

export type FinanceTitle = {
  id: string;
  kind: "Pagar" | "Receber";
  origin: TitleOrigin;
  description: string;
  counterparty: string;
  counterpartyDocument?: string;
  categoryId?: string;
  company: string;
  competenceDate: string;
  dueDate: string;
  amount: number;
  settlementLedger: string; // conta de passivo (a pagar) ou ativo (a receber) que a baixa movimenta
  status: "Em aberto" | "Baixado" | "Cancelado";
  settledAt?: string;
  settledAccountId?: string;
  method?: string;
  movementId?: string;
  competenceEntryId?: string;
  operationId?: string;
  payableId?: string;
  linkedTitleId?: string;
  history: HistoryEntry[];
};

export type Movement = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number; // positivo = entrada, negativo = saída
  kind: "Entrada" | "Saída" | "Transferência" | "Estorno";
  titleId?: string;
  reversalOf?: string;
  reversedBy?: string;
  reconciled: boolean;
  entryId?: string;
  matchGroup?: string;
  history: HistoryEntry[];
};

export type StatementLine = {
  id: string;
  accountId: string;
  fitid: string;
  date: string;
  amount: number;
  memo: string;
  status: "Pendente" | "Conciliado";
  matchGroup?: string;
  file: string;
  importedAt: string;
  importedBy: string;
};

export type JournalLine = { ledger: string; debit: number; credit: number; originalLedger?: string }; // originalLedger: conta antes da troca de plano

export type JournalEntry = {
  id: string;
  date: string;
  company: string;
  history: string;
  lines: JournalLine[];
  origin: { type: "Título" | "Movimento" | "Operação" | "Abertura" | "Transferência"; id: string };
  reversalOf?: string;
  reversedBy?: string;
  createdAt: string;
  createdBy: string;
};

export type CollectionRegistration = { sentAt: string; confirmedAt?: string; titles: number; account: string };

export type FinanceState = {
  version: 1;
  accounts: CompanyBankAccount[];
  chart: ChartAccount[];
  categories: Category[];
  titles: FinanceTitle[];
  movements: Movement[];
  journal: JournalEntry[];
  registrations: Record<string, CollectionRegistration>;
  purchasePosted: Record<string, string>; // operationId → lançamento contábil da compra
  statement: StatementLine[]; // linhas importadas do extrato bancário (OFX)
  roles?: Partial<Record<LedgerRole, string>>; // de-para das contas-chave (ausente = plano modelo)
  chartOrigin?: "modelo" | "importado";
  chartImports?: ChartImportLog[];
  seq: number;
};

export const modelChart: ChartAccount[] = [
  { code: "1", name: "ATIVO", nature: "Ativo", analytic: false },
  { code: "1.1", name: "Ativo circulante", nature: "Ativo", analytic: false },
  { code: "1.1.1", name: "Disponibilidades", nature: "Ativo", analytic: false },
  { code: "1.1.1.01", name: "Caixa", nature: "Ativo", analytic: true },
  { code: "1.1.2", name: "Direitos creditórios adquiridos", nature: "Ativo", analytic: false },
  { code: "1.1.2.01", name: "Títulos adquiridos a vencer", nature: "Ativo", analytic: true },
  { code: "1.1.2.02", name: "Títulos adquiridos vencidos", nature: "Ativo", analytic: true },
  { code: "1.1.3", name: "Créditos diversos", nature: "Ativo", analytic: false },
  { code: "1.1.3.01", name: "Clientes a receber", nature: "Ativo", analytic: true },
  { code: "1.1.3.02", name: "Valores a recuperar de cedentes e terceiros", nature: "Ativo", analytic: true },
  { code: "1.1.3.03", name: "Adiantamentos", nature: "Ativo", analytic: true },
  { code: "2", name: "PASSIVO", nature: "Passivo", analytic: false },
  { code: "2.1", name: "Passivo circulante", nature: "Passivo", analytic: false },
  { code: "2.1.1", name: "Fornecedores a pagar", nature: "Passivo", analytic: true },
  { code: "2.1.2", name: "Cedentes a pagar (liberações)", nature: "Passivo", analytic: true },
  { code: "2.1.3", name: "Retenções e compensações de cedentes", nature: "Passivo", analytic: true },
  { code: "2.1.4", name: "Tributos a recolher", nature: "Passivo", analytic: false },
  { code: "2.1.4.01", name: "IOF a recolher", nature: "Passivo", analytic: true },
  { code: "2.1.4.02", name: "PIS e COFINS a recolher", nature: "Passivo", analytic: true },
  { code: "2.1.4.03", name: "ISS a recolher", nature: "Passivo", analytic: true },
  { code: "2.1.5", name: "Receitas a apropriar", nature: "Passivo", analytic: false },
  { code: "2.1.5.01", name: "Deságio a apropriar", nature: "Passivo", analytic: true },
  { code: "2.1.6", name: "Créditos a identificar e valores a devolver", nature: "Passivo", analytic: true },
  { code: "2.1.7", name: "Salários e encargos a pagar", nature: "Passivo", analytic: true },
  { code: "3", name: "PATRIMÔNIO LÍQUIDO", nature: "Patrimônio líquido", analytic: false },
  { code: "3.1", name: "Capital social", nature: "Patrimônio líquido", analytic: true },
  { code: "3.2", name: "Lucros ou prejuízos acumulados", nature: "Patrimônio líquido", analytic: true },
  { code: "4", name: "RECEITAS", nature: "Receita", analytic: false },
  { code: "4.1.01", name: "Receita de deságio", nature: "Receita", analytic: true },
  { code: "4.1.02", name: "Receita de tarifas e ad valorem", nature: "Receita", analytic: true },
  { code: "4.1.03", name: "Juros e mora recebidos", nature: "Receita", analytic: true },
  { code: "4.1.04", name: "Receitas financeiras", nature: "Receita", analytic: true },
  { code: "4.1.05", name: "Descontos obtidos", nature: "Receita", analytic: true },
  { code: "5", name: "DESPESAS", nature: "Despesa", analytic: false },
  { code: "5.1.01", name: "Pessoal e encargos", nature: "Despesa", analytic: true },
  { code: "5.1.02", name: "Aluguel e condomínio", nature: "Despesa", analytic: true },
  { code: "5.1.03", name: "Sistemas e tecnologia", nature: "Despesa", analytic: true },
  { code: "5.1.04", name: "Serviços de terceiros", nature: "Despesa", analytic: true },
  { code: "5.1.05", name: "Tarifas bancárias", nature: "Despesa", analytic: true },
  { code: "5.1.06", name: "Cartório e cobrança", nature: "Despesa", analytic: true },
  { code: "5.1.07", name: "Tributos sobre receitas", nature: "Despesa", analytic: true },
  { code: "5.1.08", name: "Despesas gerais e administrativas", nature: "Despesa", analytic: true },
  { code: "5.1.09", name: "Perdas com recebíveis", nature: "Despesa", analytic: true },
  { code: "5.1.10", name: "Juros e multas pagos", nature: "Despesa", analytic: true },
  { code: "5.1.11", name: "Descontos concedidos", nature: "Despesa", analytic: true },
];

export const modelCategories: Category[] = [
  {
    id: "cat-desagio",
    name: "Receita de deságio",
    kind: "Receita",
    ledgerCode: "4.1.01",
    group: "Receitas operacionais",
  },
  {
    id: "cat-tarifas",
    name: "Tarifas e ad valorem",
    kind: "Receita",
    ledgerCode: "4.1.02",
    group: "Receitas operacionais",
  },
  { id: "cat-mora", name: "Juros e mora", kind: "Receita", ledgerCode: "4.1.03", group: "Receitas operacionais" },
  {
    id: "cat-financeira",
    name: "Rendimentos de aplicação",
    kind: "Receita",
    ledgerCode: "4.1.04",
    group: "Receitas financeiras",
  },
  { id: "cat-pessoal", name: "Folha e encargos", kind: "Despesa", ledgerCode: "5.1.01", group: "Pessoal" },
  { id: "cat-aluguel", name: "Aluguel e condomínio", kind: "Despesa", ledgerCode: "5.1.02", group: "Estrutura" },
  { id: "cat-sistemas", name: "Sistemas e tecnologia", kind: "Despesa", ledgerCode: "5.1.03", group: "Estrutura" },
  { id: "cat-terceiros", name: "Serviços de terceiros", kind: "Despesa", ledgerCode: "5.1.04", group: "Serviços" },
  { id: "cat-tarifa-banco", name: "Tarifas bancárias", kind: "Despesa", ledgerCode: "5.1.05", group: "Financeiras" },
  { id: "cat-cartorio", name: "Cartório e cobrança", kind: "Despesa", ledgerCode: "5.1.06", group: "Cobrança" },
  { id: "cat-tributos", name: "Tributos sobre receitas", kind: "Despesa", ledgerCode: "5.1.07", group: "Tributos" },
  { id: "cat-gerais", name: "Despesas gerais", kind: "Despesa", ledgerCode: "5.1.08", group: "Estrutura" },
];

export const bankList = [
  ["001", "Banco do Brasil"],
  ["033", "Santander"],
  ["104", "Caixa Econômica"],
  ["208", "BTG Pactual"],
  ["237", "Bradesco"],
  ["260", "Nu Pagamentos"],
  ["341", "Itaú Unibanco"],
  ["422", "Safra"],
  ["748", "Sicredi"],
  ["756", "Sicoob"],
] as const;

export const seedAccounts = (openingDate: string): CompanyBankAccount[] => [
  {
    id: "cb-1",
    company: "Lastro Fomento Mercantil",
    bankCode: "341",
    bankName: "Itaú Unibanco",
    agency: "0350",
    account: "44120-3",
    type: "Conta movimento",
    nickname: "Itaú movimento",
    usage: { payments: true, receipts: true, collection: false },
    pixKey: "financeiro@lastrofomento.com.br",
    openingBalance: 1_180_000,
    openingDate,
    minimumBalance: 300_000,
    ledgerCode: "1.1.1.02",
    active: true,
  },
  {
    id: "cb-2",
    company: "Lastro Fomento Mercantil",
    bankCode: "748",
    bankName: "Sicredi",
    agency: "0725",
    account: "88310-4",
    type: "Conta cobrança",
    nickname: "Sicredi cobrança",
    usage: { payments: false, receipts: true, collection: true },
    collection: { agreement: "17820", wallet: "1", layout: "CNAB 240", nextOurNumber: 104_320 },
    openingBalance: 142_000,
    openingDate,
    minimumBalance: 0,
    ledgerCode: "1.1.1.03",
    active: true,
  },
  {
    id: "cb-3",
    company: "Órbita Securitizadora S.A.",
    bankCode: "237",
    bankName: "Bradesco",
    agency: "0421",
    account: "90418-2",
    type: "Conta movimento",
    nickname: "Bradesco movimento",
    usage: { payments: true, receipts: true, collection: true },
    collection: { agreement: "402118", wallet: "09", layout: "CNAB 400", nextOurNumber: 55_021 },
    openingBalance: 780_000,
    openingDate,
    minimumBalance: 200_000,
    ledgerCode: "1.1.1.04",
    active: true,
  },
  {
    id: "cb-4",
    company: "Lastro Prime FIDC · Classe Sênior",
    bankCode: "208",
    bankName: "BTG Pactual",
    agency: "0001",
    account: "551208-7",
    type: "Conta movimento",
    nickname: "BTG conta do fundo",
    usage: { payments: true, receipts: true, collection: true },
    collection: { agreement: "FIDC-0192", wallet: "112", layout: "CNAB 240", nextOurNumber: 9_812 },
    openingBalance: 1_020_000,
    openingDate,
    minimumBalance: 250_000,
    ledgerCode: "1.1.1.05",
    active: true,
  },
  {
    id: "cb-5",
    company: "Aurora Recebíveis FIDC · Classe Única",
    bankCode: "001",
    bankName: "Banco do Brasil",
    agency: "3120-1",
    account: "40022-8",
    type: "Conta movimento",
    nickname: "BB conta do fundo",
    usage: { payments: true, receipts: true, collection: true },
    collection: { agreement: "3120447", wallet: "17", layout: "CNAB 240", nextOurNumber: 70_115 },
    openingBalance: 1_310_000,
    openingDate,
    minimumBalance: 250_000,
    ledgerCode: "1.1.1.06",
    active: true,
  },
];

export const sortChart = (chart: ChartAccount[]) =>
  [...chart].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
export const bankLedgerName = (a: CompanyBankAccount) =>
  `Banco ${a.bankCode} ${a.bankName} · ${a.account} (${a.company.split(" ·")[0]})`;

/** Conta contábil que cumpre um papel dos lançamentos automáticos (de-para do plano importado ou o plano modelo). */
export function roleLedger(state: { roles?: Partial<Record<LedgerRole, string>> }, key: LedgerRole) {
  return state.roles?.[key] ?? ledgerRoles.find(r => r.key === key)!.code;
}

/** Próximo código filho de uma conta sintética, respeitando a largura usada pelos irmãos (1.1.1 → 1.1.1.07). */
export function nextChildCode(chart: ChartAccount[], parent: string, reserved: string[] = []) {
  const depth = parent.split(".").length + 1;
  const siblings = [...chart.map(c => c.code), ...reserved]
    .filter(c => c.startsWith(`${parent}.`) && c.split(".").length === depth)
    .map(c => c.split(".").pop()!);
  const width = Math.max(2, ...siblings.map(x => x.length));
  const next = Math.max(0, ...siblings.map(Number).filter(Number.isFinite)) + 1;
  return `${parent}.${String(next).padStart(width, "0")}`;
}

/** Garante que toda conta bancária tenha sua conta contábil no plano, sem refazer o plano. */
export function withBankLedgers(chart: ChartAccount[], accounts: CompanyBankAccount[]): ChartAccount[] {
  const missing = accounts
    .filter(a => a.ledgerCode && !chart.some(c => c.code === a.ledgerCode))
    .map(a => ({ code: a.ledgerCode, name: bankLedgerName(a), nature: "Ativo" as const, analytic: true }));
  return missing.length ? sortChart([...chart, ...missing]) : chart;
}

export function chartWithBanks(accounts: CompanyBankAccount[]): ChartAccount[] {
  const banks = accounts.map(a => ({
    code: a.ledgerCode,
    name: `Banco ${a.bankCode} ${a.bankName} · ${a.account} (${a.company.split(" ·")[0]})`,
    nature: "Ativo" as const,
    analytic: true,
  }));
  const base = modelChart.filter(c => !banks.some(b => b.code === c.code));
  return [...base, ...banks].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
}

export const nowStamp = () =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
