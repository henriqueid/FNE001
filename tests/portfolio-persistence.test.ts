import { addCollectionOccurrence, seedPortfolio, updatePortfolioConfirmation } from "@/src/domain/portfolio/model";
import { validatePortfolioState, validatePortfolioTransition } from "@/src/domain/portfolio/persistence";
import { portfolioRequestHash } from "@/src/server/portfolio/repository";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { describe, expect, it } from "vitest";

const actor = "Henrique";

describe("persistência da manutenção da Carteira", () => {
  it("aceita cobrança e confirmação com autoria da sessão", () => {
    const state = seedPortfolio(initialOperations);
    const title = state.titles[0];
    const charged = addCollectionOccurrence(state, title.id, {
      chargedAt: "2026-10-13T12:00:00.000Z",
      channel: "Telefone",
      contactPerson: "Financeiro",
      outcome: "Contato realizado",
      notes: "Sacado confirmou o recebimento do boleto.",
      nextContactAt: "2026-10-15T12:00:00.000Z",
      createdAt: "2026-10-13T12:05:00.000Z",
      createdBy: actor,
    });
    const confirmed = updatePortfolioConfirmation(charged, title.id, {
      status: "Confirmado",
      contactedAt: "2026-10-13T12:10:00.000Z",
      channel: "Telefone",
      notes: "Lastro confirmado com o sacado.",
      updatedAt: "2026-10-13T12:11:00.000Z",
      updatedBy: actor,
    });

    expect(validatePortfolioState(confirmed)).toBeNull();
    expect(validatePortfolioTransition(state, confirmed, actor)).toBeNull();
  });

  it("recusa remoção, reescrita da origem e autoria falsa", () => {
    const state = seedPortfolio(initialOperations);
    const title = state.titles[0];
    const removed = { ...state, titles: state.titles.slice(1) };
    const rewritten = {
      ...state,
      titles: state.titles.map(item => (item.id === title.id ? { ...item, debtorDocument: "00000000000000" } : item)),
    };
    const spoofed = addCollectionOccurrence(state, title.id, {
      chargedAt: "2026-10-13T12:00:00.000Z",
      channel: "Telefone",
      contactPerson: "Financeiro",
      outcome: "Sem resposta",
      notes: "Tentativa sem sucesso.",
      nextContactAt: "2026-10-15T12:00:00.000Z",
      createdAt: "2026-10-13T12:05:00.000Z",
      createdBy: "Outra pessoa",
    });

    expect(validatePortfolioTransition(state, removed, actor)).toContain("não pode ser removido");
    expect(validatePortfolioTransition(state, rewritten, actor)).toContain("origem");
    expect(validatePortfolioTransition(state, spoofed, actor)).toContain("não corresponde à sessão");
  });

  it("gera hash estável ignorando apenas a versão de persistência", async () => {
    const state = seedPortfolio(initialOperations);
    const left = await portfolioRequestHash({ tenantId: "tenant", actorId: "actor", expectedVersion: 1, state });
    const right = await portfolioRequestHash({
      tenantId: "tenant",
      actorId: "actor",
      expectedVersion: 1,
      state: { ...state, persistenceVersion: 99 },
    });
    const changed = await portfolioRequestHash({ tenantId: "tenant", actorId: "actor", expectedVersion: 2, state });
    expect(left).toBe(right);
    expect(left).not.toBe(changed);
  });
});
