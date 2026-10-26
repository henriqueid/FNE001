import { taskAssigneeError } from "@/src/domain/tasks/assignment";
import type { AccessUser } from "@/src/domain/access/model";
import { describe, expect, it } from "vitest";
import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { applyTaskCommand, reconcileTasks, seedTaskState } from "@/src/domain/tasks/model";
import { validateTaskState, validateTaskTransition } from "@/src/domain/tasks/persistence";
import { taskVisibleTo } from "@/src/server/tasks/access";
import { listPublishedNotifications } from "@/src/server/outbox/publisher";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { PortfolioTitle } from "@/src/domain/home/metrics";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

const now = "2026-10-26T12:00:00.000Z";
const titles = [
  { id: "a", ownerDocument: "11", dueDate: "2026-10-01", amount: 100, vehicle: "Empresa A" },
  { id: "b", ownerDocument: "22", dueDate: "2026-10-01", amount: 900, vehicle: "Empresa B" },
] as PortfolioTitle[];
const detected = () =>
  buildAttentionItems({ operations: [], titles, user: demoAdminUser, referenceDate: "2026-10-26" });
const initial = () => reconcileTasks(seedTaskState(), detected(), now);
const principal = {
  id: "finance-a",
  name: "Financeiro A",
  role: "Operador",
  department: "Financeiro",
  status: "active",
  tenantId: "tenant-a",
  access: "operator",
  functionalAreas: ["Financeiro"],
  companyScopes: ["Empresa A"],
  permissions: ["dashboard:view", "portfolio:manage"],
  authorityIds: [],
} as ServerPrincipal;

describe("regressões Churume de tarefas", () => {
  it("F03 particiona vencidos por empresa sem entregar exposição de B ao usuário de A", () => {
    const state = initial();
    expect(state.tasks).toHaveLength(2);
    const visible = state.tasks.filter(task => taskVisibleTo(task, principal, new Map()));
    expect(visible).toHaveLength(1);
    expect(visible[0].snapshot.impact).toContain("100");
    expect(visible[0].snapshot.impact).not.toContain("900");
  });
  it("F03 não entrega agregado legado sem empresa ao usuário restrito", () => {
    const task = initial().tasks[0];
    const legacy = { ...task, id: "portfolio-overdue", snapshot: { ...task.snapshot, company: undefined } };
    expect(taskVisibleTo(legacy, principal, new Map())).toBe(false);
  });
  it("F07 preserva conclusão humana mas reabre novo episódio após resolução na origem", () => {
    const before = initial();
    const complete = applyTaskCommand(before, before.tasks[0].id, { type: "complete", by: "Pessoa" }, now);
    expect(reconcileTasks(complete, detected(), now).tasks[0].status).toBe("completed");
    const absent = reconcileTasks(complete, [], "2026-10-27T12:00:00Z");
    const again = reconcileTasks(absent, detected(), "2026-10-28T12:00:00Z");
    expect(again.tasks[0].status).toBe("open");
    expect(again.tasks[0].history.some(event => event.action === "completed" && event.by === "Pessoa")).toBe(true);
  });
  it("F10 rejeita conclusão ou responsável trocado sem evento correspondente", () => {
    const before = initial();
    const after = structuredClone(before);
    after.tasks[0].status = "completed";
    after.tasks[0].completedAt = now;
    after.tasks[0].owner = "Outro";
    expect(validateTaskTransition(before, after, "Pessoa")).not.toBeNull();
  });
  it("corpo de tarefa parcial resulta em validação recusada, sem exceção", () => {
    expect(validateTaskState({ version: 1, tasks: [null] } as never)).not.toBeNull();
  });
  it("F09 aplica limite depois do recorte autorizado", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      notification_id: `n-${index}`,
      vehicle: index === 100 ? "Empresa A" : "Empresa B",
      department: "Financeiro",
      required_permission: null,
      authority_id: null,
    }));
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async all() {
            return { results: /LIMIT 100/.test(sql) ? rows.slice(0, 100) : rows };
          },
        };
      },
    } as unknown as DecisionDatabase;
    const result = await listPublishedNotifications(db, "tenant-a", principal);
    expect(result.map(item => item.id)).toEqual(["n-100"]);
  });
});

describe("episódios e permissões de tarefas históricas", () => {
  it("reabre carteira da empresa quando outro título passa a vencer entre duas leituras", () => {
    const before = initial();
    const complete = applyTaskCommand(before, before.tasks[0].id, { type: "complete", by: "Pessoa" }, now);
    const nextItems = buildAttentionItems({
      operations: [],
      titles: [{ ...titles[0], id: "new-overdue" }, titles[1]],
      user: demoAdminUser,
      referenceDate: "2026-10-26",
    });
    const next = reconcileTasks(complete, nextItems, now);
    expect(next.tasks[0].status).toBe("open");
    expect(next.tasks[0].history.filter(event => event.action === "completed")).toHaveLength(1);
  });
  it("nega resumo operacional legado após revogação de módulo, mesmo para usuário da área", () => {
    const user = { ...principal, functionalAreas: ["Operações"], permissions: ["dashboard:view"] } as ServerPrincipal;
    const task = {
      ...initial().tasks[0],
      id: "legacy-op",
      department: "Operações",
      snapshot: { ...initial().tasks[0].snapshot, view: "operations" as const, requiredPermission: undefined },
    };
    expect(taskVisibleTo(task, user, new Map())).toBe(false);
  });
  it("não aceita campo de data com tipo diferente de string", () => {
    const state = initial();
    state.tasks[0].dueAt = [2026] as never;
    expect(validateTaskState(state)).not.toBeNull();
  });
});

it("mantém conclusão humana quando só um título deixa a carteira vencida", () => {
  const both = buildAttentionItems({
    operations: [],
    titles: [titles[0], { ...titles[0], id: "second" }],
    user: demoAdminUser,
    referenceDate: "2026-10-26",
  });
  const state = reconcileTasks(seedTaskState(), both, now);
  const completed = applyTaskCommand(state, state.tasks[0].id, { type: "complete", by: "Pessoa" }, now);
  const remaining = buildAttentionItems({
    operations: [],
    titles: [titles[0]],
    user: demoAdminUser,
    referenceDate: "2026-10-26",
  });
  expect(reconcileTasks(completed, remaining, now).tasks[0].status).toBe("completed");
});

it("F04 validador também recusa snapshot alterado junto com conclusão legítima", () => {
  const before = initial();
  const after = structuredClone(applyTaskCommand(before, before.tasks[0].id, { type: "complete", by: "Pessoa" }, now));
  after.tasks[0].snapshot.company = "Empresa B";
  expect(validateTaskTransition(before, after, "Pessoa")).not.toBeNull();
});

it("destinatário precisa tanto do módulo quanto da alçada exigida pelo aviso", () => {
  const item = {
    company: "Empresa A",
    view: "operations" as const,
    requiredPermission: "risk:decide" as const,
    authorityId: "credit-director",
  };
  const user = {
    ...principal,
    tenantIds: ["tenant-a"],
    responsibilities: [],
    email: "churume@local.test",
    permissions: ["dashboard:view", "risk:decide"],
    authorityIds: ["credit-director"],
  } as AccessUser;
  expect(taskAssigneeError(item, user, "tenant-a")).not.toBeNull();
  user.permissions.push("operations:view");
  expect(taskAssigneeError(item, user, "tenant-a")).toBeNull();
  user.authorityIds = [];
  expect(taskAssigneeError(item, user, "tenant-a")).not.toBeNull();
});

it("destinatário nominal inválido é recusado na validação de corpo", () => {
  const state = initial();
  state.tasks[0].ownerUserId = {} as never;
  expect(validateTaskState(state)).not.toBeNull();
});

import { actionableAttentionItems, managedTasks, visibleTasksForUser } from "@/src/domain/tasks/model";
it("preserva metadados de empresa e autorização até o sino", () => {
  const state = initial();
  const tasks = managedTasks(state, detected());
  const actionable = actionableAttentionItems(tasks, now);
  expect(actionable[0].company).toBe("Empresa A");
  expect(actionable[0].requiredPermission).toBe("portfolio:manage");
});
it("prévia nominal filtra empresa antes de apresentar tarefas da mesma área", () => {
  const tasks = managedTasks(initial(), detected());
  const visible = visibleTasksForUser(tasks, { ...principal, responsibilities: [] });
  expect(visible).toHaveLength(1);
  expect(visible[0].company).toBe("Empresa A");
});
