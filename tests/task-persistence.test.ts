import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import { demoAdminUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { applyTaskCommand, reconcileTasks, seedTaskState, type TaskState } from "@/src/domain/tasks/model";
import { validateTaskState, validateTaskTransition } from "@/src/domain/tasks/persistence";
import { taskRequestHash } from "@/src/server/tasks/repository";
import { describe, expect, it } from "vitest";

const now = "2026-10-13T12:00:00.000Z";
const detected = buildAttentionItems({
  operations: initialOperations,
  titles: [],
  user: demoAdminUser,
  referenceDate: "2026-10-13",
});

const initial = () => reconcileTasks(seedTaskState(), detected.slice(0, 2), now);

describe("persistência de tarefas", () => {
  it("reconciliação de tarefa adiada e reabertura preservam estado e trilha válidos", () => {
    const state = initial();
    const snoozed = applyTaskCommand(
      state,
      state.tasks[0].id,
      { type: "snooze", by: "Henrique", until: "2026-10-14T12:00:00.000Z" },
      now,
    );
    const resolved = reconcileTasks(snoozed, [], "2026-10-13T12:01:00.000Z");
    expect(validateTaskState(resolved)).toBeNull();
    expect(validateTaskTransition(snoozed, resolved, "Henrique")).toBeNull();
    const reopened = reconcileTasks(resolved, detected.slice(0, 2), "2026-10-13T12:02:00.000Z");
    expect(validateTaskState(reopened)).toBeNull();
    expect(validateTaskTransition(resolved, reopened, "Henrique")).toBeNull();
  });
  it("valida o agregado e aceita histórico novo produzido pelo ator da sessão", () => {
    const state = initial();
    const next = applyTaskCommand(
      state,
      state.tasks[0].id,
      { type: "complete", by: "Henrique", note: "Conferência concluída." },
      "2026-10-13T12:10:00.000Z",
    );

    expect(validateTaskState(next)).toBeNull();
    expect(validateTaskTransition(state, next, "Henrique")).toBeNull();
  });

  it("recusa exclusão, reescrita do histórico e autoria incompatível com a sessão", () => {
    const state = initial();
    const removed: TaskState = { ...state, tasks: state.tasks.slice(1) };
    const rewritten: TaskState = {
      ...state,
      tasks: state.tasks.map((task, index) =>
        index ? task : { ...task, history: [{ ...task.history[0], detail: "Histórico adulterado." }] },
      ),
    };
    const spoofed = applyTaskCommand(
      state,
      state.tasks[0].id,
      { type: "complete", by: "Outra pessoa" },
      "2026-10-13T12:10:00.000Z",
    );

    expect(validateTaskTransition(state, removed, "Henrique")).toContain("não pode ser removida");
    expect(validateTaskTransition(state, rewritten, "Henrique")).toContain("não pode ser reescrito");
    expect(validateTaskTransition(state, spoofed, "Henrique")).toContain("não corresponde à sessão");
  });

  it("produz hash estável e ignora somente a versão de persistência", async () => {
    const state = initial();
    const left = await taskRequestHash({ tenantId: "tenant", actorId: "actor", expectedVersion: 1, state });
    const right = await taskRequestHash({
      state: { ...state, persistenceVersion: 99 },
      expectedVersion: 1,
      actorId: "actor",
      tenantId: "tenant",
    });
    const changed = await taskRequestHash({ tenantId: "tenant", actorId: "actor", expectedVersion: 2, state });

    expect(left).toBe(right);
    expect(left).not.toBe(changed);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });
});
