import type { TaskHistoryEntry, TaskRecord, TaskState } from "./model";

const unique = (values: string[]) => new Set(values).size === values.length;
const validInstant = (value: string | undefined) => !!value && Number.isFinite(new Date(value).getTime());
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function validHistory(entry: TaskHistoryEntry) {
  return (
    !!entry.id.trim() &&
    validInstant(entry.at) &&
    !!entry.by.trim() &&
    !!entry.detail.trim() &&
    ["created", "assigned", "started", "snoozed", "completed", "resolved", "reopened"].includes(entry.action)
  );
}

function validTask(task: TaskRecord) {
  if (!task.id.trim() || !task.owner.trim() || !task.department.trim()) return false;
  if (!validInstant(task.createdAt) || !validInstant(task.updatedAt) || !validInstant(task.dueAt)) return false;
  if (new Date(task.updatedAt).getTime() < new Date(task.createdAt).getTime()) return false;
  if (task.status === "snoozed" ? !validInstant(task.snoozedUntil) : task.snoozedUntil !== undefined) return false;
  if (task.status === "completed" ? !validInstant(task.completedAt) : task.completedAt !== undefined) return false;
  return unique(task.history.map(entry => entry.id)) && task.history.every(validHistory);
}

export function validateTaskState(state: TaskState): string | null {
  if (state.version !== 1 || !Array.isArray(state.tasks)) return "Versão do estado de tarefas não suportada.";
  if (!unique(state.tasks.map(task => task.id))) return "Há tarefas duplicadas na Central do Dia.";
  if (!state.tasks.every(validTask)) return "Há tarefa, prazo ou histórico inválido na Central do Dia.";
  const historyIds = state.tasks.flatMap(task => task.history.map(entry => entry.id));
  if (!unique(historyIds)) return "Há eventos de histórico duplicados entre tarefas.";
  return null;
}

/** Preserva fatos anteriores e impede que o cliente reescreva a trilha de uma tarefa. */
export function validateTaskTransition(previous: TaskState | null, next: TaskState, actorName: string): string | null {
  if (!previous) {
    const invalidCreation = next.tasks.some(
      task =>
        task.source !== "automatic" ||
        task.history.some(entry => entry.action !== "created" || entry.by !== "STRATO Intelligence"),
    );
    return invalidCreation ? "O estado inicial só pode conter tarefas automáticas criadas pelo STRATO." : null;
  }

  const nextById = new Map(next.tasks.map(task => [task.id, task]));
  for (const prior of previous.tasks) {
    const candidate = nextById.get(prior.id);
    if (!candidate) return `A tarefa ${prior.id} não pode ser removida.`;
    if (candidate.source !== prior.source || candidate.createdAt !== prior.createdAt)
      return `A origem da tarefa ${prior.id} é imutável.`;
    if (candidate.history.length < prior.history.length)
      return `O histórico da tarefa ${prior.id} não pode ser reduzido.`;
    if (prior.history.some((entry, index) => !same(entry, candidate.history[index])))
      return `O histórico da tarefa ${prior.id} não pode ser reescrito.`;
    const appended = candidate.history.slice(prior.history.length);
    if (appended.some(entry => entry.by !== actorName && entry.by !== "STRATO Intelligence"))
      return `O responsável pelo evento da tarefa ${prior.id} não corresponde à sessão.`;
  }

  for (const created of next.tasks.filter(task => !previous.tasks.some(prior => prior.id === task.id))) {
    if (
      created.source !== "automatic" ||
      created.history.length !== 1 ||
      created.history[0].action !== "created" ||
      created.history[0].by !== "STRATO Intelligence"
    )
      return `A tarefa ${created.id} não possui uma origem automática válida.`;
  }
  return null;
}
