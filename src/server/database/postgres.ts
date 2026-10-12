import postgres from "postgres";
import { type DecisionDatabase, type DecisionStatement } from "@/src/server/decisions/repository";

type QueryRow = Record<string, unknown>;
type QueryExecutor = {
  unsafe(query: string, parameters?: unknown[]): Promise<QueryRow[]>;
};

type JsonParameter = { readonly __stratoJson: true; readonly value: unknown };

export const jsonParameter = (value: unknown): JsonParameter => ({ __stratoJson: true, value });
const isJsonParameter = (value: unknown): value is JsonParameter =>
  typeof value === "object" && value !== null && "__stratoJson" in value;

function postgresPlaceholders(query: string) {
  let parameter = 0;
  return query.replace(/\?/g, () => `$${++parameter}`);
}

class PostgresStatement implements DecisionStatement {
  private values: unknown[] = [];

  constructor(
    private readonly executor: QueryExecutor,
    private readonly query: string,
    private readonly encodeJson: (value: unknown) => unknown,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async executeWith(executor: QueryExecutor) {
    return executor.unsafe(
      postgresPlaceholders(this.query),
      this.values.map(value => (isJsonParameter(value) ? this.encodeJson(value.value) : value)),
    );
  }

  async first<T = unknown>() {
    const rows = await this.executeWith(this.executor);
    return (rows[0] as T | undefined) ?? null;
  }

  async all<T = unknown>() {
    const rows = await this.executeWith(this.executor);
    return { results: rows as T[] };
  }

  async run() {
    await this.executeWith(this.executor);
    return { success: true };
  }
}

class PostgresDatabase implements DecisionDatabase {
  constructor(private readonly client: ReturnType<typeof postgres>) {}

  prepare(query: string) {
    return new PostgresStatement(this.client as unknown as QueryExecutor, query, value =>
      this.client.json(value as never),
    );
  }

  async batch<T = unknown>(statements: DecisionStatement[]) {
    const results = await this.client.begin(async transaction => {
      const executor = transaction as unknown as QueryExecutor;
      const results: unknown[] = [];
      for (const statement of statements) {
        if (!(statement instanceof PostgresStatement)) throw new Error("Comando de banco incompatível com PostgreSQL.");
        results.push(await statement.executeWith(executor));
      }
      return results;
    });
    return results as T[];
  }

  async exec(query: string) {
    return (this.client as unknown as QueryExecutor).unsafe(query);
  }
}

let database: PostgresDatabase | undefined;

export function getDatabase(): DecisionDatabase {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não foi configurada no servidor.");
  const client = postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
  });
  database = new PostgresDatabase(client);
  return database;
}
