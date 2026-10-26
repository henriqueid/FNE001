import { taskAudiencePermissions } from "./assignment";
import type { AccessUser } from "@/src/domain/access/model";
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
import {
  operationBelongsToUser,
  functionalAreasMatchQueue,
  userFunctionalAreas,
  type AppUserProfile,
  type UserScopeContext,
} from "@/src/domain/copilot/daily-briefing";

export type TaskStatus = "open" | "in_progress" | "snoozed" | "completed";
export type TaskAction = "created" | "assigned" | "started" | "snoozed" | "completed" | "resolved" | "reopened";

export type TaskHistoryEntry = {
  id: string;
  at: string;
  by: string;
  actorUserId?: string;
  action: TaskAction;
  detail: string;
};

export type TaskSnapshot = Omit<AttentionItem, "operation"> & { operationId?: string };

export type TaskRecord = {
  id: string;
  source: "automatic" | "manual";
  status: TaskStatus;
  owner: string;
  /** Identificador nominal do usuário após assumir ou receber uma delegação. */
  ownerUserId?: string;
  assignmentActive?: boolean;
  department: string;
  dueAt: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  sourceActive?: boolean;
  snapshot: TaskSnapshot;
  history: TaskHistoryEntry[];
};

export type TaskState = { version: 1; tasks: TaskRecord[]; persistenceVersion?: number };

export type ManagedTask = AttentionItem & { operationId?: string } & Pick<
    TaskRecord,
    | "source"
    | "status"
    | "owner"
    | "ownerUserId"
    | "assignmentActive"
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
  | { type: "assign"; by: string; owner: string; ownerUserId?: string; department?: string; note?: string }
  | { type: "snooze"; by: string; until: string; note?: string }
  | { type: "complete"; by: string; note?: string }
  | { type: "reopen"; by: string; note?: string };

export const seedTaskState = (): TaskState => ({ version: 1, tasks: [] });

export const taskIsExplicitlyAssigned = (task: Pick<TaskRecord, "history" | "assignmentActive">) =>
  task.assignmentActive !== false && (task.history ?? []).some(entry => entry.action === "assigned");

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

const canonicalTaskValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalTaskValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalTaskValue(item)]),
    );
  return value;
};

export function taskFactsEqual(left: unknown, right: unknown) {
  return JSON.stringify(canonicalTaskValue(left)) === JSON.stringify(canonicalTaskValue(right));
}

function hasNewEpisode(previous?: string, current?: string) {
  if (!previous || !current || previous === current) return false;
  try {
    const prior = new Set((JSON.parse(previous) as unknown[]).map(item => JSON.stringify(item)));
    return (JSON.parse(current) as unknown[]).some(item => !prior.has(JSON.stringify(item)));
  } catch {
    return true;
  }
}

/** Mantém os alertas automáticos sincronizados sem apagar o histórico das tarefas. */
export function reconcileTasks(
  state: TaskState,
  items: AttentionItem[],
  now: string,
  { sourcesReady = true }: { sourcesReady?: boolean } = {},
): TaskState {
  if (!sourcesReady) return state;
  const live = new Map(items.map(item => [item.id, item]));
  let changed = false;
  const records = state.tasks.map(record => {
    const item = live.get(record.id);
    if (item) {
      live.delete(record.id);
      const snapshot = snapshotOf(item);
      const contentChanged = !taskFactsEqual(snapshot, record.snapshot);
      const reopen =
        record.source === "automatic" &&
        record.status === "completed" &&
        (record.sourceActive === false ||
          record.history.at(-1)?.action === "resolved" ||
          hasNewEpisode(record.snapshot.episodeKey, snapshot.episodeKey));
      if (!contentChanged && !reopen) return record;
      changed = true;
      return {
        ...record,
        snapshot,
        sourceActive: true,
        department: item.department,
        updatedAt: now,
        ...(reopen
          ? {
              status: "open" as const,
              completedAt: undefined,
              snoozedUntil: undefined,
              history: [
                ...record.history,
                historyEntry(now, "STRATO Intelligence", "reopened", "Pendência novamente confirmada na origem."),
              ],
            }
          : {}),
      };
    }
    if (
      record.source === "automatic" &&
      record.sourceActive !== false &&
      (record.status !== "completed" || record.history.at(-1)?.action !== "resolved")
    ) {
      changed = true;
      return {
        ...record,
        status: "completed" as const,
        sourceActive: false,
        snoozedUntil: undefined,
        completedAt: record.completedAt ?? now,
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
      sourceActive: true,
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
      ownerUserId: record.ownerUserId,
      assignmentActive: record.assignmentActive,
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
      company: task.company,
      requiredPermission: task.requiredPermission,
      authorityId: task.authorityId,
      episodeKey: task.episodeKey,
      operation: task.operation,
    }));
}

/** Última barreira de visibilidade: também protege tarefas históricas já persistidas. */
export function visibleTasksForUser(tasks: ManagedTask[], user: AppUserProfile, scope?: UserScopeContext) {
  const areas = userFunctionalAreas(user);
  return tasks.filter(task => {
    if (
      task.company &&
      user.companyScopes &&
      !user.companyScopes.some(
        scope =>
          scope === "*" || scope.trim().toLocaleLowerCase("pt-BR") === task.company!.trim().toLocaleLowerCase("pt-BR"),
      )
    )
      return false;
    const audience = user as Partial<AccessUser>;
    if (
      audience.permissions &&
      taskAudiencePermissions(task).some(permission => !audience.permissions!.includes(permission))
    )
      return false;
    if (task.authorityId && !audience.authorityIds?.includes(task.authorityId)) return false;
    // Depois de uma atribuição explícita a tarefa deixa de ser uma fila da área e passa a ser
    // uma pendência nominal. Isso também impede que quem delegou continue vendo-a pela área.
    if (taskIsExplicitlyAssigned(task))
      return task.ownerUserId ? task.ownerUserId === user.id : task.owner === user.name;
    if (user.access === "admin" || areas.includes("Diretoria") || task.owner === user.name) return true;
    if (task.operation) return operationBelongsToUser(task.operation, user, scope);
    return functionalAreasMatchQueue(areas, task.department);
  });
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
        ownerUserId: command.ownerUserId,
        assignmentActive: true,
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

export function returnTaskToQueue(state: TaskState, id: string, now: string): TaskState {
  const task = state.tasks.find(record => record.id === id);
  if (!task || task.status === "completed" || !taskIsExplicitlyAssigned(task)) return state;
  return {
    ...state,
    tasks: state.tasks.map(record =>
      record.id !== id
        ? record
        : {
            ...record,
            owner: record.snapshot.owner,
            ownerUserId: undefined,
            assignmentActive: false,
            department: record.snapshot.department,
            status: "open",
            snoozedUntil: undefined,
            updatedAt: now,
            history: [
              ...record.history,
              historyEntry(
                now,
                "STRATO Intelligence",
                "assigned",
                "Tarefa devolvida à fila original: destinatário indisponível ou sem acesso compatível.",
              ),
            ],
          },
    ),
  };
}

/** Reaplica somente as mudanças locais sobre uma versão mais recente recebida do servidor. */
export function rebaseTaskState(base: TaskState, candidate: TaskState, current: TaskState): TaskState {
  const baseById = new Map(base.tasks.map(task => [task.id, task]));
  const currentById = new Map(current.tasks.map(task => [task.id, task]));
  const changed = candidate.tasks.filter(task => JSON.stringify(task) !== JSON.stringify(baseById.get(task.id)));
  if (!changed.length) return current;

  const replacements = new Map<string, TaskRecord>();
  for (const task of changed) {
    const serverTask = currentById.get(task.id);
    const baseTask = baseById.get(task.id);
    // Uma tarefa que existia na base, mas sumiu da resposta recortada do servidor,
    // deixou de ser visível (por exemplo, após delegação) e não pode ser reenviada.
    if (!serverTask) {
      if (!baseTask) replacements.set(task.id, task);
      continue;
    }
    if (!baseTask) {
      replacements.set(task.id, task);
      continue;
    }
    const baseHistoryIds = new Set(baseTask.history.map(entry => entry.id));
    const serverHistoryIds = new Set(serverTask.history.map(entry => entry.id));
    const localHistory = task.history.filter(entry => !baseHistoryIds.has(entry.id) && !serverHistoryIds.has(entry.id));
    const automaticTransition =
      localHistory.length > 0 &&
      localHistory.every(
        entry => entry.by === "STRATO Intelligence" && (entry.action === "resolved" || entry.action === "reopened"),
      );
    if (
      automaticTransition &&
      serverTask.history.some(entry => !baseHistoryIds.has(entry.id) && entry.by !== "STRATO Intelligence")
    )
      continue;
    const localChanges = Object.fromEntries(
      (Object.keys(task) as (keyof TaskRecord)[])
        .filter(key => key !== "history" && JSON.stringify(task[key]) !== JSON.stringify(baseTask[key]))
        .map(key => [key, task[key]]),
    ) as Partial<TaskRecord>;
    replacements.set(task.id, {
      ...serverTask,
      ...localChanges,
      history: [...serverTask.history, ...localHistory],
    });
  }
  const tasks = current.tasks.map(task => replacements.get(task.id) ?? task);
  for (const task of changed) if (!currentById.has(task.id) && !baseById.has(task.id)) tasks.push(task);
  return { ...current, tasks };
}

export function migrateTaskState(value: unknown): TaskState {
  if (!value || typeof value !== "object") return seedTaskState();
  const candidate = value as Partial<TaskState>;
  if (candidate.version !== 1 || !Array.isArray(candidate.tasks)) return seedTaskState();
  return { version: 1, tasks: candidate.tasks.filter(task => task && typeof task.id === "string") };
}
