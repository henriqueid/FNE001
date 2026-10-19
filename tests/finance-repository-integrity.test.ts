/** Exercita a recusa de reescrita pelo repositório antes de qualquer tentativa de escrita no banco. */
import { describe, expect, it } from "vitest";
import { emptyState, openingEntries } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { FinanceTransitionError, saveFinanceState } from "@/src/server/finance/repository";

function databaseWithFinance(state: FinanceState) {
  const writes: string[] = [];
  const unexpectedWrite = (query: string): never => {
    writes.push(query);
    throw new Error("O comando tentou gravar antes de recusar a alteração do diário.");
  };
  const db: DecisionDatabase = {
    prepare(query) {
      const statement: DecisionStatement = {
        bind: () => statement,
        async first<T>() {
          if (query.includes("from private.finance_commands")) return null;
          if (query.includes("select payload, aggregate_version from private.finance_states"))
            return { payload: structuredClone(state), aggregate_version: 1 } as T;
          return unexpectedWrite(query);
        },
        async all() {
          throw new Error("Consulta inesperada.");
        },
        async run() {
          if (query.includes("pg_advisory_xact_lock")) return { success: true };
          return unexpectedWrite(query);
        },
      };
      return statement;
    },
    async batch() {
      return unexpectedWrite("batch");
    },
    async exec(query) {
      return unexpectedWrite(query);
    },
    async transaction(work) {
      return work(db);
    },
  };
  return { db, writes };
}

describe("barreira de integridade na persistência financeira", () => {
  it.each(["reescrita", "remoção"])(
    "recusa %s de lançamento antes de gravar snapshot, projeções ou eventos",
    async action => {
      const previous = openingEntries(emptyState("2026-10-18"));
      const { db, writes } = databaseWithFinance(previous);
      const next = structuredClone(previous);
      if (action === "remoção") next.journal.shift();
      else {
        next.journal[0].lines[0].debit += 100;
        next.journal[0].lines[1].credit += 100;
      }

      await expect(
        saveFinanceState(db, "tenant-a", "operador-a", next, 1, "comando-teste", "hash-teste"),
      ).rejects.toBeInstanceOf(FinanceTransitionError);
      expect(writes).toEqual([]);
    },
  );
});
