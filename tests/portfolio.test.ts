import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  addCollectionOccurrence,
  migratePortfolioState,
  portfolioBalance,
  portfolioDisplayStatus,
  seedPortfolio,
  syncPortfolio,
  updatePortfolioConfirmation,
} from "@/src/domain/portfolio/model";

describe("carteira operacional", () => {
  it("preserva todos os dados digitados ou importados quando a operação é liberada", () => {
    const source = initialOperations[0];
    const operation = {
      ...source,
      status: "Liberada ao financeiro" as const,
      commercialRepId: "rep-1",
      riskReview: {
        ...source.riskReview,
        titleDecisions: Object.fromEntries(
          (source.manualEntry?.entries ?? []).map(entry => [entry.id, "Aprovado" as const]),
        ),
      },
    };
    const state = seedPortfolio([operation]);
    const entry = operation.manualEntry!.entries[0];
    const title = state.titles.find(item => item.id === `${operation.id}-${entry.id}`)!;

    expect(title).toMatchObject({
      documentNumber: entry.documentNumber,
      originalAmount: entry.amount,
      dueDate: entry.dueDate,
      ownerName: operation.cedent,
      ownerDocument: operation.document,
      debtorName: entry.debtorName,
      debtorDocument: entry.debtorDocument,
      nfeKey: entry.nfeKey,
      ourNumber: entry.ourNumber,
      cfop: entry.cfop,
      observation: entry.observation,
      company: operation.vehicle,
      institution: operation.institution,
      proposal: operation.proposal,
      aditivoNumber: operation.aditivoNumber,
      borderoNumber: operation.borderoNumber,
      importSource: operation.source,
      operationType: operation.operationType,
      commercialRepId: "rep-1",
    });
  });

  it("sincroniza uma nova liberação sem duplicar nem sobrescrever manutenção", () => {
    const original = seedPortfolio(initialOperations);
    const maintained = {
      ...original,
      titles: original.titles.map((title, index) =>
        index === 0 ? { ...title, status: "Em cobrança" as const, observation: "Contato realizado" } : title,
      ),
    };
    const released = { ...initialOperations[0], status: "Liberada ao financeiro" as const };
    const synced = syncPortfolio(maintained, [released]);
    const syncedAgain = syncPortfolio(synced, [released]);

    expect(synced.titles[0]).toMatchObject({ status: "Em cobrança", observation: "Contato realizado" });
    expect(synced.titles.length).toBeGreaterThan(maintained.titles.length);
    expect(syncedAgain).toBe(synced);
  });

  it("calcula saldo e situação operacional a partir da posição persistida", () => {
    const title = {
      ...seedPortfolio(initialOperations).titles[0],
      originalAmount: 1000,
      paidAmount: 250,
      discountAmount: 50,
      abatementAmount: 100,
      dueDate: "2026-09-20",
    };

    expect(portfolioBalance(title)).toBe(600);
    expect(portfolioDisplayStatus(title, "2026-09-30")).toBe("Vencido");
    expect(portfolioDisplayStatus({ ...title, status: "Prorrogado" }, "2026-09-30")).toBe("Prorrogado");
  });

  it("mantém dados de pagamento e os estados operacionais solicitados", () => {
    const state = seedPortfolio(initialOperations);
    const paid = state.titles.find(title => title.status === "Pago")!;
    const partial = state.titles.find(title => title.status === "Liquidado parcial")!;

    expect(paid.payments[0]).toMatchObject({ amount: paid.originalAmount, date: "2026-09-25", bank: "Banco Itaú" });
    expect(portfolioBalance(paid)).toBe(0);
    expect(partial.payments[0]).toMatchObject({ amount: 6000, bank: "Banco Santander" });
    expect(portfolioBalance(partial)).toBe(partial.originalAmount - 6000);
    expect(state.titles.map(title => title.status)).toEqual(
      expect.arrayContaining(["Protestado", "Em cartório", "Recomprado", "Recomprado parcial"]),
    );
  });

  it("migra a carteira anterior para a estrutura com pagamentos sem perder os títulos", () => {
    const current = seedPortfolio(initialOperations);
    const legacy = {
      version: 1 as const,
      titles: current.titles.map(title => {
        const { payments: _payments, repurchasedAmount: _repurchasedAmount, ...old } = title;
        void _payments;
        void _repurchasedAmount;
        return { ...old, status: "Em aberto" as const };
      }),
    };
    const migrated = migratePortfolioState(legacy as never, initialOperations);

    expect(migrated.version).toBe(3);
    expect(migrated.titles).toHaveLength(current.titles.length);
    expect(migrated.titles.some(title => title.payments.length > 0)).toBe(true);
  });

  it("registra cobrança, agenda retorno e publica o evento no histórico", () => {
    const state = seedPortfolio(initialOperations);
    const title = state.titles.find(item => item.status === "Em aberto")!;
    const updated = addCollectionOccurrence(state, title.id, {
      id: "collection-test",
      chargedAt: "2026-09-30T10:00",
      channel: "WhatsApp",
      contactPerson: "Maria · Financeiro",
      outcome: "Promessa de pagamento",
      notes: "Cliente confirmou pagamento para sexta-feira.",
      nextContactAt: "2026-10-02T09:00",
      promiseDate: "2026-10-02",
      createdAt: "2026-09-30T10:01:00.000Z",
      createdBy: "Henrique",
    });
    const changed = updated.titles.find(item => item.id === title.id)!;

    expect(changed.status).toBe("Em cobrança");
    expect(changed.collectionOccurrences[0]).toMatchObject({
      channel: "WhatsApp",
      nextContactAt: "2026-10-02T09:00",
    });
    expect(changed.events.at(-1)).toMatchObject({ action: "Cobrança · WhatsApp", by: "Henrique" });
  });

  it("salva a confirmação da Controladoria com rastreabilidade", () => {
    const state = seedPortfolio(initialOperations);
    const title = state.titles[0];
    const updated = updatePortfolioConfirmation(state, title.id, {
      status: "Confirmado",
      contactedAt: "2026-09-30T11:00",
      channel: "Telefone",
      contactPerson: "Carlos · Compras",
      notes: "Entrega e valor reconhecidos pelo sacado.",
      updatedAt: "2026-09-30T11:05:00.000Z",
      updatedBy: "Henrique",
    });
    const changed = updated.titles.find(item => item.id === title.id)!;

    expect(changed.confirmation).toMatchObject({ status: "Confirmado", channel: "Telefone" });
    expect(changed.events.at(-1)?.action).toBe("Controladoria · Confirmado");
  });
});
