import { attentionItemHref, attentionItemOperation, buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { describe, expect, it } from "vitest";
import { managerOf, repAt } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { actionableAttentionItems, managedTasks, reconcileTasks, seedTaskState } from "@/src/domain/tasks/model";

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

  it("mantém avisos de carteira na carteira mesmo quando carregam uma operação de contexto", () => {
    const operation = initialOperations[0];
    const item = {
      id: "portfolio-overdue",
      kind: "collection",
      tone: "warning",
      title: "Inadimplência pede acompanhamento",
      summary: "Há títulos vencidos.",
      detail: "A carteira requer cobrança.",
      impact: "Exposição vencida",
      nextAction: "Acompanhar inadimplência",
      owner: "Cobrança",
      department: "Carteira e cobrança",
      timing: "Hoje",
      view: "portfolio",
      operation,
    } satisfies ReturnType<typeof buildAttentionItems>[number];

    expect(attentionItemOperation(item)).toBeUndefined();
    expect(attentionItemHref(item)).toBe("/?view=portfolio&attention=portfolio-overdue");
  });

  it("preserva o destino da tarefa durante criação, persistência e reabertura", () => {
    const now = "2026-10-14T12:00:00.000Z";
    const operation = initialOperations[0];
    const item = {
      id: "portfolio-follow-up",
      kind: "collection",
      tone: "warning",
      title: "Acompanhar inadimplência",
      summary: "A carteira requer acompanhamento.",
      detail: "Há recebíveis vencidos.",
      impact: "Exposição vencida",
      nextAction: "Abrir carteira",
      owner: "Cobrança",
      department: "Carteira e cobrança",
      timing: "Hoje",
      view: "portfolio",
      operation,
    } satisfies ReturnType<typeof buildAttentionItems>[number];

    const state = reconcileTasks(seedTaskState(), [item], now);
    const managed = managedTasks(state, [item], now);
    const reopened = actionableAttentionItems(managed, now)[0];

    expect(state.tasks[0].snapshot).toMatchObject({ view: "portfolio", operationId: operation.id });
    expect(reopened.view).toBe("portfolio");
    expect(attentionItemOperation(reopened)).toBeUndefined();
    expect(attentionItemHref(reopened)).toBe("/?view=portfolio&attention=portfolio-follow-up");
  });

  it("usa a operação como destino somente em tarefas declaradas para Operações", () => {
    const operation = initialOperations[0];
    const base = {
      id: "task-destination",
      kind: "release",
      tone: "good",
      title: "Pronta para avançar",
      summary: "Validações concluídas.",
      detail: "Conferir o próximo passo.",
      impact: "Fluxo disponível",
      nextAction: "Abrir contexto",
      owner: "Responsável",
      department: "Operações",
      timing: "Hoje",
      operation,
    } as const;

    expect(attentionItemOperation({ ...base, view: "operations" })).toBe(operation);
    expect(attentionItemOperation({ ...base, view: "finance" })).toBeUndefined();
    expect(attentionItemOperation({ ...base, view: "portfolio" })).toBeUndefined();
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
