import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { seedAccessState } from "@/src/domain/access/model";
import { buildDailyBriefing } from "@/src/domain/copilot/daily-briefing";
import { managedTasks, reconcileTasks, seedTaskState } from "@/src/domain/tasks/model";
import { AttentionCenter } from "@/src/features/copilot/attention-center";

const fixture = () => {
  const user = {
    ...seedAccessState().users[0],
    id: "user-a",
    name: "Pessoa A",
    tenantIds: ["tenant-a"],
    companyScopes: ["Empresa A"],
  };
  const item = {
    id: "task-b",
    kind: "collection" as const,
    tone: "warning" as const,
    title: "Cobrança B",
    summary: "Resumo",
    detail: "Detalhe",
    impact: "900",
    nextAction: "Cobrar",
    owner: "Equipe",
    department: "Carteira e cobrança",
    timing: "Hoje",
    view: "portfolio" as const,
    company: "Empresa B",
    requiredPermission: "portfolio:manage" as const,
  };
  const state = reconcileTasks(seedTaskState(), [item], "2026-10-26T12:00:00Z");
  const briefing = buildDailyBriefing({
    user,
    operations: [],
    financials: {},
    titles: [],
    referenceDate: "2026-10-26",
    revenueTarget: 0,
  });
  return { user, items: managedTasks(state, [item]), briefing };
};

describe("Central do Dia sem destinatário incompatível", () => {
  it("desabilita assumir/delegar quando ninguém tem a empresa da tarefa", () => {
    const { user, items, briefing } = fixture();
    const html = renderToStaticMarkup(
      createElement(AttentionCenter, {
        items,
        briefing,
        currentUser: user,
        assignees: [user],
        tenantId: "tenant-a",
        onClose: vi.fn(),
        onOpenTask: vi.fn(),
        onTaskCommand: vi.fn(),
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Assumir<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Delegar<\/button>/);
    expect(html).toContain("Nenhum destinatário compatível");
  });
  it("não inventa destinatário a partir do perfil atual quando lista vazia", () => {
    const { user, items, briefing } = fixture();
    const html = renderToStaticMarkup(
      createElement(AttentionCenter, {
        items,
        briefing,
        currentUser: user,
        assignees: [],
        tenantId: "tenant-a",
        onClose: vi.fn(),
        onOpenTask: vi.fn(),
        onTaskCommand: vi.fn(),
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Delegar<\/button>/);
  });
});
