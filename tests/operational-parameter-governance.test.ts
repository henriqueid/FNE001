import {
  emptyOperationalDefaults,
  seedOperationalDefaults,
  validateOperationalDefaults,
  type OperationalDefaultsState,
} from "@/src/domain/registry/operational-profile";
import {
  decideOperationalParameterChange,
  OperationalParameterConflictError,
  operationalParameterRequestHash,
  requestOperationalParameterChange,
} from "@/src/server/registry/operational-parameter-requests";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { describe, expect, it } from "vitest";

const unwrap = (value: unknown) =>
  value && typeof value === "object" && "__stratoJson" in value
    ? (value as unknown as { value: unknown }).value
    : value;

class Statement implements DecisionStatement {
  values: unknown[] = [];
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
    return { results: this.database.all(this.query) as T[] };
  }
  async run() {
    this.database.run(this.query, this.values);
    return { success: true };
  }
}

class FakeDatabase implements DecisionDatabase {
  state?: OperationalDefaultsState;
  request?: Record<string, unknown>;
  prepares: string[] = [];

  prepare(query: string) {
    this.prepares.push(query);
    return new Statement(query, this);
  }
  first(query: string, values: unknown[]) {
    if (query.includes("from private.operational_parameter_states")) {
      if (!this.state) return null;
      return { payload: this.state, aggregate_version: this.state.persistenceVersion };
    }
    if (query.includes("where tenant_id = ? and command_id = ?")) return this.request ?? null;
    if (query.includes("for update")) return this.request ?? null;
    if (query.includes("with requested as")) {
      this.request = {
        change_id: values[1],
        request_hash: values[3],
        expected_version: values[4],
        previous_payload: values[5],
        proposed_payload: values[6],
        reason: values[7],
        status: "PENDING",
        requested_by: values[8],
        requested_by_name: values[9],
        requested_at: "2026-10-14T12:00:00.000Z",
        decided_by: null,
        decided_by_name: null,
        decided_at: null,
        decision_reason: null,
        applied_version: null,
      };
      return this.request;
    }
    if (query.includes("with saved as")) {
      const version = Number(values[4]) + 1;
      this.state = { ...(values[1] as OperationalDefaultsState), persistenceVersion: version };
      return { aggregate_version: version };
    }
    return null;
  }
  all(_query: string) {
    return [];
  }
  run(query: string, values: unknown[]) {
    if (query.includes("update private.operational_parameter_change_requests") && this.request)
      this.request = {
        ...this.request,
        status: values[0],
        decided_by: values[1],
        decided_by_name: values[2],
        decision_reason: values[4],
        applied_version: values[5],
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

describe("governança dos parâmetros operacionais", () => {
  it("valida relações materiais entre taxas, prazos, limites e metas", () => {
    const invalid = seedOperationalDefaults();
    invalid.general.minimumMonthlyRate = invalid.general.maximumMonthlyRate + 1;
    expect(validateOperationalDefaults(invalid)).toContain("taxa mensal");
    invalid.general.minimumMonthlyRate = 1;
    invalid.revenueGoals.consolidated.mes = -1;
    expect(validateOperationalDefaults(invalid)).toContain("Metas");
  });

  it("gera hash estável sem depender da versão de persistência", async () => {
    const left = seedOperationalDefaults();
    const right = { ...left, persistenceVersion: 9 };
    const base = { tenantId: "tenant-1", actorId: maker.id, expectedVersion: 0, reason: "Revisão anual aprovada" };
    expect(await operationalParameterRequestHash({ ...base, proposed: left })).toBe(
      await operationalParameterRequestHash({ ...base, proposed: right }),
    );
  });

  it("registra proposta sem aplicá-la e bloqueia a decisão do solicitante", async () => {
    const db = new FakeDatabase();
    const proposed = emptyOperationalDefaults();
    proposed.general.monthlyRate = 2.7;
    const hash = await operationalParameterRequestHash({
      tenantId: "tenant-1",
      actorId: maker.id,
      expectedVersion: 0,
      proposed,
      reason: "Atualização aprovada no comitê",
    });
    const request = await requestOperationalParameterChange(
      db,
      "tenant-1",
      maker,
      proposed,
      0,
      "Atualização aprovada no comitê",
      "command-123",
      hash,
    );
    expect(request.status).toBe("PENDING");
    expect(db.state).toBeUndefined();
    await expect(
      decideOperationalParameterChange(db, "tenant-1", maker, request.id, "APPROVED", "Conferido"),
    ).rejects.toThrow("solicitante");
  });

  it("permite a outra pessoa aplicar exatamente a proposta congelada em nova versão", async () => {
    const db = new FakeDatabase();
    const proposed = emptyOperationalDefaults();
    proposed.revenueGoals.consolidated.mes = 750_000;
    const reason = "Meta validada pelo planejamento financeiro";
    const hash = await operationalParameterRequestHash({
      tenantId: "tenant-1",
      actorId: maker.id,
      expectedVersion: 0,
      proposed,
      reason,
    });
    const request = await requestOperationalParameterChange(
      db,
      "tenant-1",
      maker,
      proposed,
      0,
      reason,
      "command-456",
      hash,
    );
    const effective = await decideOperationalParameterChange(
      db,
      "tenant-1",
      checker,
      request.id,
      "APPROVED",
      "Conferência concluída",
    );
    expect(effective?.persistenceVersion).toBe(1);
    expect(effective?.revenueGoals.consolidated.mes).toBe(750_000);
    expect(db.request?.status).toBe("APPROVED");
  });

  it("rejeita proposta criada sobre uma versão ultrapassada", async () => {
    const db = new FakeDatabase();
    db.state = { ...emptyOperationalDefaults(), persistenceVersion: 2 };
    const proposed = seedOperationalDefaults();
    const hash = await operationalParameterRequestHash({
      tenantId: "tenant-1",
      actorId: maker.id,
      expectedVersion: 1,
      proposed,
      reason: "Revisão de parâmetros vencida",
    });
    await expect(
      requestOperationalParameterChange(
        db,
        "tenant-1",
        maker,
        proposed,
        1,
        "Revisão de parâmetros vencida",
        "command-789",
        hash,
      ),
    ).rejects.toBeInstanceOf(OperationalParameterConflictError);
  });
});
