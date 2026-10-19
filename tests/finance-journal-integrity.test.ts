/** Regressões de reescrita de fatos, vínculos de estorno e importação do plano financeiro. */
import { describe, expect, it } from "vitest";
import { applyChartImport, buildMapping } from "@/src/domain/finance/chart-import";
import { closeFinancePeriod } from "@/src/domain/finance/closing";
import { post, reverseEntry } from "@/src/domain/finance/ledger";
import type { JournalEntry } from "@/src/domain/finance/model";
import { validateFinanceState, validateFinanceTransition } from "@/src/domain/finance/persistence";
import { emptyFinance } from "@/src/domain/finance/setup";

const journalState = () => {
  const state = emptyFinance();
  post(
    state,
    {
      date: "2026-10-18",
      company: "Empresa A",
      history: "Recebimento registrado",
      origin: { type: "Título", id: "CR-1" },
      lines: [
        { ledger: "1.1.1.01", debit: 100, credit: 0 },
        { ledger: "4.1.02", debit: 0, credit: 100 },
      ],
    },
    "Operador A",
  );
  return state;
};

describe("integridade do diário financeiro em período aberto", () => {
  it.each<[string, (entry: JournalEntry) => void]>([
    [
      "valor balanceado",
      entry => {
        entry.lines[0].debit = 900;
        entry.lines[1].credit = 900;
      },
    ],
    [
      "conta contábil",
      entry => {
        entry.lines[0].ledger = "1.1.3.01";
      },
    ],
    [
      "empresa",
      entry => {
        entry.company = "Empresa B";
      },
    ],
    [
      "data",
      entry => {
        entry.date = "2026-10-19";
      },
    ],
    [
      "histórico",
      entry => {
        entry.history = "Histórico reescrito";
      },
    ],
    [
      "origem",
      entry => {
        entry.origin.id = "CR-OUTRO";
      },
    ],
    [
      "autor",
      entry => {
        entry.createdBy = "Outro operador";
      },
    ],
    [
      "data de registro",
      entry => {
        entry.createdAt = "2026-10-19T12:00:00Z";
      },
    ],
  ])("recusa reescrita de %s em lançamento existente", (_field, mutate) => {
    const previous = journalState();
    const next = structuredClone(previous);
    mutate(next.journal[0]);

    expect(validateFinanceState(next)).toBeNull();
    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it("recusa remover ou trocar o identificador de um lançamento", () => {
    const previous = journalState();
    const removed = { ...previous, journal: [] };
    const replaced = structuredClone(previous);
    replaced.journal[0].id = "LC-SUBSTITUIDO";

    expect(validateFinanceTransition(previous, removed)).not.toBeNull();
    expect(validateFinanceTransition(previous, replaced)).not.toBeNull();
  });

  it("aceita um novo lançamento sem alterar o anterior", () => {
    const previous = journalState();
    const next = structuredClone(previous);
    post(
      next,
      {
        date: "2026-10-19",
        company: "Empresa A",
        history: "Novo recebimento",
        origin: { type: "Título", id: "CR-2" },
        lines: [
          { ledger: "1.1.1.01", debit: 50, credit: 0 },
          { ledger: "4.1.02", debit: 0, credit: 50 },
        ],
      },
      "Operador B",
    );

    expect(validateFinanceState(next)).toBeNull();
    expect(validateFinanceTransition(previous, next)).toBeNull();
  });

  it("aceita o mesmo lançamento após reordenação das chaves pelo JSONB", () => {
    const previous = journalState();
    const next = structuredClone(previous);
    const entry = next.journal[0];
    entry.origin = { id: entry.origin.id, type: entry.origin.type };
    entry.lines = entry.lines.map(line => ({ credit: line.credit, debit: line.debit, ledger: line.ledger }));

    expect(validateFinanceTransition(previous, next)).toBeNull();
  });

  it("aceita estorno por contrapartida sem reescrever o lançamento original", () => {
    const previous = journalState();
    const next = structuredClone(previous);
    const reversalId = reverseEntry(next, previous.journal[0].id, "2026-10-19", "Correção", "Operador B");

    expect(reversalId).toBeDefined();
    expect(next.journal[1].lines).toEqual([
      { ledger: "1.1.1.01", debit: 0, credit: 100 },
      { ledger: "4.1.02", debit: 100, credit: 0 },
    ]);
    expect(validateFinanceState(next)).toBeNull();
    expect(validateFinanceTransition(previous, next)).toBeNull();
  });

  it("permite estornar em período aberto um lançamento de período fechado", () => {
    const closed = closeFinancePeriod(journalState(), "Empresa A", "2026-10-18", "Controladoria");
    expect(closed.error).toBeUndefined();
    const next = structuredClone(closed.state);
    reverseEntry(next, next.journal[0].id, "2026-10-19", "Correção posterior", "Operador B");

    expect(validateFinanceState(next)).toBeNull();
    expect(validateFinanceTransition(closed.state, next)).toBeNull();
  });

  it("recusa vincular o estorno a um lançamento que não é sua contrapartida", () => {
    const previous = journalState();
    const next = structuredClone(previous);
    post(
      next,
      {
        date: "2026-10-19",
        company: "Empresa A",
        history: "Outro fato",
        origin: { type: "Título", id: "CR-2" },
        lines: [
          { ledger: "1.1.1.01", debit: 50, credit: 0 },
          { ledger: "4.1.02", debit: 0, credit: 50 },
        ],
      },
      "Operador B",
    );
    next.journal[0].reversedBy = next.journal[1].id;

    expect(validateFinanceTransition(previous, next)).not.toBeNull();
  });

  it.each(["valor", "empresa", "conta contábil", "vínculo de origem"])(
    "recusa contrapartida com %s incorreto",
    field => {
      const previous = journalState();
      const next = structuredClone(previous);
      reverseEntry(next, previous.journal[0].id, "2026-10-19", "Correção", "Operador B");
      const reversal = next.journal[1];
      if (field === "valor") {
        reversal.lines[0].credit = 90;
        reversal.lines[1].debit = 90;
      }
      if (field === "empresa") reversal.company = "Empresa B";
      if (field === "conta contábil") reversal.lines[0].ledger = "1.1.3.01";
      if (field === "vínculo de origem") reversal.reversalOf = undefined;

      expect(validateFinanceState(next)).not.toBeNull();
      expect(validateFinanceTransition(previous, next)).not.toBeNull();
    },
  );

  it("recusa apagar ou substituir o vínculo de um estorno já registrado", () => {
    const previous = journalState();
    reverseEntry(previous, previous.journal[0].id, "2026-10-19", "Correção", "Operador B");
    const removed = structuredClone(previous);
    removed.journal[0].reversedBy = undefined;
    const replaced = structuredClone(previous);
    replaced.journal[0].reversedBy = replaced.journal[0].id;

    expect(validateFinanceTransition(previous, removed)).not.toBeNull();
    expect(validateFinanceTransition(previous, replaced)).not.toBeNull();
  });
});

describe("importação de plano preserva o diário", () => {
  it("recusa de-para que reescreve contas de lançamentos registrados", () => {
    const state = journalState();
    const before = structuredClone(state);
    const target = state.chart.map(account => (account.code === "4.1.02" ? { ...account, code: "4.1.99" } : account));
    const mapping = Object.fromEntries(
      buildMapping(state, target).map(row => [row.from, row.from === "4.1.02" ? "4.1.99" : row.from]),
    );
    const result = applyChartImport(
      state,
      { accounts: target, mode: "substituir", mapping, file: "plano.csv" },
      "Gestor",
    );

    expect(result.error).toBeDefined();
    expect(result.state).toBe(state);
    expect(state).toEqual(before);
  });

  it("permite acrescentar contas sem reescrever o histórico", () => {
    const state = journalState();
    const result = applyChartImport(
      state,
      {
        accounts: [{ code: "4.1.99", name: "Nova receita", nature: "Receita", analytic: true }],
        mode: "acrescentar",
        mapping: {},
        file: "novas-contas.csv",
      },
      "Gestor",
    );

    expect(result.error).toBeUndefined();
    expect(result.state.chart.some(account => account.code === "4.1.99")).toBe(true);
    expect(result.state.journal).toEqual(state.journal);
    expect(validateFinanceTransition(state, result.state)).toBeNull();
  });

  it("permite substituir o plano preservando os códigos do diário", () => {
    const state = journalState();
    const mapping = Object.fromEntries(buildMapping(state, state.chart).map(row => [row.from, row.from]));
    const result = applyChartImport(
      state,
      {
        accounts: state.chart,
        mode: "substituir",
        mapping,
        file: "plano-preservado.csv",
      },
      "Gestor",
    );

    expect(result.error).toBeUndefined();
    expect(result.state.chartOrigin).toBe("importado");
    expect(result.state.journal).toEqual(state.journal);
    expect(validateFinanceTransition(state, result.state)).toBeNull();
  });
});
