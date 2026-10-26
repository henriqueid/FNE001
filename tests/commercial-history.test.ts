import { seedCommercial } from "@/src/domain/commercial/seed";
import { attributeCommercialHistory } from "@/src/server/commercial/history";
import { describe, expect, it } from "vitest";

describe("autoria comercial no servidor", () => {
  it("preserva prefixo e atribui entradas novas à sessão autenticada", () => {
    const previous = seedCommercial("2026-10-13");
    previous.committees[0].status = "Em pauta";
    previous.committees[0].history = [{ at: "anterior", by: "Autor anterior", action: "Pauta", detail: "Original" }];
    previous.prospects[0].history = [];
    const next = structuredClone(previous);
    next.committees[0].history.push({ at: "forjado", by: "Forjado", action: "Decisão", detail: "Aprovado" });
    next.committees[0].status = "Aprovado";
    next.committees[0].decidedBy = "Forjado";
    next.prospects[0].history!.push({ at: "forjado", by: "Forjado", action: "Contato", detail: "Feito" });
    const saved = attributeCommercialHistory(previous, next, "Usuário autenticado", "2026-10-25T12:00:00.000Z");
    expect(saved.committees[0].history[0]).toEqual(previous.committees[0].history[0]);
    expect(saved.committees[0].history[1]).toMatchObject({ by: "Usuário autenticado", at: "2026-10-25T12:00:00.000Z" });
    expect(saved.prospects[0].history![0].by).toBe("Usuário autenticado");
    expect(saved.committees[0].decidedBy).toBe("Usuário autenticado");
    expect(next.committees[0].decidedBy).toBe("Forjado");
  });
});
