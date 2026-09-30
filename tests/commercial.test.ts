import { describe, expect, it } from "vitest";
import { transferClient } from "@/src/domain/commercial/actions";
import { computeCommission, repAt, tierRate } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";

const TODAY = "2026-09-30";

describe("regras comerciais", () => {
  const state = seedCommercial(TODAY);

  it("faixa de comissão pelo atingimento da meta", () => {
    expect(tierRate(state.rules, 50)).toBe(3);
    expect(tierRate(state.rules, 85)).toBe(5);
    expect(tierRate(state.rules, 100)).toBe(7);
    expect(tierRate(state.rules, 130)).toBe(8);
  });
  it("transferência só muda o dono a partir da data", () => {
    const link = state.links[0];
    const other = state.reps.find(r => r.id !== link.repId)!;
    const moved = transferClient(state, link.id, other.id, "teste", "Teste").state;
    expect(repAt(moved, link.document, "2020-01-01")).toBe(link.repId);
    expect(repAt(moved, link.document, TODAY)).toBe(other.id);
  });
  it("comissão = base × faixa + bônus − estorno", () => {
    const month = TODAY.slice(0, 7);
    computeCommission(state, state.deals, month).forEach(line => {
      expect(line.total).toBeCloseTo(line.commission + line.bonus - line.clawback, 2);
    });
  });
  it("recompra registrada na carteira estorna a comissão do dono do cliente", () => {
    const month = TODAY.slice(0, 7);
    const link = state.links.find(l => state.deals.some(d => d.document === l.document && d.date.startsWith(month)))!;
    const withEvent = {
      ...state,
      carteiraEvents: [
        {
          kind: "Recompra" as const,
          document: link.document,
          clientName: link.clientName,
          date: TODAY,
          amount: 50_000,
          reference: "teste",
        },
      ],
    };
    const before = computeCommission(state, state.deals, month).find(l => l.repId === link.repId)!;
    const after = computeCommission(withEvent, state.deals, month).find(l => l.repId === link.repId)!;
    expect(after.clawback).toBeGreaterThan(before.clawback);
  });
});
