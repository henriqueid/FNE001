import { describe, expect, it } from "vitest";
import { seedPortfolio, addCollectionOccurrence } from "@/src/domain/portfolio/model";
import { buildCollectionQueue } from "@/src/domain/portfolio/collection";

function fixture() {
  const state = seedPortfolio([]);
  const title = {
    ...state.titles[0],
    dueDate: "2026-09-01",
    status: "Em aberto" as const,
    originalAmount: 1000,
    openAmount: 1000,
    paidAmount: 0,
    repurchasedAmount: 0,
    collectionOccurrences: [],
  };
  state.titles = [title];
  return addCollectionOccurrence(state, title.id, {
    chargedAt: "2026-10-25T15:00",
    channel: "Outro",
    contactPerson: "CHURUME",
    outcome: "Promessa de pagamento",
    notes: "Teste",
    nextContactAt: "2026-10-28T09:00",
    promiseDate: "2026-10-28",
    createdAt: "2026-10-25T18:00:00Z",
    createdBy: "CHURUME",
  }).titles;
}

describe("cobrança com retorno futuro", () => {
  it("informa data futura sem esconder atraso e prioridade crítica", () => {
    const action = buildCollectionQueue(fixture(), "2026-10-25").find(item => item.queue === "cobranca");
    expect(action).toMatchObject({
      reason: "vencido",
      priority: "critica",
      detail: "Retorno agendado para 28/10/2026.",
    });
    expect(action?.daysLate).toBeGreaterThan(30);
  });
  it("mantém retorno do dia e promessa vencida nos dias seguintes", () => {
    expect(buildCollectionQueue(fixture(), "2026-10-28").find(item => item.queue === "cobranca")?.detail).toBe(
      "Retorno agendado para hoje.",
    );
    expect(buildCollectionQueue(fixture(), "2026-10-29")[0]).toMatchObject({
      reason: "promessa-vencida",
      priority: "critica",
    });
  });
});
