import type { TaskState } from "@/src/domain/tasks/model";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível acessar as tarefas.");
  return body;
}

export async function loadTaskState(): Promise<TaskState | null> {
  const response = await fetch("/api/tasks", { cache: "no-store", headers: headers() });
  return (await responseBody<{ tasks: TaskState | null }>(response)).tasks;
}

export async function persistTaskState(tasks: TaskState): Promise<TaskState> {
  const commandId = crypto.randomUUID();
  const request = () =>
    fetch("/api/tasks", {
      method: "PUT",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ tasks, expectedVersion: tasks.persistenceVersion ?? 0, commandId }),
    });
  let response: Response;
  try {
    response = await request();
  } catch {
    response = await request();
  }
  return (await responseBody<{ tasks: TaskState }>(response)).tasks;
}
