import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskState } from "@/src/domain/tasks/model";
import { applyTaskCommand } from "@/src/domain/tasks/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { allPermissions } from "@/src/domain/access/model";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";

const fixtures = vi.hoisted(() => ({
  operations: [] as unknown[],
  failSources: false,
  principal: {
    id: "actor",
    name: "CHURUME",
    tenantId: "tenant-a",
    status: "active",
    access: "admin",
    department: "Diretoria",
    functionalAreas: ["Diretoria"],
    permissions: [] as string[],
    authorityIds: ["credit-director"],
    companyScopes: ["Empresa A"],
  },
  db: null as unknown,
}));
vi.mock("@/src/server/database/postgres", () => ({
  getDatabase: () => fixtures.db,
  jsonParameter: (value: unknown) => value,
}));
vi.mock("@/src/server/access/session", () => ({ sessionPrincipal: async () => fixtures.principal }));
vi.mock("@/src/server/operations/storage", () => ({
  loadOperations: async () => {
    if (fixtures.failSources) throw new Error("Fonte indisponível");
    return fixtures.operations;
  },
}));
vi.mock("@/src/server/portfolio/repository", () => ({
  loadCurrentPortfolio: async () => ({ version: 3, titles: [] }),
}));
vi.mock("@/src/server/access/notifications", () => ({ listAccessChangeNotifications: async () => [] }));
import { GET, PUT } from "@/app/api/tasks/route";

class TaskDatabase implements DecisionDatabase {
  state: { payload: TaskState; aggregate_version: number } | null = null;
  commands = new Map<string, Record<string, unknown>>();
  user: Record<string, unknown> | null = null;
  permissions = ["dashboard:view", "operations:view"];
  functions = ["Operações"];
  authorities: string[] = [];
  notifications: unknown[] = [];
  queue = Promise.resolve();
  prepare(query: string): DecisionStatement {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind(...params) {
        values = params;
        return statement;
      },
      first: async <T>() => {
        if (query.includes("from private.task_commands")) return (this.commands.get(String(values[1])) as T) ?? null;
        if (query.includes("select payload, aggregate_version from private.task_states"))
          return structuredClone(this.state) as T;
        if (query.includes("insert into private.task_states")) {
          if (this.state && values[4] !== this.state.aggregate_version) return null;
          this.state = {
            payload: structuredClone(values[1]) as TaskState,
            aggregate_version: (this.state?.aggregate_version ?? 0) + 1,
          };
          return { ...structuredClone(this.state), event_id: "event" } as T;
        }
        if (query.includes("private.access_users"))
          return this.user?.tenant_id === values[0] && this.user?.user_id === values[1] ? (this.user as T) : null;
        return null;
      },
      all: async <T>() => {
        if (query.includes("select operation_id, vehicle"))
          return {
            results: fixtures.operations.map(value => {
              const operation = value as { id: string; vehicle: string };
              return { operation_id: operation.id, vehicle: operation.vehicle };
            }) as T[],
          };
        if (query.includes("private.decision_notifications")) return { results: this.notifications as T[] };
        if (query.includes("private.access_permissions"))
          return { results: this.permissions.map(permission => ({ permission })) as T[] };
        if (query.includes("private.user_function_assignments"))
          return { results: this.functions.map(function_area => ({ function_area })) as T[] };
        if (query.includes("private.authority_assignments"))
          return { results: this.authorities.map(authority_id => ({ authority_id })) as T[] };
        return { results: [] };
      },
      run: async () => {
        if (query.includes("insert into private.task_commands"))
          this.commands.set(String(values[1]), {
            request_hash: values[2],
            result_payload: values[5],
            result_version: values[4],
          });
        return { success: true };
      },
    };
    return statement;
  }
  async batch<T>(statements: DecisionStatement[]) {
    return (await Promise.all(statements.map(statement => statement.run()))) as T[];
  }
  async exec() {}
  async transaction<T>(work: (db: DecisionDatabase) => Promise<T>): Promise<T> {
    const previous = this.queue;
    let finish!: () => void;
    this.queue = new Promise(resolve => {
      finish = resolve;
    });
    await previous;
    const backup = structuredClone({ state: this.state, commands: this.commands });
    try {
      return await work({
        prepare: query => this.prepare(query),
        batch: statements => this.batch(statements),
        exec: async () => {},
      });
    } catch (error) {
      this.state = backup.state;
      this.commands = backup.commands;
      throw error;
    } finally {
      finish();
    }
  }
}
let db: TaskDatabase;
const request = (body?: unknown) =>
  new Request("http://local/api/tasks", {
    method: body ? "PUT" : "GET",
    headers: { "x-strato-tenant-id": "tenant-a", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const get = async () => {
  const response = await GET(request());
  return { response, body: (await response.json()) as { tasks: TaskState; error?: string } };
};
const put = async (tasks: TaskState, commandId = crypto.randomUUID()) =>
  PUT(request({ tasks, expectedVersion: tasks.persistenceVersion ?? 0, commandId }));
const blocked = () => ({
  ...initialOperations[0],
  id: "CHURUME-op-a",
  vehicle: "Empresa A",
  blockers: 1,
  owner: "CHURUME",
});
beforeEach(() => {
  db = new TaskDatabase();
  fixtures.db = db;
  fixtures.operations = [blocked()];
  fixtures.failSources = false;
  fixtures.principal.permissions = [...allPermissions];
});

describe("API autoritativa da Central do Dia", () => {
  it("F01 inicializa estado pelo GET sem exigir administração do navegador", async () => {
    fixtures.principal.access = "operator";
    const { response, body } = await get();
    fixtures.principal.access = "admin";
    expect(response.status).toBe(200);
    expect(body.tasks?.tasks.map(task => task.id)).toContain("CHURUME-op-a-decision");
    expect(db.state?.aggregate_version).toBe(1);
  });
  it("F02 deriva nova tarefa no servidor e preserva conclusão humana anterior", async () => {
    const first = await get();
    const complete = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "complete", by: "CHURUME" },
      new Date().toISOString(),
    );
    expect((await put(complete)).status).toBe(200);
    fixtures.operations.push({ ...blocked(), id: "CHURUME-op-new" });
    const next = await get();
    expect(next.body.tasks.tasks.find(task => task.id === "CHURUME-op-new-decision")?.status).toBe("open");
    expect(next.body.tasks.tasks.find(task => task.id === "CHURUME-op-a-decision")?.status).toBe("completed");
  });
  it("não resolve tarefas nem grava agregado quando fonte falha", async () => {
    await get();
    const previous = structuredClone(db.state);
    fixtures.failSources = true;
    const { response, body } = await get();
    expect(response.status).toBe(503);
    expect(body.error).toContain("fontes");
    expect(db.state).toEqual(previous);
  });
  it("F04 recusa snapshot adulterado mesmo acompanhado de evento humano válido", async () => {
    const first = await get();
    const next = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "complete", by: "CHURUME" },
      new Date().toISOString(),
    );
    next.tasks[0].snapshot.operationId = "forbidden-op-b";
    const response = await put(next);
    expect(response.status).toBe(409);
    expect(db.state?.payload.tasks[0].snapshot.operationId).toBe("CHURUME-op-a");
  });
  it("F10 recusa conclusão silenciosa sem evento", async () => {
    const first = await get();
    const next = structuredClone(first.body.tasks);
    next.tasks[0].status = "completed";
    next.tasks[0].completedAt = new Date().toISOString();
    expect((await put(next)).status).toBe(409);
  });
  it.each([
    ["sem vínculo", "tenant-b", "active", ["Empresa A"], ["dashboard:view", "operations:view"]],
    ["suspenso", "tenant-a", "suspended", ["Empresa A"], ["dashboard:view", "operations:view"]],
    ["outra empresa", "tenant-a", "active", ["Empresa B"], ["dashboard:view", "operations:view"]],
    ["sem módulo", "tenant-a", "active", ["Empresa A"], ["dashboard:view"]],
  ])("F05/F11 recusa destinatário %s", async (_name, tenant, status, scopes, permissions) => {
    const first = await get();
    db.user = {
      user_id: "recipient",
      name: "Destino",
      department: "Operações",
      role: "Operador",
      access_level: "operator",
      status,
      tenant_id: tenant,
      company_scopes_json: JSON.stringify(scopes),
    };
    db.permissions = permissions as string[];
    const next = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "assign", by: "CHURUME", owner: "Destino", ownerUserId: "recipient", department: "Operações" },
      new Date().toISOString(),
    );
    expect((await put(next)).status).toBe(403);
    expect(db.state?.payload.tasks[0].ownerUserId).toBeUndefined();
  });
  it("atribui usuário compatível e registra autoria, ID e instante gerados pelo servidor", async () => {
    const first = await get();
    db.user = {
      user_id: "recipient",
      name: "Destino",
      department: "Operações",
      role: "Operador",
      access_level: "operator",
      status: "active",
      tenant_id: "tenant-a",
      company_scopes_json: '["Empresa A"]',
    };
    const next = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "assign", by: "CHURUME", owner: "Destino", ownerUserId: "recipient", department: "Operações" },
      "2099-01-01T00:00:00Z",
    );
    const forgedEvent = next.tasks[0].history.at(-1)!;
    expect((await put(next)).status).toBe(200);
    const saved = db.state!.payload.tasks[0];
    expect(saved.ownerUserId).toBe("recipient");
    expect(saved.history.at(-1)?.by).toBe("CHURUME");
    expect(saved.history.at(-1)?.id).not.toBe(forgedEvent.id);
    expect(saved.history.at(-1)?.at).not.toBe(forgedEvent.at);
  });
});

describe("concorrência e repetição de comandos de tarefa", () => {
  it("repetição da mesma chave retorna resultado sem duplicar evento nem versão", async () => {
    const first = await get();
    const next = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "complete", by: "CHURUME" },
      new Date().toISOString(),
    );
    const key = crypto.randomUUID();
    expect((await put(next, key)).status).toBe(200);
    const version = db.state?.aggregate_version;
    const events = db.state?.payload.tasks[0].history.length;
    expect((await put(next, key)).status).toBe(200);
    expect(db.state?.aggregate_version).toBe(version);
    expect(db.state?.payload.tasks[0].history.length).toBe(events);
  });
  it("mudança concorrente recusa versão antiga e preserva tarefa nova e decisão humana", async () => {
    const first = await get();
    const next = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "complete", by: "CHURUME" },
      new Date().toISOString(),
    );
    fixtures.operations.push({ ...blocked(), id: "CHURUME-op-new" });
    await get();
    expect((await put(next)).status).toBe(409);
    const current = await get();
    const retry = applyTaskCommand(
      current.body.tasks,
      "CHURUME-op-a-decision",
      { type: "complete", by: "CHURUME" },
      new Date().toISOString(),
    );
    expect((await put(retry)).status).toBe(200);
    expect(db.state?.payload.tasks.find(task => task.id === "CHURUME-op-new-decision")?.status).toBe("open");
    expect(db.state?.payload.tasks.find(task => task.id === "CHURUME-op-a-decision")?.status).toBe("completed");
  });
  it("ordem de chaves devolvida por JSONB não gera atualização fictícia nem conflito", async () => {
    await get();
    const snapshot = db.state!.payload.tasks[0].snapshot;
    db.state!.payload.tasks[0].snapshot = Object.fromEntries(Object.entries(snapshot).reverse()) as typeof snapshot;
    const version = db.state!.aggregate_version;
    await get();
    expect(db.state!.aggregate_version).toBe(version);
  });
});

it("não transforma notificação operacional sem fonte correspondente em tarefa geral", async () => {
  fixtures.operations = [];
  db.notifications = [
    {
      notification_id: "orphan",
      operation_id: "gone-op",
      vehicle: "Empresa B",
      kind: "decision",
      tone: "warning",
      title: "SEGREDO B",
      summary: "Texto B",
      detail: "Detalhe B",
      impact: "900",
      next_action: "Abrir",
      owner: "Equipe",
      department: "Diretoria",
      timing: "Agora",
      view_name: "operations",
      required_permission: "operations:view",
      authority_id: null,
      created_at: new Date().toISOString(),
    },
  ];
  const result = await get();
  expect(result.response.status).toBe(200);
  expect(result.body.tasks.tasks).toHaveLength(0);
});

it.each(["permissão", "empresa", "suspensão"])(
  "devolve atribuição à fila após revogação de %s do destinatário",
  async reason => {
    const first = await get();
    db.user = {
      user_id: "recipient",
      name: "Destino",
      department: "Operações",
      role: "Operador",
      access_level: "operator",
      status: "active",
      tenant_id: "tenant-a",
      company_scopes_json: '["Empresa A"]',
    };
    const assigned = applyTaskCommand(
      first.body.tasks,
      "CHURUME-op-a-decision",
      { type: "assign", by: "CHURUME", owner: "Destino", ownerUserId: "recipient", department: "Operações" },
      new Date().toISOString(),
    );
    expect((await put(assigned)).status).toBe(200);
    if (reason === "permissão") db.permissions = ["dashboard:view"];
    if (reason === "empresa") db.user!.company_scopes_json = '["Empresa B"]';
    if (reason === "suspensão") db.user!.status = "suspended";
    const refreshed = await get();
    const task = refreshed.body.tasks.tasks.find(item => item.id === "CHURUME-op-a-decision")!;
    expect(task.ownerUserId).toBeUndefined();
    expect(task.status).toBe("open");
    expect(task.history.filter(event => event.action === "assigned")).toHaveLength(2);
    expect(task.history.at(-1)?.by).toBe("STRATO Intelligence");
    const latestVersion = db.state?.aggregate_version;
    await get();
    expect(db.state?.aggregate_version).toBe(latestVersion);
  },
);
it("resposta de tarefas privadas não pode ser armazenada em cache", async () => {
  const { response } = await get();
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("não reabre conclusão humana já registrada quando destinatário perde acesso", async () => {
  const first = await get();
  db.user = {
    user_id: "recipient",
    name: "Destino",
    department: "Operações",
    role: "Operador",
    access_level: "operator",
    status: "active",
    tenant_id: "tenant-a",
    company_scopes_json: '["Empresa A"]',
  };
  const assigned = applyTaskCommand(
    first.body.tasks,
    "CHURUME-op-a-decision",
    { type: "assign", by: "CHURUME", owner: "Destino", ownerUserId: "recipient", department: "Operações" },
    new Date().toISOString(),
  );
  expect((await put(assigned)).status).toBe(200);
  const current = await get();
  const completed = applyTaskCommand(
    current.body.tasks,
    "CHURUME-op-a-decision",
    { type: "complete", by: "CHURUME" },
    new Date().toISOString(),
  );
  expect((await put(completed)).status).toBe(200);
  db.permissions = [];
  const history = structuredClone(db.state!.payload.tasks[0].history);
  await get();
  expect(db.state!.payload.tasks[0].status).toBe("completed");
  expect(db.state!.payload.tasks[0].history).toEqual(history);
});
it("histórico humano identifica usuário da sessão mesmo com nomes duplicados", async () => {
  const first = await get();
  const completed = applyTaskCommand(
    first.body.tasks,
    "CHURUME-op-a-decision",
    { type: "complete", by: "CHURUME" },
    new Date().toISOString(),
  );
  expect((await put(completed)).status).toBe(200);
  expect((db.state!.payload.tasks[0].history.at(-1) as { actorUserId?: string }).actorUserId).toBe("actor");
});
