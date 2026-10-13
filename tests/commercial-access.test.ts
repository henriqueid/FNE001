import { seedCommercial } from "@/src/domain/commercial/seed";
import { CommercialScopeError, filterCommercialState, mergeCommercialScope } from "@/src/server/commercial/access";
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
