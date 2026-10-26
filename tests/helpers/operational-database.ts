/** Adaptador isolado para testar coordenação de repositórios, rollback e concorrência sem PostgreSQL real. */
import type { CommercialState } from "@/src/domain/commercial/types";
import type { Operation } from "@/src/domain/core/types";
import type { FinanceState } from "@/src/domain/finance/model";
import type { ReceivableRecord } from "@/src/domain/receivables/model";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";

type Row<T> = { payload: T; aggregate_version: number };
type CommandRow = { request_hash: string; result_payload: FinanceState; result_version: number };
const key = (tenant: unknown, id: unknown) => `${tenant}:${id}`;

export class OperationalDatabase implements DecisionDatabase {
  commercial = new Map<string, Row<CommercialState>>();
  commercialCommands = new Map<
    string,
    { request_hash: string; result_payload: CommercialState; result_version: number }
  >();
  failCommercial = false;
  operations = new Map<string, Row<Operation>>();
  finance = new Map<string, Row<FinanceState>>();
  receivables = new Map<string, Row<ReceivableRecord>>();
  commands = new Map<string, CommandRow>();
  portfolios = new Map<string, Row<PortfolioState>>();
  portfolioCommands = new Map<
    string,
    { request_hash: string; result_payload: PortfolioState; result_version: number }
  >();
  events: string[] = [];
  failFinance = false;
  failPortfolio = false;
  private queue = Promise.resolve();

  prepare(query: string): DecisionStatement {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind: (...parameters) => {
        values = parameters.map(value =>
          value && typeof value === "object" && "__stratoJson" in value
            ? (value as unknown as { value: unknown }).value
            : value,
        );
        return statement;
      },
      first: async <T>() => {
        if (query.includes("from private.commercial_commands"))
          return (this.commercialCommands.get(key(values[0], values[1])) as T) ?? null;
        if (query.includes("select payload, aggregate_version from private.commercial_states"))
          return (structuredClone(this.commercial.get(String(values[0]))) as T) ?? null;
        if (query.includes("insert into private.commercial_states")) {
          if (this.failCommercial) throw new Error("Falha simulada no armazenamento comercial");
          const tenant = String(values[0]);
          const previous = this.commercial.get(tenant);
          if (previous && previous.aggregate_version !== values[4]) return null;
          const row = {
            payload: structuredClone(values[1]) as CommercialState,
            aggregate_version: (previous?.aggregate_version ?? 0) + 1,
          };
          this.commercial.set(tenant, row);
          this.events.push(`commercial:${tenant}:${row.aggregate_version}`);
          return { ...structuredClone(row), event_id: String(values[6]) } as T;
        }
        if (query.includes("from private.portfolio_commands"))
          return (this.portfolioCommands.get(key(values[0], values[1])) as T) ?? null;
        if (query.includes("select payload, aggregate_version from private.portfolio_states"))
          return (structuredClone(this.portfolios.get(String(values[0]))) as T) ?? null;
        if (query.includes("select count(*)::integer as total from private.portfolio_titles")) return { total: 0 } as T;
        if (query.includes("insert into private.portfolio_states")) {
          if (this.failPortfolio) throw new Error("Falha simulada no armazenamento da carteira");
          const tenant = String(values[0]);
          const previous = this.portfolios.get(tenant);
          if (previous && previous.aggregate_version !== values[4]) return null;
          const row = {
            payload: structuredClone(values[1]) as PortfolioState,
            aggregate_version: (previous?.aggregate_version ?? 0) + 1,
          };
          this.portfolios.set(tenant, row);
          this.events.push(`portfolio:${tenant}:${row.aggregate_version}`);
          return { ...structuredClone(row), event_id: String(values[6]) } as T;
        }
        if (query.includes("from private.finance_commands"))
          return (this.commands.get(key(values[0], values[1])) as T) ?? null;
        if (query.includes("select payload, aggregate_version from private.finance_states"))
          return (structuredClone(this.finance.get(String(values[0]))) as T) ?? null;
        if (query.includes("select payload, aggregate_version from private.operations"))
          return (structuredClone(this.operations.get(key(values[0], values[1]))) as T) ?? null;
        if (query.includes("with previous as materialized")) {
          const id = key(values[2], values[3]);
          const previous = this.operations.get(id);
          if (previous && previous.aggregate_version !== values[14]) return null;
          const row = {
            payload: structuredClone(values[11]) as Operation,
            aggregate_version: (previous?.aggregate_version ?? 0) + 1,
          };
          this.operations.set(id, row);
          this.events.push(`operation:${id}:${row.aggregate_version}`);
          return structuredClone(row) as T;
        }
        if (query.includes("insert into private.finance_states")) {
          if (this.failFinance) throw new Error("Falha simulada no armazenamento financeiro");
          const tenant = String(values[0]);
          const previous = this.finance.get(tenant);
          if (previous && previous.aggregate_version !== values[9]) return null;
          const row = {
            payload: structuredClone(values[6]) as FinanceState,
            aggregate_version: (previous?.aggregate_version ?? 0) + 1,
          };
          this.finance.set(tenant, row);
          this.events.push(`finance:${tenant}:${row.aggregate_version}`);
          return { ...structuredClone(row), event_id: String(values[11]) } as T;
        }
        if (query.includes("select operation_id") && query.includes("from private.receivables")) {
          const conflict = [...this.receivables.entries()].find(
            ([id, row]) =>
              id.startsWith(`${values[0]}:`) && row.payload.canonicalKey === values[1] && row.payload.id !== values[2],
          );
          return conflict ? ({ operation_id: conflict[1].payload.operationId } as T) : null;
        }
        if (query.includes("insert into private.receivables")) {
          const id = key(values[0], values[1]);
          const previous = this.receivables.get(id);
          if (previous && JSON.stringify(previous.payload) === JSON.stringify(values[13])) return null;
          const row = {
            payload: structuredClone(values[13]) as ReceivableRecord,
            aggregate_version: (previous?.aggregate_version ?? 0) + 1,
          };
          this.receivables.set(id, row);
          return { aggregate_version: row.aggregate_version } as T;
        }
        throw new Error(`Consulta first não implementada no adaptador: ${query.slice(0, 90)}`);
      },
      all: async <T>() => {
        if (query.includes("with latest as") && query.includes("portfolio_title_positions"))
          return { results: [] as T[] };
        if (query.includes("select operation_id, vehicle from private.operations"))
          return {
            results: [...this.operations.entries()]
              .filter(([id]) => id.startsWith(`${values[0]}:`))
              .map(([, row]) => ({ operation_id: row.payload.id, vehicle: row.payload.vehicle })) as T[],
          };
        if (query.includes("from private.receivables"))
          return {
            results: [...this.receivables.entries()]
              .filter(
                ([id, row]) => id.startsWith(`${values[0]}:`) && (!values[1] || row.payload.operationId === values[1]),
              )
              .map(([, row]) => structuredClone(row)) as T[],
          };
        throw new Error(`Consulta all não implementada no adaptador: ${query.slice(0, 90)}`);
      },
      run: async () => {
        if (query.includes("insert into private.commercial_commands")) {
          this.commercialCommands.set(key(values[0], values[1]), {
            request_hash: String(values[2]),
            result_payload: structuredClone(values[5]) as CommercialState,
            result_version: Number(values[4]),
          });
          return { success: true };
        }
        if (/insert into private\.commercial_/.test(query)) return { success: true };
        if (query.includes("insert into private.portfolio_commands")) {
          this.portfolioCommands.set(key(values[0], values[1]), {
            request_hash: String(values[2]),
            result_payload: structuredClone(values[5]) as PortfolioState,
            result_version: Number(values[4]),
          });
          return { success: true };
        }
        if (query.includes("pg_advisory_xact_lock")) return { success: true };
        if (query.includes("insert into private.finance_commands")) {
          this.commands.set(key(values[0], values[1]), {
            request_hash: String(values[2]),
            result_payload: structuredClone(values[5]) as FinanceState,
            result_version: Number(values[4]),
          });
          return { success: true };
        }
        if (
          /insert into private\.(finance_|domain_|receivable_|fiscal_|portfolio_)/.test(query) ||
          /update private\.finance_/.test(query)
        )
          return { success: true };
        throw new Error(`Escrita não implementada no adaptador: ${query.slice(0, 90)}`);
      },
    };
    return statement;
  }

  async batch<T>(statements: DecisionStatement[]): Promise<T[]> {
    return (await Promise.all(statements.map(statement => statement.run()))) as T[];
  }

  async exec() {
    throw new Error("SQL livre não permitido no adaptador.");
  }

  async transaction<T>(work: (db: DecisionDatabase) => Promise<T>): Promise<T> {
    const prior = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => {
      release = resolve;
    });
    await prior;
    const before = structuredClone({
      commercial: this.commercial,
      commercialCommands: this.commercialCommands,
      operations: this.operations,
      finance: this.finance,
      receivables: this.receivables,
      commands: this.commands,
      portfolios: this.portfolios,
      portfolioCommands: this.portfolioCommands,
      events: this.events,
    });
    try {
      return await work({
        prepare: query => this.prepare(query),
        batch: statements => this.batch(statements),
        exec: () => this.exec(),
      });
    } catch (error) {
      Object.assign(this, before);
      throw error;
    } finally {
      release();
    }
  }
}
