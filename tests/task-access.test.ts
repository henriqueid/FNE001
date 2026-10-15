import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@/src/domain/tasks/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { taskVisibleTo } from "@/src/server/tasks/access";

const principal = {
  name: "Administrador",
  access: "admin",
  functionalAreas: ["Diretoria"],
  companyScopes: ["Empresa A"],
} as ServerPrincipal;

const task = (operationId?: string) =>
  ({ owner: "Outro", department: "Risco e crédito", snapshot: { operationId } }) as TaskRecord;

describe("escopo de empresa das tarefas", () => {
  const companies = new Map([
    ["op-a", "Empresa A"],
    ["op-b", "Empresa B"],
  ]);

  it("mantém tarefas gerais disponíveis conforme o perfil", () => {
    expect(taskVisibleTo(task(), principal, companies)).toBe(true);
  });

  it("não permite nem ao administrador enxergar tarefa operacional de outra empresa", () => {
    expect(taskVisibleTo(task("op-a"), principal, companies)).toBe(true);
    expect(taskVisibleTo(task("op-b"), principal, companies)).toBe(false);
    expect(taskVisibleTo(task("op-inexistente"), principal, companies)).toBe(false);
  });

  it("entrega uma tarefa delegada apenas ao usuário nominal, mesmo na mesma área", () => {
    const delegated = {
      ...task(),
      owner: "Destinatário",
      ownerUserId: "recipient-id",
      history: [{ action: "assigned" }],
    } as TaskRecord;
    const origin = { ...principal, id: "origin-id", name: "Origem", access: "operator" } as ServerPrincipal;
    const recipient = { ...origin, id: "recipient-id", name: "Destinatário" } as ServerPrincipal;

    expect(taskVisibleTo(delegated, origin, companies)).toBe(false);
    expect(taskVisibleTo(delegated, recipient, companies)).toBe(true);
  });
});
