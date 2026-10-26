import { afterEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ principal: vi.fn(), profile: vi.fn(), destinations: vi.fn() }));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: boundary.principal }));
vi.mock("@/src/server/database/postgres", () => ({ getDatabase: () => ({}) }));
vi.mock("@/src/server/registry/repository", () => ({
  loadCompanyProfile: boundary.profile,
  loadCompanyDestinations: boundary.destinations,
  saveCompanyProfile: vi.fn(),
  saveCompanyDestination: vi.fn(),
}));
import { GET, PUT } from "@/app/api/company/route";
import { GET as destinations } from "@/app/api/company/destinations/route";
const request = () => new Request("http://localhost/api/company", { headers: { "x-strato-tenant-id": "qa" } });
afterEach(() => vi.clearAllMocks());
it("operador entra no ambiente existente sem receber dados administrativos nem precisar settings:view", async () => {
  boundary.principal.mockResolvedValue({
    permissions: ["dashboard:view", "operations:view"],
    companyScopes: ["Empresa QA"],
  });
  boundary.profile.mockResolvedValue({
    legalName: "Empresa QA LTDA",
    tradeName: "Empresa QA",
    document: "11222333000181",
    institutionType: "Factoring",
    email: "restrito@example.invalid",
    phone: "123",
    website: "",
    foundationDate: "",
    address: { street: "Rua administrativa" },
  });
  const response = await GET(request());
  if (!response) throw new Error("Handler sem resposta");
  expect(response.status).toBe(200);
  const { company } = await response.json();
  expect(company.tradeName).toBe("Empresa QA");
  expect(company.email).toBe("");
  expect(company.address.street).toBe("");
  expect((await PUT(request()))!.status).toBe(403);
});
it("diretório operacional inclui somente empresas autorizadas", async () => {
  boundary.principal.mockResolvedValue({ permissions: ["operations:view"], companyScopes: ["Empresa QA"] });
  boundary.destinations.mockResolvedValue([
    { name: "Empresa QA", status: "ACTIVE" },
    { name: "Empresa restrita", status: "ACTIVE" },
  ]);
  const response = await destinations(request());
  if (!response) throw new Error("Handler sem resposta");
  expect(response.status).toBe(200);
  expect((await response.json()).destinations).toEqual([{ name: "Empresa QA", status: "ACTIVE" }]);
});
