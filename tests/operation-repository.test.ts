import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { saveOperation } from "@/src/server/operations/repository";

class Statement implements DecisionStatement {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly database: RecordingDatabase,
  ) {}

  bind(...values: unknown[]) {
    this.values = values.map(value =>
      value && typeof value === "object" && "__stratoJson" in value
        ? (value as unknown as { value: unknown }).value
        : value,
    );
    return this;
  }

  async first<T>() {
    if (!this.query.includes("with previous as materialized")) return null;
    this.database.operationStatement = this.query;
    return { payload: this.values[11], aggregate_version: 1 } as T;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async run() {
    return { success: true };
  }
}

class RecordingDatabase implements DecisionDatabase {
  operationStatement = "";

  prepare(query: string) {
    return new Statement(query, this);
  }

  async batch() {
    return [];
  }

  async exec() {}

  async transaction<T>(work: (database: DecisionDatabase) => Promise<T>): Promise<T> {
    return work(this);
  }
}

describe("repositório de operações", () => {
  it("tipa o identificador textual no payload da outbox para o PostgreSQL", async () => {
    const database = new RecordingDatabase();
    const source = initialOperations[0];
    const operation = {
      ...source,
      titleCount: 0,
      manualEntry: source.manualEntry ? { ...source.manualEntry, entries: [] } : undefined,
    };

    const saved = await saveOperation(database, "tenant-1", "user-1", operation, 0);

    expect(saved?.persistenceVersion).toBe(1);
    expect(database.operationStatement).toContain("'operationId', ?::text");
  });
});
