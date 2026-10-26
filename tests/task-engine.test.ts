import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  actionableAttentionItems,
  applyTaskCommand,
  rebaseTaskState,
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
  it("não conclui pendência durante carga incompleta das fontes", () => {
    const initial = reconcileTasks(seedTaskState(), [detected[0]], now);
    const loading = reconcileTasks(initial, [], "2026-10-10T12:01:00.000Z", { sourcesReady: false });
    expect(loading).toBe(initial);
    expect(loading.tasks[0].status).toBe("open");
    const loaded = reconcileTasks(loading, [detected[0]], "2026-10-10T12:02:00.000Z", { sourcesReady: true });
    expect(loaded.tasks[0].status).toBe("open");
    expect(loaded.tasks[0].history.some(entry => entry.action === "resolved")).toBe(false);
  });

  it("reabre conclusão automática quando a pendência continua existindo na origem", () => {
    const initial = reconcileTasks(seedTaskState(), [detected[0]], now);
    const resolved = reconcileTasks(initial, [], "2026-10-10T12:01:00.000Z");
    const recovered = reconcileTasks(resolved, [detected[0]], "2026-10-10T12:02:00.000Z");
    expect(recovered.tasks[0].status).toBe("open");
    expect(recovered.tasks[0].completedAt).toBeUndefined();
    expect(recovered.tasks[0].history.map(entry => entry.action)).toEqual(["created", "resolved", "reopened"]);
    expect(actionableAttentionItems(managedTasks(recovered, [detected[0]]), now)).toHaveLength(1);
  });

  it("preserva conclusão manual quando o alerta continua sendo detectado", () => {
    const initial = reconcileTasks(seedTaskState(), [detected[0]], now);
    const completed = applyTaskCommand(initial, detected[0].id, { type: "complete", by: "Henrique" }, now);
    expect(reconcileTasks(completed, [detected[0]], now).tasks[0].status).toBe("completed");
  });

  it("não sobrepõe conclusão manual concorrente com reabertura automática enfileirada", () => {
    const initial = reconcileTasks(seedTaskState(), [detected[0]], now);
    const resolved = reconcileTasks(initial, [], "2026-10-10T12:01:00.000Z");
    const recovered = reconcileTasks(resolved, [detected[0]], "2026-10-10T12:02:00.000Z");
    const manuallyCompleted = applyTaskCommand(
      resolved,
      detected[0].id,
      { type: "complete", by: "Henrique" },
      "2026-10-10T12:03:00.000Z",
    );
    const rebased = rebaseTaskState(resolved, recovered, manuallyCompleted);
    expect(rebased.tasks[0].status).toBe("completed");
    expect(rebased.tasks[0].history.at(-1)?.action).toBe("completed");
  });

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

  it("transfere uma tarefa delegada exclusivamente para a fila nominal do destinatário", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const id = initial.tasks[0].id;
    const delegated = applyTaskCommand(
      initial,
      id,
      {
        type: "assign",
        by: "Henrique",
        owner: "Marina Costa",
        ownerUserId: "user-marina",
        department: "Operações",
      },
      "2026-10-10T12:05:00.000Z",
    );
    const tasks = managedTasks(delegated, detected, now);
    const delegator = visibleTasksForUser(tasks, demoAdminUser);
    const recipient = visibleTasksForUser(tasks, {
      id: "user-marina",
      name: "Marina Costa",
      role: "Analista",
      department: "Operações",
      access: "operator",
      responsibilities: ["Operação"],
    });

    expect(delegator.some(task => task.id === id)).toBe(false);
    expect(recipient.some(task => task.id === id)).toBe(true);
    expect(actionableAttentionItems(recipient, now).some(task => task.id === id)).toBe(true);
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

  it("reaplica uma conclusão local sobre a versão mais recente sem apagar histórico concorrente", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const id = initial.tasks[0].id;
    const completed = applyTaskCommand(initial, id, { type: "complete", by: "Henrique" }, "2026-10-10T12:05:00.000Z");
    const concurrent = applyTaskCommand(
      initial,
      initial.tasks[1].id,
      { type: "start", by: "Marina Costa" },
      "2026-10-10T12:04:00.000Z",
    );
    const current = { ...concurrent, persistenceVersion: 8 };

    const rebased = rebaseTaskState(initial, completed, current);

    expect(rebased.persistenceVersion).toBe(8);
    expect(rebased.tasks.find(task => task.id === id)?.status).toBe("completed");
    expect(rebased.tasks.find(task => task.id === initial.tasks[1].id)?.status).toBe("in_progress");
  });

  it("preserva mudanças concorrentes na mesma tarefa e não reinsere tarefa que saiu da visão", () => {
    const initial = reconcileTasks(seedTaskState(), detected, now);
    const id = initial.tasks[0].id;
    const completed = applyTaskCommand(initial, id, { type: "complete", by: "Henrique" }, "2026-10-10T12:05:00.000Z");
    const concurrent = {
      ...initial,
      persistenceVersion: 9,
      tasks: initial.tasks.map(task => (task.id === id ? { ...task, dueAt: "2026-10-11T18:00:00.000Z" } : task)),
    };

    const rebased = rebaseTaskState(initial, completed, concurrent);
    expect(rebased.tasks.find(task => task.id === id)).toMatchObject({
      status: "completed",
      dueAt: "2026-10-11T18:00:00.000Z",
    });

    const noLongerVisible = { ...concurrent, tasks: concurrent.tasks.filter(task => task.id !== id) };
    expect(rebaseTaskState(initial, completed, noLongerVisible).tasks.some(task => task.id === id)).toBe(false);
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

  it("mostra tarefas de todas as áreas funcionais e inclui cobrança para Operações", () => {
    const state = reconcileTasks(seedTaskState(), detected, now);
    const tasks = managedTasks(state, detected, now);
    const synthetic = [
      ...tasks,
      {
        ...tasks[0],
        id: "cadastro-task",
        department: "Cadastro",
        operation: undefined,
      },
      {
        ...tasks[0],
        id: "collection-task",
        department: "Carteira e cobrança",
        operation: undefined,
      },
    ];
    const visible = visibleTasksForUser(synthetic, {
      id: "multi-area",
      name: "Analista",
      role: "Analista multifuncional",
      department: "Cadastro",
      functionalAreas: ["Cadastro", "Operações"],
      access: "operator",
      responsibilities: ["Cadastro", "Operação", "Cobrança"],
    });

    expect(visible.map(task => task.id)).toEqual(expect.arrayContaining(["cadastro-task", "collection-task"]));
  });
});
