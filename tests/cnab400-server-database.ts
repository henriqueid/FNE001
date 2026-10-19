/** Double SQL específico: repositórios reais, transações reais em memória e nenhum serviço externo. */
import { OperationalDatabase } from "./helpers/operational-database";
import type { DecisionStatement } from "@/src/server/decisions/repository";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { Party } from "@/src/domain/registry/parties";
export class BankingDatabase extends OperationalDatabase {
  portfolio = new Map<string, { payload: PortfolioState; aggregate_version: number }>();
  bankEvents: { tenant: string; type: string; id: string; payload: Record<string, unknown> }[] = [];
  parties = new Map<string, Party>();
  failPortfolio = false;
  override prepare(query: string): DecisionStatement {
    const parent = super.prepare(query);
    let v: unknown[] = [];
    const s: DecisionStatement = {
      bind: (...values) => {
        v = values.map(x =>
          x && typeof x === "object" && "__stratoJson" in x ? (x as unknown as { value: unknown }).value : x,
        );
        parent.bind(...values);
        return s;
      },
      first: async <T>() => {
        if (query.includes("from private.domain_events"))
          return (
            this.bankEvents.find(e => e.tenant === v[0] && e.type === v[1] && e.id === v[2])
              ? { payload: this.bankEvents.find(e => e.tenant === v[0] && e.type === v[1] && e.id === v[2])!.payload }
              : null
          ) as T | null;
        if (query.includes("from private.registry_parties"))
          return (this.parties.has(String(v[1])) ? { payload: this.parties.get(String(v[1])) } : null) as T | null;
        if (query.includes("select payload, aggregate_version from private.portfolio_states"))
          return (structuredClone(this.portfolio.get(String(v[0]))) ?? null) as T | null;
        if (query.includes("from private.portfolio_commands")) return null;
        if (query.includes("count(*)") && query.includes("portfolio_titles")) return { total: 0 } as T;
        if (query.includes("insert into private.portfolio_states")) {
          if (this.failPortfolio) throw new Error("Falha de carteira");
          const prior = this.portfolio.get(String(v[0]));
          if (prior && prior.aggregate_version !== v[4]) return null;
          const row = {
            payload: structuredClone(v[1]) as PortfolioState,
            aggregate_version: (prior?.aggregate_version ?? 0) + 1,
          };
          this.portfolio.set(String(v[0]), row);
          return { ...row, event_id: String(v[6]) } as T;
        }
        return parent.first<T>();
      },
      all: async <T>() => {
        if (query.includes("from private.domain_events"))
          return {
            results: this.bankEvents
              .filter(e => e.tenant === v[0] && e.type === v[1] && e.payload.accountId === v[2])
              .map(e => ({ payload: e.payload })) as T[],
          };
        if (query.includes("with latest as")) return { results: [] };
        return parent.all<T>();
      },
      run: async () => {
        if (query.includes("insert into private.domain_events")) {
          if (this.bankEvents.some(e => e.tenant === v[0] && e.type === v[2] && e.id === v[3]))
            throw new Error("Evento duplicado");
          this.bankEvents.push({
            tenant: String(v[0]),
            type: String(v[2]),
            id: String(v[3]),
            payload: structuredClone(v[6]) as Record<string, unknown>,
          });
          return { success: true };
        }
        if (/insert into private.portfolio_/.test(query)) return { success: true };
        return parent.run();
      },
    };
    return s;
  }
  override async transaction<T>(work: Parameters<OperationalDatabase["transaction"]>[0]): Promise<T> {
    return super.transaction(async tx => {
      const before = structuredClone({ portfolio: this.portfolio, bankEvents: this.bankEvents });
      try {
        return (await work(tx)) as T;
      } catch (error) {
        Object.assign(this, before);
        throw error;
      }
    }) as Promise<T>;
  }
}
