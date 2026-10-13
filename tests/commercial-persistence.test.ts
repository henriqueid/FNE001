import { validateCommercialState, validateCommercialTransition } from "@/src/domain/commercial/persistence";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { commercialRequestHash } from "@/src/server/commercial/repository";
import { describe, expect, it } from "vitest";

describe("persistência do ciclo Comercial", () => {
  it("recusa conversão sem decisão favorável do comitê", () => {
    const state = seedCommercial("2026-10-13");
    const prospect = state.prospects[0];
    const converted = {
      ...state,
      prospects: state.prospects.map(item =>
        item.id === prospect.id ? { ...item, stage: "Aprovado" as const, convertedAt: "2026-10-13" } : item,
      ),
    };

    expect(validateCommercialState(converted)).toContain("aprovação registrada");
  });

  it("preserva pauta, decisão e histórico do funil", () => {
    const state = seedCommercial("2026-10-13");
    const committee = state.committees[0];
    const prospect = state.prospects.find(item => (item.history?.length ?? 0) > 0) ?? state.prospects[0];
    const withoutCommittee = { ...state, committees: state.committees.filter(item => item.id !== committee.id) };
    const shortenedHistory = {
      ...state,
      prospects: state.prospects.map(item => (item.id === prospect.id ? { ...item, history: [] } : item)),
    };

    expect(validateCommercialTransition(state, withoutCommittee)).toContain("não pode ser apagado");
    if ((prospect.history?.length ?? 0) > 0)
      expect(validateCommercialTransition(state, shortenedHistory)).toContain("histórico do lead");
  });

  it("gera hash idempotente sem acoplar a projeções transitórias", async () => {
    const state = seedCommercial("2026-10-13");
    const base = await commercialRequestHash({ tenantId: "tenant", actorId: "actor", expectedVersion: 1, state });
    const transient = await commercialRequestHash({
      tenantId: "tenant",
      actorId: "actor",
      expectedVersion: 1,
      state: {
        ...state,
        persistenceVersion: 99,
        carteiraEvents: [
          {
            kind: "Recompra",
            document: "11222333000181",
            clientName: "Cliente",
            date: "2026-10-13",
            amount: 1_000,
            reference: "evento-calculado",
          },
        ],
      },
    });
    const changedVersion = await commercialRequestHash({
      tenantId: "tenant",
      actorId: "actor",
      expectedVersion: 2,
      state,
    });

    expect(base).toBe(transient);
    expect(base).not.toBe(changedVersion);
  });
});
