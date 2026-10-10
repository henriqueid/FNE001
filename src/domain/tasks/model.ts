import { type AttentionItem } from "@/src/domain/copilot/attention-center";

export type TaskStatus = "open" | "in_progress" | "snoozed" | "completed";
export type TaskAction = "created" | "assigned" | "started" | "snoozed" | "completed" | "resolved" | "reopened";

export type TaskHistoryEntry = {
  id: string;
  at: string;
  by: string;
  action: TaskAction;
  detail: string;
};

export type TaskSnapshot = Omit<AttentionItem, "operation"> & { operationId?: string };

export type TaskRecord = {
  id: string;
  source: "automatic" | "manual";
  status: TaskStatus;
  owner: string;
  department: string;
  dueAt: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  snapshot: TaskSnapshot;
  history: TaskHistoryEntry[];
};

export type TaskState = { version: 1; tasks: TaskRecord[] };

export type ManagedTask = AttentionItem &
  Pick<
    TaskRecord,
    | "source"
    | "status"
    | "owner"
    | "department"
    | "dueAt"
    | "snoozedUntil"
    | "createdAt"
    | "updatedAt"
    | "completedAt"
    | "history"
  >;

export type TaskCommand =
  | { type: "start"; by: string }
  | { type: "assign"; by: string; owner: string; department?: string; note?: string }
  | { type: "snooze"; by: string; until: string; note?: string }
  | { type: "complete"; by: string; note?: string }
  | { type: "reopen"; by: string; note?: string };

export const seedTaskState = (): TaskState => ({ version: 1, tasks: [] });

const snapshotOf = (item: AttentionItem): TaskSnapshot => {
  const { operation, ...snapshot } = item;
  return { ...snapshot, operationId: operation?.id };
};

const historyEntry = (at: string, by: string, action: TaskAction, detail: string): TaskHistoryEntry => ({
  id: `${at}-${action}-${Math.random().toString(36).slice(2, 8)}`,
  at,
  by,
  action,
  detail,
});

const dueFor = (item: AttentionItem, now: string) => {
  const date = new Date(now);
  if (item.timing === "Agora") date.setHours(date.getHours() + 2);
  else if (item.timing === "Hoje") date.setHours(18, 0, 0, 0);
  else date.setDate(date.getDate() + 1);
  return date.toISOString();
};

/** Mantém os alertas automáticos sincronizados sem apagar o histórico das tarefas. */
export function reconcileTasks(state: TaskState, items: AttentionItem[], now: string): TaskState {
  const live = new Map(items.map(item => [item.id, item]));
  let changed = false;
  const records = state.tasks.map(record => {
    const item = live.get(record.id);
    if (item) {
      live.delete(record.id);
      const snapshot = snapshotOf(item);
      const contentChanged = JSON.stringify(snapshot) !== JSON.stringify(record.snapshot);
      if (!contentChanged) return record;
      changed = true;
      return { ...record, snapshot, department: item.department, updatedAt: now };
    }
    if (record.source === "automatic" && record.status !== "completed") {
      changed = true;
      return {
        ...record,
        status: "completed" as const,
        completedAt: now,
        updatedAt: now,
        history: [
          ...record.history,
          historyEntry(now, "STRATO Intelligence", "resolved", "Resolvida automaticamente na origem."),
        ],
      };
    }
    return record;
  });

  live.forEach(item => {
    changed = true;
    records.push({
      id: item.id,
      source: "automatic",
      status: "open",
      owner: item.owner,
      department: item.department,
      dueAt: dueFor(item, now),
      createdAt: now,
      updatedAt: now,
      snapshot: snapshotOf(item),
      history: [
        historyEntry(now, "STRATO Intelligence", "created", "Tarefa criada a partir do monitoramento operacional."),
      ],
    });
  });

  return changed ? { version: 1, tasks: records } : state;
}

export function managedTasks(state: TaskState, items: AttentionItem[], now?: string): ManagedTask[] {
  const live = new Map(items.map(item => [item.id, item]));
  const instant = now ? new Date(now).getTime() : undefined;
  return state.tasks.map(record => {
    const item = live.get(record.id);
    const snapshot = item ?? record.snapshot;
    const reminderReached =
      record.status === "snoozed" &&
      !!record.snoozedUntil &&
      instant !== undefined &&
      new Date(record.snoozedUntil).getTime() <= instant;
    return {
      ...snapshot,
      operation: item?.operation,
      source: record.source,
      status: reminderReached ? "open" : record.status,
      owner: record.owner,
      department: record.department,
      dueAt: record.dueAt,
      snoozedUntil: record.snoozedUntil,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
      history: record.history,
    };
  });
}

export function actionableAttentionItems(tasks: ManagedTask[], now: string): AttentionItem[] {
  const instant = new Date(now).getTime();
  return tasks
    .filter(task => task.status !== "completed")
    .filter(task => task.status !== "snoozed" || !task.snoozedUntil || new Date(task.snoozedUntil).getTime() <= instant)
    .map(task => ({
      id: task.id,
      kind: task.kind,
      tone: task.tone,
      title: task.title,
      summary: task.summary,
      detail: task.detail,
      impact: task.impact,
      nextAction: task.nextAction,
      owner: task.owner,
      department: task.department,
      timing: task.timing,
      view: task.view,
      operation: task.operation,
    }));
}

export function applyTaskCommand(state: TaskState, id: string, command: TaskCommand, now: string): TaskState {
  let found = false;
  const tasks = state.tasks.map(task => {
    if (task.id !== id) return task;
    found = true;
    if (command.type === "start")
      return {
        ...task,
        status: "in_progress" as const,
        snoozedUntil: undefined,
        updatedAt: now,
        history: [...task.history, historyEntry(now, command.by, "started", "Trabalho iniciado.")],
      };
    if (command.type === "assign")
      return {
        ...task,
        status: "in_progress" as const,
        owner: command.owner,
        department: command.department ?? task.department,
        snoozedUntil: undefined,
        updatedAt: now,
        history: [
          ...task.history,
          historyEntry(now, command.by, "assigned", command.note || `Responsabilidade atribuída a ${command.owner}.`),
        ],
      };
    if (command.type === "snooze")
      return {
        ...task,
        status: "snoozed" as const,
        snoozedUntil: command.until,
        updatedAt: now,
        history: [
          ...task.history,
          historyEntry(now, command.by, "snoozed", command.note || `Lembrete adiado para ${command.until}.`),
        ],
      };
    if (command.type === "complete")
      return {
        ...task,
        status: "completed" as const,
        completedAt: now,
        snoozedUntil: undefined,
        updatedAt: now,
        history: [...task.history, historyEntry(now, command.by, "completed", command.note || "Tarefa concluída.")],
      };
    return {
      ...task,
      status: "open" as const,
      completedAt: undefined,
      snoozedUntil: undefined,
      updatedAt: now,
      history: [...task.history, historyEntry(now, command.by, "reopened", command.note || "Tarefa reaberta.")],
    };
  });
  return found ? { ...state, tasks } : state;
}

export function migrateTaskState(value: unknown): TaskState {
  if (!value || typeof value !== "object") return seedTaskState();
  const candidate = value as Partial<TaskState>;
  if (candidate.version !== 1 || !Array.isArray(candidate.tasks)) return seedTaskState();
  return { version: 1, tasks: candidate.tasks.filter(task => task && typeof task.id === "string") };
}
