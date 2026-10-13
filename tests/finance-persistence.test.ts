import { describe, expect, it } from "vitest";
import { emptyFinance } from "@/src/domain/finance/setup";
import { validateFinanceState } from "@/src/domain/finance/persistence";
import { validateFinanceTransition } from "@/src/domain/finance/persistence";
import { financeRequestHash } from "@/src/server/finance/repository";
import { closeFinancePeriod } from "@/src/domain/finance/closing";
import { emptyState, openingEntries } from "@/src/domain/finance/ledger";

describe("persistência financeira", () => {
  it("aceita o estado financeiro vazio e consistente", () => {
    expect(validateFinanceState(emptyFinance())).toBeNull();
  });

  it("recusa lançamentos desbalanceados antes de acessar o banco", () => {
    const state = emptyFinance();
    state.journal.push({
      id: "LC-TESTE",
      date: "2026-10-12",
      company: "STRATO",
      history: "Teste",
      lines: [
        { ledger: "1.1.1.01", debit: 100, credit: 0 },
        { ledger: "3.1", debit: 0, credit: 99 },
      ],
      origin: { type: "Abertura", id: "teste" },
      createdAt: "2026-10-12T10:00:00.000Z",
      createdBy: "Teste",
    });
    expect(validateFinanceState(state)).toContain("desbalanceado");
  });

  it("recusa movimento sem conta bancária", () => {
    const state = emptyFinance();
    state.movements.push({
      id: "MB-TESTE",
      accountId: "inexistente",
      date: "2026-10-12",
      description: "Teste",
      amount: 10,
      kind: "Entrada",
      reconciled: false,
      history: [],
    });
    expect(validateFinanceState(state)).toBe("Conta bancária ausente no movimento MB-TESTE.");
  });

  it("gera assinatura idempotente sem depender da ordem das chaves nem da versão de leitura", async () => {
    const state = emptyFinance();
    const first = await financeRequestHash({
      tenantId: "tenant-a",
      actorId: "user-a",
      expectedVersion: 4,
      state: { ...state, persistenceVersion: 4, roles: { payables: "2.1.1", receivables: "1.1.3.01" } },
    });
    const same = await financeRequestHash({
      actorId: "user-a",
      state: { ...state, persistenceVersion: 999, roles: { receivables: "1.1.3.01", payables: "2.1.1" } },
      expectedVersion: 4,
      tenantId: "tenant-a",
    });
    const changed = await financeRequestHash({
      tenantId: "tenant-a",
      actorId: "user-a",
      expectedVersion: 5,
      state,
    });
    expect(same).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("fecha por data-base somente após a conciliação e bloqueia fatos retroativos", () => {
    const initial = openingEntries(emptyState("2026-09-01"));
    const account = initial.accounts[0];
    const withPending = {
      ...initial,
      movements: [
        {
          id: "MB-PENDENTE",
          accountId: account.id,
          date: "2026-09-15",
          description: "Movimento pendente",
          amount: 100,
          kind: "Entrada" as const,
          reconciled: false,
          history: [],
        },
      ],
    };
    expect(closeFinancePeriod(withPending, account.company, "2026-09-30", "Controladoria").error).toContain(
      "1 movimento(s) pendentes",
    );
    const reconciled = { ...withPending, movements: [{ ...withPending.movements[0], reconciled: true }] };
    const closed = closeFinancePeriod(reconciled, account.company, "2026-09-30", "Controladoria");
    expect(closed.error).toBeUndefined();
    expect(closed.state.periodClosures?.[0]).toMatchObject({ company: account.company, throughDate: "2026-09-30" });

    const retroactive = {
      ...closed.state,
      journal: [
        ...closed.state.journal,
        {
          id: "LC-RETROATIVO",
          date: "2026-09-20",
          company: account.company,
          history: "Não deve entrar",
          lines: [
            { ledger: "1.1.1.01", debit: 10, credit: 0 },
            { ledger: "3.1", debit: 0, credit: 10 },
          ],
          origin: { type: "Abertura" as const, id: "retroativo" },
          createdAt: "30/09/2026, 18:00",
          createdBy: "Teste",
        },
      ],
    };
    expect(validateFinanceTransition(closed.state, retroactive)).toContain("diário");
  });
});
