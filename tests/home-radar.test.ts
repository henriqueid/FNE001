/** Isolamento de módulos/empresas e projeção dos eventos reais do radar. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRadar } from "@/src/server/home/radar";
import { listPublishedNotifications } from "@/src/server/outbox/publisher";
import { listAccessChangeNotifications } from "@/src/server/access/notifications";
import { readMarketIndicator } from "@/src/server/copilot/market";
import { readMarketNews } from "@/src/server/home/market-news";
import { seedAccessState } from "@/src/domain/access/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { PublishedNotification } from "@/src/domain/notifications/model";

vi.mock("@/src/server/outbox/publisher", () => ({ listPublishedNotifications: vi.fn() }));
vi.mock("@/src/server/access/notifications", () => ({ listAccessChangeNotifications: vi.fn() }));
vi.mock("@/src/server/copilot/market", () => ({ readMarketIndicator: vi.fn() }));
vi.mock("@/src/server/home/market-news", () => ({ readMarketNews: vi.fn() }));
const principal = {
  ...seedAccessState().users[0],
  tenantId: "tenant-a",
  functionalAreas: ["Diretoria"],
  authorityIds: [],
  companyScopes: ["Empresa A"],
} as ServerPrincipal;
const rows = [
  {
    event_id: "event-a",
    event_type: "OPERATION_CREATED",
    created_at: "2026-10-19T12:00:00Z",
    operation_id: "op-a",
    vehicle: "Empresa A",
    cedent: "Cliente A",
    stage: 2,
    status: "Em análise",
    amount: 125000,
  },
  {
    event_id: "event-b",
    event_type: "OPERATION_CREATED",
    created_at: "2026-10-19T12:01:00Z",
    operation_id: "op-b",
    vehicle: "Empresa B",
    cedent: "Segredo B",
    stage: 1,
    status: "Em análise",
  },
];
const all = vi.fn();
const bind = vi.fn();
const prepare = vi.fn();
const db = { prepare } as unknown as DecisionDatabase;
describe("Radar da visão geral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const statement = { bind, all };
    prepare.mockReturnValue(statement);
    bind.mockReturnValue(statement);
    all.mockResolvedValue({ results: rows });
    vi.mocked(listPublishedNotifications).mockResolvedValue([]);
    vi.mocked(listAccessChangeNotifications).mockResolvedValue([]);
    vi.mocked(readMarketIndicator).mockResolvedValue({ available: false, reason: "Fonte não habilitada." });
    vi.mocked(readMarketNews).mockResolvedValue({ items: [], unavailable: [], checkedAt: "2026-10-20T12:00:00Z" });
  });
  it("nega a leitura sem dashboard antes de consultar fontes", async () => {
    await expect(loadRadar(db, { ...principal, permissions: [] })).rejects.toThrow("Sem acesso");
    expect(prepare).not.toHaveBeenCalled();
    expect(readMarketIndicator).not.toHaveBeenCalled();
  });
  it("não consulta eventos de operações quando o módulo está bloqueado", async () => {
    const result = await loadRadar(db, { ...principal, permissions: ["dashboard:view"] });
    expect(result.events).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
    expect(result.market).toHaveLength(2);
  });
  it("isola empresa e tenant e usa o horário do evento auditado", async () => {
    const result = await loadRadar(db, principal);
    expect(bind.mock.calls[0][0]).toBe("tenant-a");
    expect(bind.mock.calls[0][2]).toEqual({ __stratoJson: true, value: ["empresa a"] });
    expect(prepare.mock.calls[0][0]).toContain("event.tenant_id = ?");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ id: "event-a", operationId: "op-a", at: rows[0].created_at });
    expect(result.events[0].title).toContain("Cliente A");
    expect(result.events[0].summary).toContain("125.000");
    expect(result.events[0].summary).not.toContain("etapa 2");
    expect(JSON.stringify(result)).not.toContain("Segredo B");
  });
  it("limita o feed e não transforma indisponibilidade do mercado em cotação", async () => {
    all.mockResolvedValue({ results: Array.from({ length: 50 }, (_, i) => ({ ...rows[0], event_id: `event-${i}` })) });
    const result = await loadRadar(db, principal);
    expect(result.events).toHaveLength(20);
    expect(result.market.every(item => !item.available)).toBe(true);
  });
  it("não mostra notificações cujo módulo de destino está bloqueado", async () => {
    vi.mocked(listPublishedNotifications).mockResolvedValue([
      {
        id: "private-finance",
        title: "Pagamento privado",
        summary: "Financeiro",
        view: "finance",
        createdAt: rows[0].created_at,
      } as PublishedNotification,
    ]);
    const result = await loadRadar(db, { ...principal, access: "operator", permissions: ["dashboard:view"] });
    expect(result.events).toEqual([]);
  });
  it("prioriza pendência acionável sobre movimentação recente", async () => {
    vi.mocked(listPublishedNotifications).mockResolvedValue([
      {
        id: "older-pending",
        title: "Aprovação pendente",
        summary: "Conferir operação",
        impact: "Valor aguardando decisão",
        nextAction: "Revisar aprovação",
        tone: "critical",
        view: "operations",
        createdAt: "2026-10-18T12:00:00Z",
      } as PublishedNotification,
    ]);
    const result = await loadRadar(db, principal);
    expect(result.events[0]).toMatchObject({ id: "older-pending", priority: "attention", action: "Revisar aprovação" });
  });
  it("mantém data de referência e fonte oficial sem anualizar ou estimar valores", async () => {
    const point = {
      available: true as const,
      name: "CDI",
      value: 0.05,
      unit: "% ao dia",
      date: "2026-10-16",
      url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
    };
    vi.mocked(readMarketIndicator).mockResolvedValueOnce(point);
    const result = await loadRadar(db, principal);
    expect(result.market[0]).toEqual(point);
  });
});
