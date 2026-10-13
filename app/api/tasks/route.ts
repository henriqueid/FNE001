import type { TaskState } from "@/src/domain/tasks/model";
import { validateTaskState } from "@/src/domain/tasks/persistence";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  loadTaskState,
  saveTaskState,
  TaskCommandConflictError,
  taskRequestHash,
  TaskTransitionError,
} from "@/src/server/tasks/repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  if (!principal.permissions.includes("dashboard:view"))
    return { error: json({ error: "Sem permissão para acessar tarefas." }, 403) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  return json({ tasks: await loadTaskState(access.db, access.tenantId) });
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const command = (await request.json().catch(() => null)) as {
    tasks?: TaskState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.tasks ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    !command.commandId ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando de tarefas inválido." }, 400);
  const validationError = validateTaskState(command.tasks);
  if (validationError) return json({ error: validationError }, 400);
  const expectedVersion = Number(command.expectedVersion);
  const requestHash = await taskRequestHash({
    tenantId: access.tenantId,
    actorId: access.principal.id,
    expectedVersion,
    state: command.tasks,
  });
  try {
    const tasks = await saveTaskState(
      access.db,
      access.tenantId,
      access.principal.id,
      access.principal.name,
      command.tasks,
      expectedVersion,
      command.commandId,
      requestHash,
    );
    if (!tasks)
      return json(
        { error: "As tarefas foram alteradas por outra pessoa. Atualize a Central do Dia antes de tentar novamente." },
        409,
      );
    return json({ tasks });
  } catch (reason) {
    if (reason instanceof TaskCommandConflictError || reason instanceof TaskTransitionError)
      return json({ error: reason.message }, 409);
    console.error("task_state_save_failed", reason);
    return json({ error: "O banco não conseguiu salvar as tarefas. Tente novamente." }, 500);
  }
}
