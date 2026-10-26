import { seedCommercial } from "@/src/domain/commercial/seed";
import {
  authorizeCommercialTransition,
  CommercialScopeError,
  filterCommercialState,
  mergeCommercialScope,
} from "@/src/server/commercial/access";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { describe, expect, it } from "vitest";

const principal = (patch: Partial<ServerPrincipal> = {}) =>
  ({
    access: "operator",
    permissions: ["dashboard:view", "portfolio:manage"],
    commercialRepId: "rep-1",
    ...patch,
  }) as ServerPrincipal;

describe("segmentação do Comercial", () => {
  it("mostra ao executivo somente a própria carteira comercial", () => {
    const full = seedCommercial("2026-10-13");
    const scoped = filterCommercialState(full, principal());

    expect(scoped.prospects.every(item => item.repId === "rep-1")).toBe(true);
    expect(scoped.committees.every(item => item.repId === "rep-1")).toBe(true);
    expect(scoped.visits.every(item => item.repId === "rep-1")).toBe(true);
    expect(scoped.reps.map(item => item.id)).toEqual(["rep-1"]);
    expect(scoped.prospects.length).toBeLessThan(full.prospects.length);
  });

  it("preserva registros ocultos ao recompor uma alteração segmentada", () => {
    const full = seedCommercial("2026-10-13");
    const scoped = filterCommercialState(full, principal());
    const own = scoped.prospects[0];
    const changed = {
      ...scoped,
      prospects: scoped.prospects.map(item =>
        item.id === own.id ? { ...item, nextStep: "Contato confirmado" } : item,
      ),
    };
    const merged = mergeCommercialScope(full, changed, principal());

    expect(merged.prospects.find(item => item.id === own.id)?.nextStep).toBe("Contato confirmado");
    for (const hidden of full.prospects.filter(item => item.repId !== "rep-1"))
      expect(merged.prospects.find(item => item.id === hidden.id)).toEqual(hidden);
    expect(merged.reps).toEqual(full.reps);
    expect(merged.closings).toEqual(full.closings);
  });

  it("recusa a injeção de lead pertencente a outro executivo", () => {
    const full = seedCommercial("2026-10-13");
    const scoped = filterCommercialState(full, principal());
    const foreign = full.prospects.find(item => item.repId !== "rep-1")!;

    expect(() =>
      mergeCommercialScope(full, { ...scoped, prospects: [...scoped.prospects, foreign] }, principal()),
    ).toThrow(CommercialScopeError);
  });

  it("mantém visão consolidada para gestores e risco", () => {
    const full = seedCommercial("2026-10-13");

    expect(filterCommercialState(full, principal({ access: "manager", permissions: ["users:manage"] }))).toBe(full);
    expect(filterCommercialState(full, principal({ permissions: ["risk:decide"] }))).toBe(full);
  });
});

describe("autorização de decisões comerciais", () => {
  it("recusa novo comitê já aprovado sem alçada de risco", () => {
    const previous = seedCommercial("2026-10-13");
    const next = structuredClone(previous);
    next.committees.push({ ...next.committees[0], id: "forjado", status: "Aprovado", approved: 100 });
    expect(() => authorizeCommercialTransition(previous, next, principal())).toThrow("alçada de risco");
  });

  it("recusa edição direta do limite mesmo com alçada sem nova decisão correspondente", () => {
    const previous = seedCommercial("2026-10-13");
    const next = structuredClone(previous);
    next.links[0].approvedLimit += 1;
    expect(() => authorizeCommercialTransition(previous, next, principal({ permissions: ["risk:decide"] }))).toThrow(
      "decisão",
    );
  });

  it("recusa novo vínculo com limite sem alçada", () => {
    const previous = seedCommercial("2026-10-13");
    const next = structuredClone(previous);
    next.links.push({ ...next.links[0], id: "forjado" });
    expect(() => authorizeCommercialTransition(previous, next, principal())).toThrow("alçada de risco");
  });

  it("aceita limite exato derivado de nova decisão de aumento", () => {
    const previous = seedCommercial("2026-10-13");
    const next = structuredClone(previous);
    const link = next.links[0];
    next.committees.push({
      ...next.committees[0],
      id: "nova-decisao",
      status: "Aprovado",
      request: "Aumento de limite",
      document: link.document,
      clientName: link.clientName,
      approved: 100,
    });
    link.approvedLimit += 100;
    expect(() =>
      authorizeCommercialTransition(previous, next, principal({ permissions: ["risk:decide"] })),
    ).not.toThrow();
  });
});

it("recusa apropriar ID de lead oculto para carteira visível", () => {
  const previous = seedCommercial("2026-10-13");
  const scoped = filterCommercialState(previous, principal());
  const foreign = previous.prospects.find(item => item.repId !== "rep-1")!;
  scoped.prospects.push({ ...foreign, repId: "rep-1" });
  expect(() => mergeCommercialScope(previous, scoped, principal())).toThrow("fora da sua carteira");
});

it("permite submeter taxa proposta sem registrar decisão de risco", () => {
  const previous = seedCommercial("2026-10-13");
  const next = structuredClone(previous);
  next.committees.push({
    ...next.committees[0],
    id: "nova-pauta",
    status: "Em pauta",
    approved: undefined,
    decidedAt: undefined,
    decidedBy: undefined,
    conditions: undefined,
    riskOpinion: undefined,
    rate: 2.5,
  });
  expect(() => authorizeCommercialTransition(previous, next, principal())).not.toThrow();
});

it("recusa envio de comissão pelo snapshot genérico", () => {
  const previous = seedCommercial("2026-10-13");
  const next = structuredClone(previous);
  next.closings["2026-10"] = {
    month: "2026-10",
    status: "Enviada ao financeiro",
    closedAt: "2026-10-25",
    closedBy: "Gestor",
    lines: [],
    rules: next.rules,
  };
  expect(() => authorizeCommercialTransition(previous, next, principal())).toThrow("comando específico");
});

it("recusa ampliar carteira por vínculo novo com documento de carteira oculta", () => {
  const previous = seedCommercial("2026-10-13");
  const scoped = structuredClone(filterCommercialState(previous, principal()));
  const foreign = previous.links.find(link => link.repId !== "rep-1" && link.managerId !== "rep-1")!;
  scoped.links.push({ ...foreign, id: "vinculo-forjado", repId: "rep-1", managerId: undefined, approvedLimit: 0 });
  expect(() => mergeCommercialScope(previous, scoped, principal())).toThrow("fora da sua carteira");
});
