import type { TaskState } from "@/src/domain/tasks/model";
import { validateTaskState } from "@/src/domain/tasks/persistence";
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { TaskCommandConflictError, TaskTransitionError } from "@/src/server/tasks/repository";
import { executeTaskChanges, reconcileServerTasks, TaskScopeError, TaskSourcesError } from "@/src/server/tasks/service";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

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

function failure(reason: unknown) {
  if (reason instanceof TaskScopeError) return json({ error: reason.message }, 403);
  if (reason instanceof TaskCommandConflictError || reason instanceof TaskTransitionError)
    return json({ error: reason.message }, 409);
  if (reason instanceof TaskSourcesError) return json({ error: reason.message }, 503);
  console.error("task_state_failed", reason);
  return json({ error: "O banco não conseguiu atualizar as tarefas. Tente novamente." }, 500);
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error!;
  try {
    return json({ tasks: await reconcileServerTasks(access.db, access.principal) });
  } catch (reason) {
    return failure(reason);
  }
}

export async function PUT(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error!;
  const command = (await request.json().catch(() => null)) as {
    tasks?: TaskState;
    expectedVersion?: number;
    commandId?: string;
  } | null;
  if (
    !command?.tasks ||
    !Number.isInteger(command.expectedVersion) ||
    Number(command.expectedVersion) < 0 ||
    typeof command.commandId !== "string" ||
    !/^[A-Za-z0-9:_-]{8,200}$/.test(command.commandId)
  )
    return json({ error: "Comando de tarefas inválido." }, 400);
  const error = validateTaskState(command.tasks);
  if (error) return json({ error }, 400);
  try {
    return json({
      tasks: await executeTaskChanges(
        access.db,
        access.principal,
        command.tasks,
        Number(command.expectedVersion),
        command.commandId,
      ),
    });
  } catch (reason) {
    return failure(reason);
  }
}
