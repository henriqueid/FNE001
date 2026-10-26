/** Adaptador transacional isolado para testar o ledger de consumo da IA, sem conexões externas. */
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
export type BudgetEvent = {
  tenant_id: string;
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  event_type: string;
  actor_id: string;
  payload: Record<string, unknown>;
};
export class IntelligenceDatabase implements DecisionDatabase {
  row = {
    tenant_id: "tenant-a",
    contracted: true,
    enabled: true,
    status: "AI_AVAILABLE",
    monthly_token_budget: 100,
    used_tokens: 0,
    aggregate_version: 1,
    updated_at: new Date().toISOString(),
  };
  stateExists = true;
  members = [
    { user_id: "actor-a", name: "Ana", status: "active" },
    { user_id: "actor-b", name: "Bruno", status: "active" },
    { user_id: "admin", name: "Administrador", status: "active" },
    { user_id: "suspended", name: "Suspenso", status: "suspended" },
  ];
  events: BudgetEvent[] = [];
  failEvent = false;
  ambiguousCommit = false;
  private queue = Promise.resolve();
  async transaction<T>(work: (db: DecisionDatabase) => Promise<T>): Promise<T> {
    const prior = this.queue;
    let unlock!: () => void;
    this.queue = new Promise<void>(resolve => {
      unlock = resolve;
    });
    await prior;
    const existed = this.stateExists;
    const row = structuredClone(this.row),
      events = structuredClone(this.events);
    try {
      const scoped: DecisionDatabase = {
        prepare: query => this.prepare(query),
        batch: statements => this.batch(statements),
        exec: query => this.exec(query),
      };
      const result = await work(scoped);
      if (this.ambiguousCommit) {
        this.ambiguousCommit = false;
        unlock();
        throw new Error("Commit confirmado, resposta perdida");
      }
      return result;
    } catch (error) {
      if (!(error instanceof Error && error.message === "Commit confirmado, resposta perdida")) {
        Object.assign(this.row, row);
        this.stateExists = existed;
        this.events = events;
      }
      throw error;
    } finally {
      unlock();
    }
  }
  prepare(query: string): DecisionStatement {
    let values: unknown[] = [];
    const first = async () => {
      if (
        query.trimStart().startsWith("select") &&
        query.includes("from private.domain_events") &&
        !query.includes("select distinct on")
      ) {
        const rows = this.events
          .filter(
            event =>
              event.tenant_id === values[0] &&
              event.aggregate_type ===
                (query.includes("IntelligenceBudgetPeriod")
                  ? "IntelligenceBudgetPeriod"
                  : query.includes("IntelligenceBudgetPolicy")
                    ? "IntelligenceBudgetPolicy"
                    : "IntelligenceBudgetReservation") &&
              event.aggregate_id ===
                (query.includes("IntelligenceBudgetPeriod")
                  ? "UTC"
                  : query.includes("IntelligenceBudgetPolicy")
                    ? "monthly"
                    : values[1]),
          )
          .sort((a, b) => b.aggregate_version - a.aggregate_version);
        return structuredClone(rows[0] ?? null);
      }
      if (query.includes("from private.intelligence_states"))
        return this.stateExists && values[0] === this.row.tenant_id ? { ...this.row } : null;
      if (query.includes("used_tokens = used_tokens +")) {
        const amount = Number(values[0]);
        if (
          values[1] !== this.row.tenant_id ||
          !this.row.contracted ||
          !this.row.enabled ||
          this.row.used_tokens + amount > this.row.monthly_token_budget
        )
          return null;
        this.row.used_tokens += amount;
        return { ...this.row };
      }
      if (query.includes("used_tokens = used_tokens -")) {
        this.row.used_tokens -= Number(values[0]);
        return { ...this.row };
      }
      if (query.includes("set monthly_token_budget = ?")) {
        this.row.monthly_token_budget = Number(values[0]);
        this.row.aggregate_version++;
        return { ...this.row };
      }
      if (query.includes("update private.intelligence_states") && query.includes("contracted = ?")) {
        if (values[5] !== this.row.tenant_id || Number(values[6]) !== this.row.aggregate_version) return null;
        this.row.contracted = Boolean(values[0]);
        this.row.enabled = Boolean(values[1]);
        this.row.status = String(values[2]);
        this.row.monthly_token_budget = Number(values[3]);
        this.row.aggregate_version++;
        this.row.updated_at = new Date().toISOString();
        return { ...this.row };
      }
      if (query.includes("update private.intelligence_states")) {
        if (values[2] !== this.row.tenant_id) return null;
        this.row.used_tokens = Number(values[0]);
        this.row.aggregate_version++;
        this.row.updated_at = new Date().toISOString();
        return { ...this.row };
      }
      if (query.includes("insert into private.intelligence_states")) {
        if (query.includes("do nothing")) {
          if (this.stateExists) return null;
          Object.assign(this.row, {
            tenant_id: String(values[0]),
            contracted: Boolean(values[1]),
            enabled: Boolean(values[2]),
            status: String(values[3]),
            monthly_token_budget: Number(values[4]),
            used_tokens: 0,
            aggregate_version: 1,
            updated_at: new Date().toISOString(),
          });
          this.stateExists = true;
          return { ...this.row };
        }
        this.row.contracted = Boolean(values[1]);
        this.row.enabled = Boolean(values[2]);
        this.row.status = String(values[3]);
        this.row.monthly_token_budget = Number(values[4]);
        this.row.aggregate_version++;
        return { ...this.row };
      }
      throw new Error(`SQL não exercitado pelo adaptador: ${query}`);
    };
    const statement: DecisionStatement = {
      bind: (...parameters) => {
        values = parameters.map(value =>
          value && typeof value === "object" && "__stratoJson" in value
            ? (value as { __stratoJson: unknown; value?: unknown }).value
            : value,
        );
        return statement;
      },
      first: async <T>() => (await first()) as T | null,
      all: async <T>() => {
        if (query.includes("from private.access_users"))
          return { results: (values[0] === this.row.tenant_id ? this.members : []) as T[] };
        if (query.includes("select distinct on")) {
          const latest = new Map<string, BudgetEvent>();
          for (const event of this.events
            .filter(
              item =>
                item.tenant_id === values[0] &&
                item.aggregate_type === "IntelligenceBudgetReservation" &&
                item.payload.period === values[1],
            )
            .sort((a, b) => a.aggregate_version - b.aggregate_version))
            latest.set(event.aggregate_id, event);
          const usage = new Map<string, number>();
          for (const event of latest.values())
            usage.set(
              event.actor_id,
              (usage.get(event.actor_id) ?? 0) +
                Number(
                  event.event_type === "AI_TOKENS_SETTLED" ? event.payload.actualTokens : event.payload.reservedTokens,
                ),
            );
          return { results: [...usage].map(([user_id, used_tokens]) => ({ user_id, used_tokens })) as T[] };
        }
        return { results: [await first()].filter(Boolean) as T[] };
      },
      run: async () => {
        if (query.includes("insert into private.domain_events")) {
          if (this.failEvent) throw new Error("Falha ao gravar evento");
          const event: BudgetEvent = {
            tenant_id: String(values[0]),
            event_id: String(values[1]),
            aggregate_type: String(values[2]),
            aggregate_id: String(values[3]),
            aggregate_version: Number(values[4]),
            event_type: String(values[5]),
            actor_id: String(values[6]),
            payload: values[7] as Record<string, unknown>,
          };
          if (
            this.events.some(
              existing =>
                existing.tenant_id === event.tenant_id &&
                (existing.event_id === event.event_id ||
                  (existing.aggregate_type === event.aggregate_type &&
                    existing.aggregate_id === event.aggregate_id &&
                    existing.aggregate_version === event.aggregate_version)),
            )
          )
            throw new Error("Evento duplicado");
          this.events.push(structuredClone(event));
          return { success: true };
        }
        await first();
        return { success: true };
      },
    };
    return statement;
  }
  async batch<T>(statements: DecisionStatement[]): Promise<T[]> {
    const result: T[] = [];
    for (const statement of statements) result.push((await statement.first<T>()) as T);
    return result;
  }
  async exec(_query: string) {
    return undefined;
  }
}
