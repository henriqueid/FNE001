import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  actionableAttentionItems,
  applyTaskCommand,
  managedTasks,
  reconcileTasks,
  seedTaskState,
  visibleTasksForUser,
} from "@/src/domain/tasks/model";
import { describe, expect, it } from "vitest";

const now = "2026-10-10T12:00:00.000Z";
const detected = buildAttentionItems({
  operations: initialOperations,
  titles: [],
  user: demoAdminUser,
  referenceDate: "2026-10-10",
});

describe("motor de tarefas", () => {
  it("transforma alertas automáticos em tarefas persistentes", () => {
    const state = reconcileTasks(seedTaskState(), detected, now);
    const tasks = managedTasks(state, detected);

    expect(tasks).toHaveLength(detected.length);
    expect(tasks[0].status).toBe("open");
    expect(tasks[0].history[0].action).toBe("created");
  });

  it("assume, delega, adia e conclui preservando o histórico", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const id = initial.tasks[0].id;
    const assigned = applyTaskCommand(
      initial,
      id,
      { type: "assign", by: "Henrique", owner: "Marina Costa", department: "Operações" },
      "2026-10-10T12:05:00.000Z",
    );
    const snoozed = applyTaskCommand(
      assigned,
      id,
      { type: "snooze", by: "Marina Costa", until: "2026-10-11T12:00:00.000Z" },
      "2026-10-10T12:10:00.000Z",
    );
    const completed = applyTaskCommand(
      snoozed,
      id,
      { type: "complete", by: "Marina Costa", note: "Bloqueio revisado." },
      "2026-10-10T12:20:00.000Z",
    );

    expect(completed.tasks[0]).toMatchObject({ status: "completed", owner: "Marina Costa" });
    expect(completed.tasks[0].history.map(entry => entry.action)).toEqual([
      "created",
      "assigned",
      "snoozed",
      "completed",
    ]);
  });

  it("retira tarefas adiadas e concluídas dos alertas acionáveis", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const first = initial.tasks[0].id;
    const second = initial.tasks[1].id;
    const snoozed = applyTaskCommand(
      initial,
      first,
      { type: "snooze", by: "Henrique", until: "2026-10-11T12:00:00.000Z" },
      now,
    );
    const completed = applyTaskCommand(snoozed, second, { type: "complete", by: "Henrique" }, now);
    const actionable = actionableAttentionItems(managedTasks(completed, detected), now);

    expect(actionable.some(item => item.id === first)).toBe(false);
    expect(actionable.some(item => item.id === second)).toBe(false);
  });

  it("reativa o lembrete quando chega o horário definido", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const id = initial.tasks[0].id;
    const snoozed = applyTaskCommand(
      initial,
      id,
      { type: "snooze", by: "Henrique", until: "2026-10-10T13:00:00.000Z" },
      now,
    );
    const before = managedTasks(snoozed, detected, "2026-10-10T12:59:00.000Z");
    const after = managedTasks(snoozed, detected, "2026-10-10T13:00:00.000Z");

    expect(before.find(task => task.id === id)?.status).toBe("snoozed");
    expect(after.find(task => task.id === id)?.status).toBe("open");
  });

  it("conclui automaticamente quando a pendência desaparece na origem", () => {
    const initial = reconcileTasks(seedTaskState(), [detected[0]], now);
    const resolved = reconcileTasks(initial, [], "2026-10-10T13:00:00.000Z");

    expect(resolved.tasks[0].status).toBe("completed");
    expect(resolved.tasks[0].history.at(-1)?.action).toBe("resolved");
  });

  it("não expõe tarefas históricas fora da carteira nominal do usuário", () => {
    const state = reconcileTasks(seedTaskState(), detected, now);
    const tasks = managedTasks(state, detected, now);
    const allowedDocument = detected.find(item => item.operation)?.operation?.document;
    const visible = visibleTasksForUser(tasks, {
      id: "user-conta",
      name: "Responsável da conta",
      role: "Especialista",
      department: "Operações",
      access: "operator",
      responsibilities: ["Conta vinculada"],
      cedentDocuments: allowedDocument ? [allowedDocument] : [],
    });

    expect(visible.some(task => task.operation?.document === allowedDocument)).toBe(true);
    expect(visible.filter(task => task.operation).every(task => task.operation?.document === allowedDocument)).toBe(
      true,
    );
  });
});
