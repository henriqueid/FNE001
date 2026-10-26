import { taskSnoozeError } from "@/src/domain/tasks/assignment";
import {
  applyTaskCommand,
  reconcileTasks,
  returnTaskToQueue,
  taskIsExplicitlyAssigned,
  seedTaskState,
  taskFactsEqual,
  type TaskCommand,
  type TaskRecord,
  type TaskState,
} from "@/src/domain/tasks/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { operationCompanyMap } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { syncTaskState, taskAssignmentError, taskSyncVisibleTo } from "./access";
import { loadTaskAssignee } from "./assignees";
import { loadTaskState, replayedTaskCommand, saveTaskState, taskRequestHash, TaskTransitionError } from "./repository";
import { loadAutomaticTaskSources } from "./sources";

export class TaskScopeError extends Error {}
export class TaskSourcesError extends Error {}

const same = taskFactsEqual;

async function locked<T>(db: DecisionDatabase, tenantId: string, work: (transaction: DecisionDatabase) => Promise<T>) {
  const run = async (transaction: DecisionDatabase) => {
    await transaction
      .prepare("select pg_advisory_xact_lock(hashtextextended(?, 0))")
      .bind(`strato.tasks:${tenantId}`)
      .run();
    return work(transaction);
  };
  return db.transaction ? db.transaction(run) : run(db);
}

export async function reconcileServerTasks(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  now = new Date().toISOString(),
) {
  return locked(db, principal.tenantId, async transaction => {
    const current = await loadTaskState(transaction, principal.tenantId);
    let sources: Awaited<ReturnType<typeof loadAutomaticTaskSources>>;
    try {
      sources = await loadAutomaticTaskSources(transaction, principal.tenantId, now);
    } catch {
      throw new TaskSourcesError(
        "Não foi possível verificar as fontes das tarefas. Nenhuma pendência foi resolvida automaticamente.",
      );
    }
    let next = reconcileTasks(current ?? seedTaskState(), sources.items, now);
    const assignees = new Map<string, Awaited<ReturnType<typeof loadTaskAssignee>>>();
    try {
      for (const task of next.tasks) {
        if (task.status === "completed" || !taskIsExplicitlyAssigned(task)) continue;
        const id = task.ownerUserId;
        if (id && !assignees.has(id))
          assignees.set(id, await loadTaskAssignee(transaction, principal.tenantId, id, now));
        const user = id ? assignees.get(id) : null;
        if (!user || taskAssignmentError(task, user, principal.tenantId, sources.operationCompanies))
          next = returnTaskToQueue(next, task.id, now);
      }
    } catch {
      throw new TaskSourcesError(
        "Não foi possível verificar as fontes de acesso das tarefas. Nenhuma atribuição foi alterada.",
      );
    }
    let saved = current;
    if (!current || next !== current) {
      const expectedVersion = current?.persistenceVersion ?? 0;
      const requestHash = await taskRequestHash({
        tenantId: principal.tenantId,
        actorId: principal.id,
        expectedVersion,
        state: next,
      });
      saved = await saveTaskState(
        transaction,
        principal.tenantId,
        principal.id,
        principal.name,
        next,
        expectedVersion,
        crypto.randomUUID(),
        requestHash,
        { automatic: true },
      );
      if (!saved) throw new TaskTransitionError("As tarefas mudaram durante a atualização. Atualize a Central do Dia.");
    }
    return syncTaskState(saved, principal, sources.operationCompanies)!;
  });
}

function humanCommand(prior: TaskRecord, candidate: TaskRecord, actor: ServerPrincipal): TaskCommand {
  const immutable = (task: TaskRecord) => ({
    id: task.id,
    source: task.source,
    createdAt: task.createdAt,
    snapshot: task.snapshot,
    dueAt: task.dueAt,
    sourceActive: task.sourceActive,
  });
  if (!same(immutable(prior), immutable(candidate)))
    throw new TaskTransitionError("A origem, empresa e snapshot da tarefa são definidos no servidor.");
  if (
    candidate.history.length !== prior.history.length + 1 ||
    prior.history.some((entry, index) => !same(entry, candidate.history[index]))
  )
    throw new TaskTransitionError("A alteração da tarefa exige um novo evento e não pode reescrever o histórico.");
  const event = candidate.history.at(-1)!;
  if (event.by !== actor.name) throw new TaskTransitionError("A autoria da tarefa não corresponde à sessão.");
  const note = event.detail.trim();
  if (event.action === "assigned") {
    if (!candidate.ownerUserId) throw new TaskScopeError("Selecione um destinatário nominal para a tarefa.");
    return {
      type: "assign",
      by: actor.name,
      owner: candidate.owner,
      ownerUserId: candidate.ownerUserId,
      department: candidate.department,
      note,
    };
  }
  if (event.action === "snoozed") return { type: "snooze", by: actor.name, until: candidate.snoozedUntil!, note };
  if (event.action === "completed") return { type: "complete", by: actor.name, note };
  if (event.action === "reopened") return { type: "reopen", by: actor.name, note };
  if (event.action === "started") return { type: "start", by: actor.name };
  throw new TaskTransitionError("Eventos automáticos só podem ser gerados pelas fontes do servidor.");
}

export async function executeTaskChanges(
  db: DecisionDatabase,
  actor: ServerPrincipal,
  candidate: TaskState,
  expectedVersion: number,
  commandId: string,
  now = new Date().toISOString(),
) {
  const requestHash = await taskRequestHash({
    tenantId: actor.tenantId,
    actorId: actor.id,
    expectedVersion,
    state: candidate,
  });
  return locked(db, actor.tenantId, async transaction => {
    const companies = await operationCompanyMap(transaction, actor.tenantId);
    const replay = await replayedTaskCommand(transaction, actor.tenantId, commandId, requestHash);
    if (replay) return syncTaskState(replay, actor, companies)!;
    const current = await loadTaskState(transaction, actor.tenantId);
    if (!current || current.persistenceVersion !== expectedVersion)
      throw new TaskTransitionError("As tarefas foram alteradas. Atualize a Central do Dia antes de tentar novamente.");
    const visible = current.tasks.filter(task => taskSyncVisibleTo(task, actor, companies));
    const candidates = new Map(candidate.tasks.map(task => [task.id, task]));
    if (
      candidate.tasks.some(task => !visible.some(prior => prior.id === task.id)) ||
      visible.some(task => !candidates.has(task.id))
    )
      throw new TaskScopeError("O comando contém tarefa fora das empresas, funções ou perfil deste usuário.");
    let next = current;
    for (const prior of visible) {
      const changed = candidates.get(prior.id)!;
      if (same(prior, changed)) continue;
      const command = humanCommand(prior, changed, actor);
      if (command.type === "snooze") {
        const error = taskSnoozeError(command.until, now);
        if (error) throw new TaskTransitionError(error);
      }
      if (command.type === "assign") {
        const user = await loadTaskAssignee(transaction, actor.tenantId, command.ownerUserId!, now);
        if (!user) throw new TaskScopeError("O destinatário precisa estar ativo e vinculado a esta organização.");
        const error = taskAssignmentError(prior, user, actor.tenantId, companies);
        if (error) throw new TaskScopeError(error);
        command.owner = user.name;
        command.department = user.department;
      }
      const applied = applyTaskCommand(next, prior.id, command, now);
      const expected = applied.tasks.find(task => task.id === prior.id)!;
      expected.history = [...expected.history.slice(0, -1), { ...expected.history.at(-1)!, actorUserId: actor.id }];
      const mutable = (task: TaskRecord) => ({
        status: task.status,
        owner: task.owner,
        ownerUserId: task.ownerUserId,
        assignmentActive: task.assignmentActive,
        department: task.department,
        snoozedUntil: task.snoozedUntil,
      });
      if (!same(mutable(expected), mutable(changed)))
        throw new TaskTransitionError("O estado da tarefa não corresponde à ação informada.");
      next = applied;
    }
    const saved = await saveTaskState(
      transaction,
      actor.tenantId,
      actor.id,
      actor.name,
      next,
      expectedVersion,
      commandId,
      requestHash,
    );
    if (!saved)
      throw new TaskTransitionError("As tarefas foram alteradas por outra pessoa. Atualize a Central do Dia.");
    return syncTaskState(saved, actor, companies)!;
  });
}
