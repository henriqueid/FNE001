import { describe, expect, it } from "vitest";
import type { IntegrationChangeProposal } from "@/src/domain/integrations/model";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import {
  decideIntegrationProviderChange,
  IntegrationConfigurationConflictError,
  requestIntegrationProviderChange,
} from "@/src/server/integrations/provider-change-repository";

const unwrap = (value: unknown) =>
  value && typeof value === "object" && "__stratoJson" in value
    ? (value as unknown as { value: unknown }).value
    : value;

type Configuration = {
  provider_id: string;
  capability: "CNPJ_LOOKUP";
  status: "ACTIVE" | "PLANNED" | "SUSPENDED" | "DEGRADED";
  priority: number;
  config: { sourceType: "PUBLIC" | "INSTITUTIONAL"; apiKey?: string };
  updated_at: string;
};

class Statement implements DecisionStatement {
  private values: unknown[] = [];
  constructor(
    private readonly query: string,
    private readonly database: FakeDatabase,
  ) {}
  bind(...values: unknown[]) {
    this.values = values.map(unwrap);
    return this;
  }
  async first<T>() {
    return (this.database.first(this.query, this.values) as T | null) ?? null;
  }
  async all<T>() {
    return { results: this.database.all(this.query, this.values) as T[] };
  }
  async run() {
    this.database.run(this.query, this.values);
    return { success: true };
  }
}

class FakeDatabase implements DecisionDatabase {
  request?: Record<string, unknown>;
  configurations: Configuration[] = [
    {
      provider_id: "BRASIL_API",
      capability: "CNPJ_LOOKUP",
      status: "ACTIVE",
      priority: 10,
      config: { sourceType: "PUBLIC", apiKey: "segredo-servidor" },
      updated_at: "2026-10-14T12:00:00.000Z",
    },
    {
      provider_id: "RECEITA_WS",
      capability: "CNPJ_LOOKUP",
      status: "PLANNED",
      priority: 20,
      config: { sourceType: "INSTITUTIONAL", apiKey: "outro-segredo" },
      updated_at: "2026-10-14T12:00:00.000Z",
    },
  ];

  prepare(query: string) {
    return new Statement(query, this);
  }
  first(query: string, values: unknown[]) {
    if (query.includes("where tenant_id = ? and command_id = ?"))
      return this.request?.command_id === values[1] ? this.request : null;
    if (query.includes("where tenant_id = ? and change_id = ? for update")) return this.request ?? null;
    if (query.includes("with requested as")) {
      this.request = {
        change_id: values[1],
        command_id: values[2],
        request_hash: values[3],
        capability: values[4],
        previous_payload: values[5],
        proposed_payload: values[6],
        reason: values[7],
        status: "PENDING",
        requested_by: values[8],
        requested_by_name: values[9],
        requested_at: "2026-10-14T12:05:00.000Z",
        decided_by: null,
        decided_by_name: null,
        decided_at: null,
        decision_reason: null,
      };
      return this.request;
    }
    return null;
  }
  all(query: string, values: unknown[]) {
    if (query.includes("from private.integration_provider_configs"))
      return this.configurations.filter(row => row.capability === values[1]);
    if (query.includes("from private.integration_provider_change_requests")) return this.request ? [this.request] : [];
    return [];
  }
  run(query: string, values: unknown[]) {
    if (query.includes("update private.integration_provider_configs")) {
      const provider = this.configurations.find(row => row.provider_id === values[4] && row.capability === values[5]);
      if (provider) {
        provider.status = values[0] as Configuration["status"];
        provider.priority = Number(values[1]);
      }
    }
    if (query.includes("update private.integration_provider_change_requests") && this.request)
      this.request = {
        ...this.request,
        status: values[0],
        decided_by: values[1],
        decided_by_name: values[2],
        decided_at: values[3],
        decision_reason: values[4],
      };
  }
  async batch() {
    return [];
  }
  async exec() {}
  async transaction<T>(work: (database: DecisionDatabase) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const maker = { id: "maker", name: "Preparador" };
const checker = { id: "checker", name: "Aprovador" };
const proposal: IntegrationChangeProposal[] = [
  { providerId: "BRASIL_API", capability: "CNPJ_LOOKUP", status: "SUSPENDED", priority: 20 },
  { providerId: "RECEITA_WS", capability: "CNPJ_LOOKUP", status: "ACTIVE", priority: 10 },
];

describe("governança de provedores de integração", () => {
  it("congela a troca sem aplicar e remove configuração sensível do retrato", async () => {
    const db = new FakeDatabase();
    const request = await requestIntegrationProviderChange(
      db,
      "tenant-1",
      maker,
      "CNPJ_LOOKUP",
      proposal,
      "Troca homologada com plano de contingência",
      "command-integration-1",
    );

    expect(request.status).toBe("PENDING");
    expect(db.configurations.find(row => row.provider_id === "BRASIL_API")?.status).toBe("ACTIVE");
    expect(JSON.stringify(request)).not.toContain("segredo");
    await expect(
      decideIntegrationProviderChange(db, "tenant-1", maker, request.id, "APPROVED", "Conferido"),
    ).rejects.toThrow("solicitante");
  });

  it("aplica atomicamente estado e prioridade quando outra pessoa aprova", async () => {
    const db = new FakeDatabase();
    const request = await requestIntegrationProviderChange(
      db,
      "tenant-1",
      maker,
      "CNPJ_LOOKUP",
      proposal,
      "Troca homologada com plano de contingência",
      "command-integration-2",
    );
    const decided = await decideIntegrationProviderChange(
      db,
      "tenant-1",
      checker,
      request.id,
      "APPROVED",
      "Homologação conferida",
    );

    expect(decided.status).toBe("APPROVED");
    expect(db.configurations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider_id: "BRASIL_API", status: "SUSPENDED", priority: 20 }),
        expect.objectContaining({ provider_id: "RECEITA_WS", status: "ACTIVE", priority: 10 }),
      ]),
    );
  });

  it("recusa remoção de provedor, prioridade repetida e decisão sobre estado concorrente", async () => {
    const missing = new FakeDatabase();
    await expect(
      requestIntegrationProviderChange(
        missing,
        "tenant-1",
        maker,
        "CNPJ_LOOKUP",
        proposal.slice(0, 1),
        "Tentativa de remover provedor existente",
        "command-integration-3",
      ),
    ).rejects.toBeInstanceOf(IntegrationConfigurationConflictError);

    const duplicate = new FakeDatabase();
    await expect(
      requestIntegrationProviderChange(
        duplicate,
        "tenant-1",
        maker,
        "CNPJ_LOOKUP",
        proposal.map(item => ({ ...item, priority: 10 })),
        "Tentativa com prioridades duplicadas",
        "command-integration-4",
      ),
    ).rejects.toThrow("sem repetição");

    const stale = new FakeDatabase();
    const request = await requestIntegrationProviderChange(
      stale,
      "tenant-1",
      maker,
      "CNPJ_LOOKUP",
      proposal,
      "Troca homologada com plano de contingência",
      "command-integration-5",
    );
    stale.configurations[0].priority = 99;
    await expect(
      decideIntegrationProviderChange(stale, "tenant-1", checker, request.id, "APPROVED", "Conferido"),
    ).rejects.toThrow("mudou");
  });
});
