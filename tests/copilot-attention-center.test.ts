import { attentionItemHref, buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { describe, expect, it } from "vitest";
import { managerOf, repAt } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";

describe("Central do Dia", () => {
  it("unifica decisões, ritmo, liberações e cobrança na mesma fila", () => {
    const items = buildAttentionItems({
      operations: initialOperations,
      titles: portfolioTitles(initialOperations),
      user: demoAdminUser,
      referenceDate: "2026-10-10",
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.some(item => item.kind === "decision")).toBe(true);
    expect(items.some(item => item.kind === "collection")).toBe(true);
    expect(items[0].tone).toBe("critical");
  });

  it("remove automaticamente uma decisão depois que o bloqueio é resolvido", () => {
    const blocked = initialOperations.find(operation => operation.blockers > 0)!;
    const before = buildAttentionItems({
      operations: [blocked],
      titles: [],
      user: demoAdminUser,
      referenceDate: "2026-10-10",
    });
    const after = buildAttentionItems({
      operations: [{ ...blocked, blockers: 0, status: "Em andamento", elapsedMinutes: 10, clientAverageMinutes: 100 }],
      titles: [],
      user: demoAdminUser,
      referenceDate: "2026-10-10",
    });

    expect(before.some(item => item.kind === "decision")).toBe(true);
    expect(after.some(item => item.kind === "decision")).toBe(false);
  });

  it("cria um endereço para abrir a tarefa em outra aba", () => {
    const item = buildAttentionItems({
      operations: initialOperations,
      titles: [],
      user: demoAdminUser,
      referenceDate: "2026-10-10",
    })[0];
    const href = attentionItemHref(item);

    expect(href).toContain(`operation=${item.operation?.id}`);
    expect(href).toContain("attention=");
  });

  it("respeita o vínculo do agente ao cedente ao montar a fila", () => {
    const commercial = seedCommercial();
    const items = buildAttentionItems({
      operations: initialOperations,
      titles: portfolioTitles(initialOperations),
      user: {
        id: "user-rep-1",
        name: "Rafael Menezes",
        role: "Executivo comercial",
        department: "Comercial",
        access: "operator",
        responsibilities: ["Originação", "Relacionamento"],
        commercialRepId: "rep-1",
      },
      referenceDate: "2026-10-10",
      scope: {
        referenceDate: "2026-10-10",
        repOfCedent: (document, date) => repAt(commercial, document, date),
        managerOfCedent: document => managerOf(commercial, document),
      },
    });

    expect(items.some(item => item.operation)).toBe(true);
    expect(
      items
        .filter(item => item.operation)
        .every(item => repAt(commercial, item.operation!.document, "2026-10-10") === "rep-1"),
    ).toBe(true);
  });
});
