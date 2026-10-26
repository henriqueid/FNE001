/** Protege motivo, concorrência e autoria do histórico pela fronteira HTTP real. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyParty, type Party } from "@/src/domain/registry/parties";

const boundary = vi.hoisted(() => ({
  principal: vi.fn(),
  current: vi.fn(),
  document: vi.fn(),
  save: vi.fn(),
  defaults: vi.fn(),
  destinations: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", async original => ({
  ...(await original<object>()),
  getDatabase: () => ({}),
}));
vi.mock("@/src/server/registry/repository", async original => ({
  ...(await original<object>()),
  findRegistryPartyById: boundary.current,
  findRegistryPartyByDocument: boundary.document,
  saveRegistryParty: boundary.save,
  loadCompanyDestinations: boundary.destinations,
  loadCompanyProfile: boundary.profile,
}));
vi.mock("@/src/server/registry/operational-parameter-requests", () => ({
  loadOperationalParameterState: boundary.defaults,
}));
import { PUT } from "@/app/api/registry/parties/route";
import { emptyOperationalDefaults } from "@/src/domain/registry/operational-profile";

const previous: Party = {
  ...emptyParty("fornecedor"),
  id: "churume-party",
  name: "Fornecedor QA",
  document: "11.222.333/0001-81",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  history: [{ at: "2026-10-01", by: "Autor original", action: "Criação" }],
};
function request(body: unknown) {
  return PUT(
    new Request("http://localhost/api/registry/parties", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-strato-tenant-id": "qa" },
      body: JSON.stringify(body),
    }),
  ).then(response => {
    if (!response) throw new Error("Handler sem resposta");
    return response;
  });
}
beforeEach(() => {
  boundary.defaults.mockResolvedValue(null);
  boundary.destinations.mockResolvedValue([]);
  boundary.profile.mockResolvedValue(null);
  boundary.principal.mockResolvedValue({ id: "qa-editor", name: "Editor real", permissions: ["registry:edit"] });
  boundary.current.mockResolvedValue(structuredClone(previous));
  boundary.document.mockResolvedValue(structuredClone(previous));
});
afterEach(() => vi.clearAllMocks());

it("recusa edição sem motivo mesmo quando navegador apaga histórico", async () => {
  const response = await request({ ...previous, name: "Alterado", history: [] });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/motivo/i);
  expect(boundary.save).not.toHaveBeenCalled();
});
it("constrói histórico com autor e data do servidor, ignorando autoria forjada", async () => {
  const response = await request({
    party: {
      ...previous,
      name: "Nome revisado",
      history: [{ at: "1900-01-01", by: "Diretor forjado", action: "Fabricado" }],
      createdAt: "1900-01-01",
      updatedAt: "1900-01-01",
    },
    reason: "Revisão solicitada em teste QA",
    expectedUpdatedAt: previous.updatedAt,
  });
  expect(response.status).toBe(200);
  const { party } = (await response.json()) as { party: Party };
  expect(party.history[0]).toEqual(previous.history[0]);
  expect(party.history).toHaveLength(2);
  expect(party.history[1]).toMatchObject({
    by: "Editor real",
    field: "name",
    from: previous.name,
    to: "Nome revisado",
    reason: "Revisão solicitada em teste QA",
  });
  expect(party.history[1].at).not.toBe("1900-01-01");
  expect(party.createdAt).toBe(previous.createdAt);
});
it("recusa versão anterior sem sobrescrever alteração concorrente", async () => {
  const response = await request({
    party: { ...previous, name: "Concorrente" },
    reason: "Revisão de teste",
    expectedUpdatedAt: "2026-10-01",
  });
  expect(response.status).toBe(409);
  expect(boundary.save).not.toHaveBeenCalled();
});
it("não altera contas pela gravação genérica mesmo com motivo válido", async () => {
  const response = await request({
    party: {
      ...previous,
      bankAccounts: [
        { id: "x", bank: "341", agency: "1", account: "2", pixKey: "", holderDocument: previous.document, main: true },
      ],
    },
    reason: "Contas alteradas no teste",
    expectedUpdatedAt: previous.updatedAt,
  });
  expect(response.status).toBe(409);
  expect(boundary.save).not.toHaveBeenCalled();
});
it("criação não importa histórico nem datas fabricadas pelo navegador", async () => {
  boundary.current.mockResolvedValue(null);
  boundary.document.mockResolvedValue(null);
  const response = await request({
    party: { ...previous, history: [{ at: "1900-01-01", by: "Forjado", action: "Fabricado" }] },
  });
  expect(response.status).toBe(200);
  const { party } = (await response.json()) as { party: Party };
  expect(party.history).toHaveLength(1);
  expect(party.history[0].by).toBe("Editor real");
  expect(party.createdAt).not.toBe(previous.createdAt);
});
it.each([null, {}, { party: { id: "x", roles: ["fornecedor"] } }])(
  "responde400 para cadastro malformado %j",
  async body => {
    const response = await request(body);
    expect(response.status).toBe(400);
    expect(boundary.save).not.toHaveBeenCalled();
  },
);
it("impede alterar limite aprovado por gravação cadastral genérica", async () => {
  const party = {
    ...previous,
    roles: ["cedente"],
    roleData: {
      cedente: { creditLimit: 10000, monthlyRate: 2, repId: "rep", contractUntil: "", guarantee: "Com regresso" },
    },
  };
  const response = await request({
    party,
    reason: "Tentativa de aumentar limite sem decisão",
    expectedUpdatedAt: previous.updatedAt,
  });
  expect(response.status).toBe(403);
  expect(boundary.save).not.toHaveBeenCalled();
});
it.each(["inválido", [null], [{ id: "x", amount: "muito", vehicle: "Empresa" }]])(
  "recusa tranches malformadas antes de avaliar alçada: %j",
  async tranches => {
    const response = await request({
      party: { ...previous, roleData: { cedente: { creditLimit: 0, tranches } } },
      reason: "Revisão de tranches",
      expectedUpdatedAt: previous.updatedAt,
    });
    expect(response.status).toBe(400);
    expect(boundary.save).not.toHaveBeenCalled();
  },
);

function creditParty(role: "cedente" | "sacado" = "cedente"): Party {
  return {
    ...emptyParty(role),
    id: previous.id,
    name: previous.name,
    document: previous.document,
    updatedAt: previous.updatedAt,
  };
}
function useCurrent(party: Party) {
  boundary.current.mockResolvedValue(party);
  boundary.document.mockResolvedValue(party);
}
function creditPrincipal(
  permissions = ["registry:edit", "risk:decide"],
  authorityIds = ["credit-director"],
  companyScopes = ["Empresa A"],
) {
  boundary.principal.mockResolvedValue({
    id: "qa-credit",
    name: "Diretoria QA",
    permissions,
    authorityIds,
    companyScopes,
  });
}
it.each([
  { monthlyRate: 3 },
  { operationalOverrides: { operationFee: 0 } },
  { contractUntil: "2027-01-01" },
  { guarantee: "Sem regresso" },
  { requiresLastroPrecheck: true },
])("exige competência de crédito para mudança material cedente: %j", async patch => {
  const current = creditParty();
  useCurrent(current);
  const response = await request({
    party: { ...current, roleData: { ...current.roleData, cedente: { ...current.roleData.cedente, ...patch } } },
    reason: "Revisão material",
    expectedUpdatedAt: current.updatedAt,
  });
  expect(response.status).toBe(403);
  expect(boundary.save).not.toHaveBeenCalled();
});
it("limite de sacado não é retirado por simples edição cadastral", async () => {
  const current = creditParty("sacado");
  current.roleData.sacado!.creditLimit = 100;
  useCurrent(current);
  expect(
    (
      await request({
        party: { ...current, roleData: { sacado: { ...current.roleData.sacado, creditLimit: 0 } } },
        reason: "Retirada de limite",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(403);
});
it.each(
  [
    null,
    [],
    { dayBasis: 0 },
    { monthlyRate: -2 },
    { reservePercent: 101 },
    { businessDays: "não" },
    { maximumOperationAmount: "livre" },
    { unknownField: 1 },
    { minimumTermDays: 200, maximumTermDays: 10 },
  ].map(overrides => ({ overrides })),
)("recusa override inválido de forma controlada: %j", async ({ overrides }) => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal();
  const response = await request({
    party: { ...current, roleData: { cedente: { ...current.roleData.cedente, operationalOverrides: overrides } } },
    reason: "Conferência dos parâmetros",
    expectedUpdatedAt: current.updatedAt,
  });
  expect(response.status).toBe(400);
  expect(boundary.save).not.toHaveBeenCalled();
});
it("diretoria autorizada mantém zero explícito e salva override válido", async () => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal();
  const response = await request({
    party: {
      ...current,
      roleData: { cedente: { ...current.roleData.cedente, operationalOverrides: { operationFee: 0, dayBasis: 360 } } },
    },
    reason: "Condição autorizada pela diretoria",
    expectedUpdatedAt: current.updatedAt,
  });
  expect(response.status).toBe(200);
  expect((await response.json()).party.roleData.cedente.operationalOverrides.operationFee).toBe(0);
});
it("contato e identificação cedente continuam editáveis sem alçada", async () => {
  const current = creditParty();
  useCurrent(current);
  expect(
    (
      await request({
        party: {
          ...current,
          phone: "11999999999",
          roleData: {
            cedente: {
              ...current.roleData.cedente,
              repId: "rep-novo",
              contract: { ...current.roleData.cedente!.contract, notes: "Conferência do endereço", number: "DOC-1" },
            },
          },
        },
        reason: "Atualização cadastral",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(200);
});
it.each(
  [
    [],
    { debenturista: {} },
    { cedente: { contract: "inválido" } },
    { cedente: { compliance: { kycStatus: 3 } } },
    { prestador: { service: {}, contractUntil: "" } },
    { fornecedor: { category: "", paymentTermDays: "30" } },
  ].map(roleData => ({ roleData })),
)("recusa estruturas roleData inválidas sem TypeError: %j", async ({ roleData }) => {
  const response = await request({
    party: { ...previous, roleData },
    reason: "Forma inválida",
    expectedUpdatedAt: previous.updatedAt,
  });
  expect(response.status).toBe(400);
  expect(boundary.save).not.toHaveBeenCalled();
});
it.each([{ permissions: ["registry:edit"] }, { permissions: ["registry:edit", "risk:decide"] }])(
  "alçada e permissão são exigidas em conjunto: %j",
  async ({ permissions }) => {
    const current = creditParty("sacado");
    useCurrent(current);
    creditPrincipal(permissions, permissions.includes("risk:decide") ? [] : ["credit-director"]);
    expect(
      (
        await request({
          party: { ...current, roleData: { sacado: { ...current.roleData.sacado, creditLimit: 500 } } },
          reason: "Novo limite do sacado",
          expectedUpdatedAt: current.updatedAt,
        })
      ).status,
    ).toBe(403);
  },
);

function tranche(vehicle: string) {
  return {
    id: "tranche-qa",
    name: "Crédito QA",
    amount: 1000,
    institution: "Factoring" as const,
    vehicle,
    modality: "",
    receivableType: "",
    validUntil: "",
    priority: 1,
    allowSharing: false,
    active: true,
  };
}
it("valida override contra defaults efetivamente salvos no servidor", async () => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal();
  const defaults = emptyOperationalDefaults();
  defaults.general.minimumTermDays = 45;
  boundary.defaults.mockResolvedValue(defaults);
  expect(
    (
      await request({
        party: {
          ...current,
          roleData: { cedente: { ...current.roleData.cedente, operationalOverrides: { maximumTermDays: 30 } } },
        },
        reason: "Prazo incompatível com padrão atual",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(400);
});
it("tranches só do veículo permitido são editáveis por diretoria autorizada", async () => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal(undefined, undefined, ["empresa a"]);
  expect(
    (
      await request({
        party: { ...current, roleData: { cedente: { ...current.roleData.cedente, tranches: [tranche("Empresa A")] } } },
        reason: "Alocação autorizada em A",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(200);
});
it("não move tranche de empresa fora do escopo para empresa própria", async () => {
  const current = creditParty();
  current.roleData.cedente!.tranches = [tranche("Empresa B")];
  useCurrent(current);
  creditPrincipal();
  expect(
    (
      await request({
        party: { ...current, roleData: { cedente: { ...current.roleData.cedente, tranches: [tranche("Empresa A")] } } },
        reason: "Tentativa de capturar tranche B",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(403);
});
it("condição global exige escopo de todas empresas afetadas", async () => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal();
  boundary.destinations.mockResolvedValue([
    { name: "Empresa A", status: "ACTIVE" },
    { name: "Empresa B", status: "ACTIVE" },
  ]);
  expect(
    (
      await request({
        party: {
          ...current,
          roleData: { cedente: { ...current.roleData.cedente, operationalOverrides: { operationFee: 0 } } },
        },
        reason: "Parâmetro global afetaria empresa B",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(403);
});
it("qualquer veículo exige cobertura global, sem exigir wildcard de quem possui todos os escopos", async () => {
  const current = creditParty();
  useCurrent(current);
  creditPrincipal();
  boundary.destinations.mockResolvedValue([
    { name: "Empresa A", status: "ACTIVE" },
    { name: "Empresa B", status: "ACTIVE" },
  ]);
  const input = {
    party: { ...current, roleData: { cedente: { ...current.roleData.cedente, tranches: [tranche("")] } } },
    reason: "Alocação válida para todos veículos",
    expectedUpdatedAt: current.updatedAt,
  };
  expect((await request(input)).status).toBe(403);
  creditPrincipal(undefined, undefined, ["Empresa A", "Empresa B"]);
  expect((await request(input)).status).toBe(200);
});
it("sacado com competência e cobertura pode receber limite legítimo", async () => {
  const current = creditParty("sacado");
  useCurrent(current);
  creditPrincipal();
  expect(
    (
      await request({
        party: { ...current, roleData: { sacado: { ...current.roleData.sacado, creditLimit: 500 } } },
        reason: "Limite autorizado",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(200);
});

it("primeira empresa também delimita condição de crédito global", async () => {
  const current = creditParty("sacado");
  useCurrent(current);
  creditPrincipal();
  boundary.profile.mockResolvedValue({ tradeName: "Empresa B" });
  expect(
    (
      await request({
        party: { ...current, roleData: { sacado: { ...current.roleData.sacado, creditLimit: 500 } } },
        reason: "Limite compartilhado",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(403);
});
it.each([{ monthlyRate: 99 }, { maximumDebtorConcentrationPercent: 101 }])(
  "tranche também respeita validação canônica: %j",
  async extra => {
    const current = creditParty();
    useCurrent(current);
    creditPrincipal();
    expect(
      (
        await request({
          party: {
            ...current,
            roleData: { cedente: { ...current.roleData.cedente, tranches: [{ ...tranche("Empresa A"), ...extra }] } },
          },
          reason: "Condição de tranche inválida",
          expectedUpdatedAt: current.updatedAt,
        })
      ).status,
    ).toBe(400);
  },
);
import { seedParties } from "@/src/domain/registry/parties";
it.each(seedParties().map(party => ({ party })))(
  "estrutura legítima permanece editável: $party.name",
  async ({ party }) => {
    useCurrent(party);
    expect(
      (
        await request({
          party: { ...party, phone: "11999999999" },
          reason: "Atualização legítima de telefone",
          expectedUpdatedAt: party.updatedAt,
        })
      ).status,
    ).toBe(200);
  },
);
it("vínculo cadastral de avalista sem limite concedido não exige alçada de crédito", async () => {
  const current: Party = {
    ...emptyParty("avalista"),
    id: previous.id,
    name: previous.name,
    document: previous.document,
    updatedAt: previous.updatedAt,
  };
  current.roleData.avalista!.guaranteedDocument = "11.222.333/0001-81";
  useCurrent(current);
  expect(
    (
      await request({
        party: {
          ...current,
          roleData: {
            avalista: {
              ...current.roleData.avalista,
              guaranteedName: "Nome atualizado",
              guaranteedDocument: "41.228.905/0001-09",
            },
          },
        },
        reason: "Atualização de vínculo sem limite",
        expectedUpdatedAt: current.updatedAt,
      })
    ).status,
  ).toBe(200);
});
