/**
 * Cadastro único de pessoas (PF e PJ) com papéis.
 *
 * Uma pessoa é identificada pelo CPF/CNPJ e pode ter vários papéis ao mesmo tempo
 * (ex.: um cedente que também é sacado de outro cedente, ou um sócio que é avalista).
 * Cada papel tem a sua ficha em `roles`. Os demais módulos leem daqui por adaptadores:
 *   - cedente        -> Nova operação, Risco, Carteira e Comercial (via `partyToCedent`)
 *   - sacado         -> digitação de títulos e Risco (via `partyToDebtor`)
 *   - representante  -> Comercial, metas e comissões (via `partyToSalesRep`)
 *   - fornecedor e prestador -> favorecidos dos lançamentos a pagar do Financeiro
 *   - debenturista e cotista -> investidores dos veículos (securitizadora e FIDC)
 *
 * Nada é apagado: um cadastro é inativado com motivo e continua consultável.
 */
import type { Cedent, Debtor } from "@/src/domain/core/types";
import type { RepKind, SalesRep } from "@/src/domain/commercial/types";

export type PersonKind = "PJ" | "PF";

export type PartyRole =
  "cedente" | "sacado" | "fornecedor" | "representante" | "debenturista" | "cotista" | "avalista" | "prestador";

export const partyRoles: { id: PartyRole; label: string; plural: string; hint: string }[] = [
  { id: "cedente", label: "Cedente", plural: "Cedentes", hint: "Cede recebíveis nas operações" },
  { id: "sacado", label: "Sacado", plural: "Sacados", hint: "Devedor dos títulos adquiridos" },
  { id: "fornecedor", label: "Fornecedor", plural: "Fornecedores", hint: "Recebe pagamentos da empresa" },
  { id: "representante", label: "Representante", plural: "Representantes", hint: "Comercial ou agente de negócios" },
  {
    id: "debenturista",
    label: "Debenturista",
    plural: "Debenturistas",
    hint: "Investidor em debêntures da securitizadora",
  },
  { id: "cotista", label: "Cotista", plural: "Cotistas", hint: "Investidor em cotas de FIDC" },
  { id: "avalista", label: "Avalista / fiador", plural: "Avalistas", hint: "Garante as obrigações de um cedente" },
  {
    id: "prestador",
    label: "Prestador de serviço",
    plural: "Prestadores",
    hint: "Cartório, jurídico, auditoria, custódia",
  },
];

export const roleLabel = (role: PartyRole) => partyRoles.find(r => r.id === role)?.label ?? role;

export type PartyAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};
export type PartyContact = { id: string; name: string; area: string; email: string; phone: string };
export type PartyBankAccount = {
  id: string;
  bank: string;
  agency: string;
  account: string;
  pixKey: string;
  holderDocument: string;
  main: boolean;
};

export type CedentRoleData = {
  creditLimit: number;
  monthlyRate: number;
  repId: string;
  contractUntil: string;
  guarantee: "Com regresso" | "Sem regresso";
};
export type SacadoRoleData = { creditLimit: number; confirmationContact: string };
export type SupplierRoleData = { category: string; paymentTermDays: number };
export type RepresentativeRoleData = {
  repId?: string;
  repKind: RepKind;
  region: string;
  monthlyGoal: number;
  flatRate: number;
  company: string;
};
export type DebentureRoleData = {
  issuer: string;
  series: string;
  quantity: number;
  unitValue: number;
  remuneration: string;
  maturity: string;
  qualifiedInvestor: boolean;
};
export type QuotaholderRoleData = { fund: string; quotaClass: string; quotas: number; qualifiedInvestor: boolean };
export type GuarantorRoleData = {
  guaranteedDocument: string;
  guaranteedName: string;
  kind: "Aval" | "Fiança";
  limit: number;
};
export type ProviderRoleData = { service: string; contractUntil: string };

export type PartyRoleData = {
  cedente?: CedentRoleData;
  sacado?: SacadoRoleData;
  fornecedor?: SupplierRoleData;
  representante?: RepresentativeRoleData;
  debenturista?: DebentureRoleData;
  cotista?: QuotaholderRoleData;
  avalista?: GuarantorRoleData;
  prestador?: ProviderRoleData;
};

export type Party = {
  id: string;
  kind: PersonKind;
  document: string;
  name: string;
  tradeName: string;
  birthOrFoundation: string;
  stateRegistration: string;
  email: string;
  phone: string;
  address: PartyAddress;
  contacts: PartyContact[];
  bankAccounts: PartyBankAccount[];
  roles: PartyRole[];
  roleData: PartyRoleData;
  status: "Ativo" | "Inativo";
  inactiveReason?: string;
  notes: string;
  /** Origem do registro: criado no Cadastro ou derivado de dados que já existiam nos módulos. */
  origin: "Cadastro" | "Operações" | "Comercial";
  createdAt: string;
  updatedAt: string;
  history: { at: string; by: string; action: string }[];
};

/* ---------------------------------------------------------------- documentos */

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (len: number) => {
    const sum = d
      .slice(0, len)
      .split("")
      .reduce((s, n, i) => s + Number(n) * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function isValidCnpj(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function formatDocument(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => `${a}.${b}.${c}${e ? `-${e}` : ""}`);
  return d.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,
    (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? `-${f}` : ""}`,
  );
}

export const formatZip = (value: string) =>
  onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})/, "$1-$2");

/* ---------------------------------------------------------------- validação */

export type PartyIssue = { field: string; message: string; blocking: boolean };

export function validateParty(party: Party, others: Party[]): PartyIssue[] {
  const issues: PartyIssue[] = [];
  const block = (field: string, message: string) => issues.push({ field, message, blocking: true });
  const warn = (field: string, message: string) => issues.push({ field, message, blocking: false });
  const digits = onlyDigits(party.document);
  if (party.kind === "PJ" ? !isValidCnpj(digits) : !isValidCpf(digits))
    block("document", `${party.kind === "PJ" ? "CNPJ" : "CPF"} inválido: confira os dígitos verificadores.`);
  if (others.some(o => o.id !== party.id && onlyDigits(o.document) === digits))
    block("document", "Já existe um cadastro com este documento. Edite o cadastro existente e acrescente o papel.");
  if (!party.name.trim()) block("name", party.kind === "PJ" ? "Informe a razão social." : "Informe o nome completo.");
  if (!party.roles.length) block("roles", "Escolha pelo menos um papel.");
  if (party.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)) block("email", "E-mail inválido.");
  if (party.address.zipCode && onlyDigits(party.address.zipCode).length !== 8)
    block("zipCode", "CEP deve ter 8 dígitos.");
  if (!party.address.city.trim() || !party.address.state.trim())
    warn("city", "Cidade e UF ajudam na checagem e na cobrança.");
  const r = party.roleData;
  if (party.roles.includes("cedente")) {
    if (party.kind === "PF") warn("cedente", "Cedente pessoa física: confirme se a política do veículo permite.");
    if (!r.cedente?.repId) warn("cedente.repId", "Cedente sem comercial responsável não gera comissão.");
    if ((r.cedente?.creditLimit ?? 0) < 0) block("cedente.creditLimit", "Limite não pode ser negativo.");
  }
  if (party.roles.includes("sacado") && (r.sacado?.creditLimit ?? 0) < 0)
    block("sacado.creditLimit", "Limite não pode ser negativo.");
  if (party.roles.includes("representante")) {
    const rep = r.representante;
    if (!rep || rep.monthlyGoal < 0)
      block("representante.monthlyGoal", "Informe a meta mensal de receita (pode ser zero).");
    if (rep && (rep.flatRate < 0 || rep.flatRate > 100))
      block("representante.flatRate", "Comissão fixa deve ficar entre 0% e 100%.");
    if (rep?.repKind === "CLT" && party.kind === "PJ")
      warn("representante.repKind", "Representante CLT normalmente é pessoa física.");
  }
  if (party.roles.includes("debenturista")) {
    const deb = r.debenturista;
    if (!deb?.series.trim()) block("debenturista.series", "Informe a série da debênture.");
    if (!deb || deb.quantity <= 0) block("debenturista.quantity", "Quantidade de debêntures deve ser maior que zero.");
    if (!deb || deb.unitValue <= 0) block("debenturista.unitValue", "Informe o valor unitário (PU) de subscrição.");
    if (!deb?.maturity) block("debenturista.maturity", "Informe o vencimento.");
  }
  if (party.roles.includes("cotista")) {
    const quota = r.cotista;
    if (!quota?.fund) block("cotista.fund", "Escolha o fundo.");
    if (!quota || quota.quotas <= 0) block("cotista.quotas", "Quantidade de cotas deve ser maior que zero.");
  }
  if (party.roles.includes("avalista") && !r.avalista?.guaranteedDocument)
    block("avalista.guaranteedDocument", "Informe o cedente garantido.");
  if (party.roles.includes("fornecedor") && !r.fornecedor?.category)
    warn("fornecedor.category", "Categoria ajuda a classificar os pagamentos.");
  if (
    (party.roles.includes("fornecedor") ||
      party.roles.includes("prestador") ||
      party.roles.includes("representante")) &&
    !party.bankAccounts.length
  )
    warn("bankAccounts", "Sem conta bancária: o pagamento não poderá ser liberado.");
  return issues;
}

/* ---------------------------------------------------------------- criação */

const today = () => new Date().toISOString().slice(0, 10);
const emptyAddress = (): PartyAddress => ({
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
});

export function defaultRoleData(role: PartyRole): PartyRoleData[PartyRole] {
  switch (role) {
    case "cedente":
      return { creditLimit: 0, monthlyRate: 2.5, repId: "", contractUntil: "", guarantee: "Com regresso" };
    case "sacado":
      return { creditLimit: 0, confirmationContact: "" };
    case "fornecedor":
      return { category: "", paymentTermDays: 30 };
    case "representante":
      return { repKind: "CLT", region: "", monthlyGoal: 0, flatRate: 0, company: "" };
    case "debenturista":
      return {
        issuer: "Órbita Securitizadora S.A.",
        series: "",
        quantity: 0,
        unitValue: 1000,
        remuneration: "CDI + 3,00% a.a.",
        maturity: "",
        qualifiedInvestor: true,
      };
    case "cotista":
      return { fund: "", quotaClass: "Sênior", quotas: 0, qualifiedInvestor: true };
    case "avalista":
      return { guaranteedDocument: "", guaranteedName: "", kind: "Aval", limit: 0 };
    case "prestador":
      return { service: "", contractUntil: "" };
  }
}

export function emptyParty(role?: PartyRole): Party {
  const now = today();
  return {
    id: `pty-${Date.now().toString(36)}`,
    kind: "PJ",
    document: "",
    name: "",
    tradeName: "",
    birthOrFoundation: "",
    stateRegistration: "",
    email: "",
    phone: "",
    address: emptyAddress(),
    contacts: [],
    bankAccounts: [],
    roles: role ? [role] : [],
    roleData: role ? { [role]: defaultRoleData(role) } : {},
    status: "Ativo",
    notes: "",
    origin: "Cadastro",
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}

/* ---------------------------------------------------------------- consolidação */

/**
 * Lista de pessoas exibida no Cadastro: o que foi salvo no Cadastro + o que já existia nos
 * módulos (cedentes, sacados e comerciais de demonstração), sem duplicar por documento.
 * Salvar um registro derivado grava a versão completa no Cadastro.
 */
export function mergeParties(
  saved: Party[],
  sources: {
    cedents: Cedent[];
    debtors: Debtor[];
    reps: SalesRep[];
    repOfCedent: (document: string) => string | undefined;
  },
): Party[] {
  const byDoc = new Map<string, Party>();
  saved.forEach(p => byDoc.set(onlyDigits(p.document), p));
  const upsert = (document: string, build: () => Party, addRole: (p: Party) => Party) => {
    const key = onlyDigits(document);
    const existing = byDoc.get(key);
    if (!existing) byDoc.set(key, build());
    else if (existing.origin !== "Cadastro") byDoc.set(key, addRole(existing));
  };
  sources.cedents.forEach(c => {
    const data: CedentRoleData = {
      creditLimit: c.creditLimit,
      monthlyRate: 2.5,
      repId: sources.repOfCedent(c.document) ?? "",
      contractUntil: "",
      guarantee: "Com regresso",
    };
    upsert(
      c.document,
      () => ({
        ...emptyParty("cedente"),
        id: `pty-${c.id}`,
        document: c.document,
        name: c.name,
        origin: "Operações",
        roleData: { cedente: data },
      }),
      p =>
        p.roles.includes("cedente")
          ? p
          : { ...p, roles: [...p.roles, "cedente"], roleData: { ...p.roleData, cedente: data } },
    );
  });
  sources.debtors.forEach(d => {
    const data: SacadoRoleData = { creditLimit: 0, confirmationContact: d.phone ?? d.email ?? "" };
    const address: PartyAddress = {
      zipCode: d.zipCode,
      street: d.address,
      number: d.number,
      complement: "",
      district: d.district,
      city: d.city,
      state: d.state,
    };
    upsert(
      d.document,
      () => ({
        ...emptyParty("sacado"),
        id: `pty-${d.id}`,
        document: d.document,
        name: d.name,
        tradeName: d.tradeName ?? "",
        email: d.email ?? "",
        phone: d.phone ?? d.mobile ?? "",
        address,
        origin: "Operações",
        roleData: { sacado: data },
      }),
      p =>
        p.roles.includes("sacado")
          ? p
          : {
              ...p,
              roles: [...p.roles, "sacado"],
              roleData: { ...p.roleData, sacado: data },
              address: p.address.city ? p.address : address,
            },
    );
  });
  sources.reps.forEach(r => {
    const data: RepresentativeRoleData = {
      repId: r.id,
      repKind: r.kind,
      region: r.region,
      monthlyGoal: r.monthlyGoal,
      flatRate: r.flatRate ?? 0,
      company: r.company,
    };
    upsert(
      r.document,
      () => ({
        ...emptyParty("representante"),
        id: `pty-${r.id}`,
        kind: onlyDigits(r.document).length === 14 ? "PJ" : "PF",
        document: r.document,
        name: r.name,
        email: r.email,
        phone: r.phone,
        origin: "Comercial",
        status: r.active ? "Ativo" : "Inativo",
        roleData: { representante: data },
      }),
      p =>
        p.roles.includes("representante")
          ? p
          : { ...p, roles: [...p.roles, "representante"], roleData: { ...p.roleData, representante: data } },
    );
  });
  return [...byDoc.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/* ---------------------------------------------------------------- adaptadores */

/** Cedente cadastrado aqui e que ainda não tem histórico de crédito: entra como conta nova. */
export function partyToCedent(party: Party): Cedent {
  return {
    id: `ced-${onlyDigits(party.document)}`,
    document: party.document,
    name: party.name,
    score: 0,
    creditLimit: party.roleData.cedente?.creditLimit ?? 0,
    usedLimit: 0,
    portfolioReceivable: 0,
    portfolioOverdue: 0,
    settlements: 0,
    lateSettlements: 0,
    averageDelayDays: 0,
    repurchases: 0,
    incidents: 0,
    publicStatus: party.status === "Ativo" ? "Cadastro novo" : `Inativo · ${party.inactiveReason ?? ""}`,
    scoreReasons: ["Conta nova: score ainda não calculado"],
  };
}

export function partyToDebtor(party: Party): Debtor {
  return {
    id: `sac-${onlyDigits(party.document)}`,
    document: party.document,
    name: party.name,
    tradeName: party.tradeName || undefined,
    address: party.address.street,
    number: party.address.number,
    district: party.address.district,
    city: party.address.city,
    state: party.address.state,
    zipCode: party.address.zipCode,
    email: party.email || undefined,
    phone: party.phone || undefined,
    source: "Cadastro manual",
  };
}

export function partyToSalesRep(party: Party, fallbackSince: string): SalesRep | null {
  const rep = party.roleData.representante;
  if (!rep) return null;
  const initials = party.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
  return {
    id: rep.repId ?? "",
    name: party.name,
    initials,
    role: rep.repKind === "CLT" ? "Executivo comercial" : "Agente de negócios",
    kind: rep.repKind,
    region: rep.region || "—",
    email: party.email,
    phone: party.phone,
    document: party.document,
    company: rep.company || "Lastro Fomento Mercantil",
    monthlyGoal: rep.monthlyGoal,
    flatRate: rep.repKind === "Agente autônomo" ? rep.flatRate : undefined,
    active: party.status === "Ativo",
    since: fallbackSince,
  };
}

/* ---------------------------------------------------------------- demonstração */

/** Registros de exemplo para os papéis que ainda não existiam em outros módulos. */
export function seedParties(): Party[] {
  const base = (
    id: string,
    kind: PersonKind,
    document: string,
    name: string,
    role: PartyRole,
    data: PartyRoleData,
    extra: Partial<Party> = {},
  ): Party => ({
    ...emptyParty(role),
    id,
    kind,
    document,
    name,
    roleData: data,
    createdAt: "2026-06-01",
    updatedAt: "2026-09-01",
    ...extra,
  });
  const addr = (city: string, state: string, street = "", number = ""): PartyAddress => ({
    ...emptyAddress(),
    city,
    state,
    street,
    number,
  });
  const bank = (
    id: string,
    bankName: string,
    agency: string,
    account: string,
    holderDocument: string,
  ): PartyBankAccount => ({ id, bank: bankName, agency, account, pixKey: holderDocument, holderDocument, main: true });
  return [
    base(
      "pty-f1",
      "PJ",
      "11.444.777/0001-61",
      "Cartório de Protesto de Curitiba",
      "prestador",
      { prestador: { service: "Protesto de títulos", contractUntil: "2027-06-30" } },
      {
        address: addr("Curitiba", "PR"),
        bankAccounts: [bank("b1", "341 · Itaú", "0350", "22019-4", "11.444.777/0001-61")],
      },
    ),
    base(
      "pty-f2",
      "PJ",
      "45.723.174/0001-10",
      "Nuvem Sistemas e Hospedagem Ltda",
      "fornecedor",
      { fornecedor: { category: "Tecnologia", paymentTermDays: 15 } },
      {
        address: addr("São Paulo", "SP"),
        email: "financeiro@nuvemsistemas.com.br",
        bankAccounts: [bank("b2", "237 · Bradesco", "0421", "77310-1", "45.723.174/0001-10")],
      },
    ),
    base(
      "pty-f3",
      "PJ",
      "06.990.590/0001-23",
      "Prado & Reis Advogados Associados",
      "prestador",
      { prestador: { service: "Jurídico e cobrança judicial", contractUntil: "2027-01-31" } },
      { address: addr("São Paulo", "SP") },
    ),
    base(
      "pty-f4",
      "PJ",
      "60.701.190/0001-04",
      "Office Center Papelaria Ltda",
      "fornecedor",
      { fornecedor: { category: "Material de escritório", paymentTermDays: 30 } },
      { address: addr("Curitiba", "PR") },
    ),
    base(
      "pty-d1",
      "PF",
      "529.982.247-25",
      "Marina Costa Albuquerque",
      "debenturista",
      {
        debenturista: {
          issuer: "Órbita Securitizadora S.A.",
          series: "1ª série · ORBT11",
          quantity: 250,
          unitValue: 1000,
          remuneration: "CDI + 3,50% a.a.",
          maturity: "2029-03-15",
          qualifiedInvestor: true,
        },
      },
      {
        address: addr("Belo Horizonte", "MG"),
        email: "marina.albuquerque@email.com",
        bankAccounts: [bank("b3", "001 · Banco do Brasil", "3120-1", "15522-0", "529.982.247-25")],
      },
    ),
    base(
      "pty-d2",
      "PJ",
      "34.028.316/0001-03",
      "Horizonte Family Office Ltda",
      "debenturista",
      {
        debenturista: {
          issuer: "Órbita Securitizadora S.A.",
          series: "2ª série · ORBT12",
          quantity: 1200,
          unitValue: 1000,
          remuneration: "IPCA + 8,20% a.a.",
          maturity: "2030-09-15",
          qualifiedInvestor: true,
        },
      },
      { address: addr("São Paulo", "SP") },
    ),
    base(
      "pty-c1",
      "PJ",
      "19.131.243/0001-97",
      "Previdência Aurora Fundo de Pensão",
      "cotista",
      {
        cotista: {
          fund: "Lastro Prime FIDC · Classe Sênior",
          quotaClass: "Sênior",
          quotas: 18_500,
          qualifiedInvestor: true,
        },
      },
      { address: addr("Porto Alegre", "RS") },
    ),
    base(
      "pty-c2",
      "PF",
      "153.509.460-56",
      "Ricardo Menezes Farias",
      "cotista",
      {
        cotista: {
          fund: "Aurora Recebíveis FIDC · Classe Única",
          quotaClass: "Única",
          quotas: 420,
          qualifiedInvestor: true,
        },
      },
      { address: addr("Campinas", "SP") },
    ),
    base(
      "pty-a1",
      "PF",
      "111.444.777-35",
      "Gilberto Zanetti",
      "avalista",
      {
        avalista: {
          guaranteedDocument: "52.927.676/0001-29",
          guaranteedName: "GZ Transportes Ltda",
          kind: "Aval",
          limit: 1_500_000,
        },
      },
      { address: addr("Curitiba", "PR"), notes: "Sócio administrador da GZ Transportes." },
    ),
  ];
}
