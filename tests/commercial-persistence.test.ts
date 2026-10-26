import { validateCommercialState, validateCommercialTransition } from "@/src/domain/commercial/persistence";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { authorizeCommercialTransition } from "@/src/server/commercial/access";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { commercialRequestHash, saveCommercialState } from "@/src/server/commercial/repository";
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

describe("imutabilidade comercial", () => {
  it.each(["committees", "prospects"] as const)("recusa reescrita do prefixo de %s", key => {
    const previous = seedCommercial("2026-10-13");
    previous[key][0].history = [{ at: "2026-10-13", by: "Original", action: "Registro", detail: "Original" }];
    const next = structuredClone(previous);
    next[key][0].history![0].by = "Forjado";
    expect(validateCommercialTransition(previous, next)).toContain("histórico");
  });

  it("recusa reescrita de decisão já registrada", () => {
    const previous = seedCommercial("2026-10-13");
    previous.committees[0].status = "Aprovado";
    previous.committees[0].approved = 100;
    const next = structuredClone(previous);
    next.committees[0].approved = 200;
    expect(validateCommercialTransition(previous, next)).toContain("decisão");
  });
});

it("recusa limite não finito e ID de vínculo duplicado", () => {
  const state = seedCommercial("2026-10-13");
  state.links[0].approvedLimit = Number.NaN;
  expect(validateCommercialState(state)).toContain("limite");
  state.links[0].approvedLimit = 10;
  state.links.push({ ...state.links[0] });
  expect(validateCommercialState(state)).toContain("duplicados");
});

it("preserva dossiê e histórico mesmo após conversão", () => {
  const state = seedCommercial("2026-10-13");
  state.prospects[0].convertedAt = "2026-10-13";
  const next = { ...state, prospects: state.prospects.slice(1) };
  expect(validateCommercialTransition(state, next)).toContain("histórico");
});

it("exige parecer em aprovação nova e preserva aprovação legada", () => {
  const previous = seedCommercial("2026-10-13");
  const next = structuredClone(previous);
  const committee = next.committees.find(item => item.status === "Em pauta")!;
  committee.status = "Aprovado";
  committee.riskOpinion = "  ";
  expect(validateCommercialTransition(previous, next)).toContain("parecer de risco");
  committee.riskOpinion = "Capacidade de pagamento verificada.";
  expect(validateCommercialTransition(previous, next)).toBeNull();
});

it("revalida alçada e limite contra estado lido dentro da gravação", async () => {
  const previous = seedCommercial("2026-10-13");
  previous.persistenceVersion = 2;
  const next = structuredClone(previous);
  const link = next.links[0];
  next.committees.push({
    ...next.committees[0],
    id: "nova-decisao",
    status: "Aprovado",
    request: "Aumento de limite",
    document: link.document,
    approved: 100,
    riskOpinion: "Verificado.",
  });
  link.approvedLimit += 100;
  previous.links[0].approvedLimit += 50;
  const db = {
    prepare: (query: string) => ({
      bind: () => ({
        first: async () => (query.includes("commercial_states") ? { payload: previous, aggregate_version: 2 } : null),
      }),
    }),
  } as unknown as DecisionDatabase;
  await expect(
    saveCommercialState(db, "tenant", "actor", "Risco", next, 2, "command-id", "hash", (current, candidate) =>
      authorizeCommercialTransition(current, candidate, {
        access: "operator",
        permissions: ["risk:decide"],
      } as ServerPrincipal),
    ),
  ).rejects.toThrow("diverge");
});
