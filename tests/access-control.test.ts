import {
  activeUser,
  allPermissions,
  authenticatedUser,
  can,
  canAccessView,
  defaultViewFor,
  migrateAccessState,
  permissionsForAreas,
  permissionsFor,
  seedAccessState,
  startUserPreview,
  stopUserPreview,
  updateAccessUser,
} from "@/src/domain/access/model";
import { operationsForUser } from "@/src/domain/copilot/daily-briefing";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { describe, expect, it } from "vitest";

describe("identidade e autorização", () => {
  it("mantém todas as permissões do administrador mesmo com cadastro legado incompleto", () => {
    const admin = { ...seedAccessState().users[0], permissions: [] };
    for (const permission of allPermissions) expect(can(admin, permission)).toBe(true);
    expect(can({ ...admin, status: "suspended" }, "finance:release")).toBe(false);
    expect(can({ ...admin, access: "operator" }, "users:manage")).toBe(false);
  });
  it("inicia com administrador consolidado e permissões completas", () => {
    const state = seedAccessState();
    const user = activeUser(state);

    expect(user.access).toBe("admin");
    expect(can(user, "users:manage")).toBe(true);
    expect(can(user, "finance:release")).toBe(true);
  });

  it("troca a visão somente para usuários ativos", () => {
    const seeded = seedAccessState();
    const operator = seeded.users.find(user => user.access === "operator")!;
    const active = startUserPreview(seeded, operator.id);
    const suspended = updateAccessUser(active, { ...operator, status: "suspended" });

    expect(activeUser(active).id).toBe(operator.id);
    expect(startUserPreview(suspended, operator.id)).toBe(suspended);
  });

  it("mantém a identidade autenticada separada da visão simulada", () => {
    const seeded = seedAccessState();
    const commercial = seeded.users.find(user => user.department === "Comercial" && user.access === "operator")!;
    const preview = startUserPreview(seeded, commercial.id);

    expect(authenticatedUser(preview).id).toBe(seeded.authenticatedUserId);
    expect(activeUser(preview).id).toBe(commercial.id);
    expect(activeUser(stopUserPreview(preview)).id).toBe(seeded.authenticatedUserId);
  });

  it("aplica permissões padrão por departamento e nível", () => {
    expect(permissionsFor("Risco e crédito", "operator")).toContain("risk:decide");
    expect(permissionsFor("Operações", "operator")).not.toContain("finance:release");
    expect(permissionsFor("Operações", "operator")).toContain("settings:view");
    expect(permissionsFor("Operações", "operator")).not.toContain("settings:manage");
    expect(permissionsFor("Operações", "manager")).toContain("users:manage");
    expect(permissionsForAreas(["Cadastro", "Operações"], "operator")).toEqual(
      expect.arrayContaining(["registry:view", "registry:edit", "operations:edit"]),
    );
  });

  it("protege módulos e escolhe uma entrada permitida para cada perfil", () => {
    const user = seedAccessState().users.find(candidate => candidate.department === "Financeiro") ?? {
      ...seedAccessState().users[0],
      access: "operator" as const,
      department: "Financeiro" as const,
      permissions: permissionsFor("Financeiro", "operator"),
    };

    expect(canAccessView(user, "finance")).toBe(true);
    expect(canAccessView(user, "settings")).toBe(false);
    expect(defaultViewFor(user)).toBe("home");
  });

  it("restringe operações também pelo escopo empresarial", () => {
    const vehicle = initialOperations[0].vehicle;
    const scoped = operationsForUser(initialOperations, {
      id: "manager-ops",
      name: "Gestor",
      role: "Gerente de operações",
      department: "Operações",
      access: "manager",
      responsibilities: ["Equipe"],
      companyScopes: [vehicle],
    });

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every(operation => operation.vehicle === vehicle)).toBe(true);
  });

  it("combina a visão das várias áreas atribuídas ao mesmo usuário", () => {
    const user = {
      id: "multi-area",
      name: "Pessoa multifuncional",
      role: "Analista",
      department: "Cadastro" as const,
      functionalAreas: ["Cadastro", "Operações"] as Array<"Cadastro" | "Operações">,
      access: "operator" as const,
      responsibilities: ["Cadastro", "Esteira"],
      operationOwner: initialOperations[0].owner,
    };
    const scoped = operationsForUser(initialOperations, user);

    expect(scoped.some(operation => operation.stage === 1)).toBe(true);
    expect(scoped.some(operation => operation.owner === initialOperations[0].owner)).toBe(true);
  });

  it("migra dados antigos preservando novos usuários padrão", () => {
    const seeded = seedAccessState();
    const migrated = migrateAccessState({
      version: 1,
      activeUserId: seeded.authenticatedUserId,
      users: [{ ...seeded.users[0], role: "Administrador principal" }],
    });

    expect(migrated.users[0].role).toBe("Administrador principal");
    expect(migrated.users.length).toBe(seeded.users.length);
    expect(migrated.version).toBe(2);
  });

  it("migra editores antigos de cadastro sem perder a nova capacidade de leitura", () => {
    const seeded = seedAccessState();
    const legacy = seeded.users.map(user => ({
      ...user,
      permissions: user.permissions.filter(permission => permission !== "registry:view"),
    }));
    const migrated = migrateAccessState({ ...seeded, users: legacy });
    const editor = migrated.users.find(user => user.permissions.includes("registry:edit"));

    expect(editor?.permissions).toContain("registry:view");
    expect(migrated.users.every(user => user.permissions.includes("settings:view"))).toBe(true);
  });
});

it("preserva identidade suspensa sem assumir permissões do primeiro administrador", () => {
  const state = seedAccessState();
  const operator = state.users.find(user => user.access === "operator")!;
  const suspended = {
    ...state,
    authenticatedUserId: operator.id,
    users: state.users.map(user => (user.id === operator.id ? { ...user, status: "suspended" as const } : user)),
  };
  expect(authenticatedUser(suspended).id).toBe(operator.id);
  expect(can(authenticatedUser(suspended), "users:manage")).toBe(false);
  expect(can(activeUser(suspended), "settings:manage")).toBe(false);
});
it("identidade ausente no diretório nunca assume o primeiro administrador", () => {
  const state = { ...seedAccessState(), authenticatedUserId: "missing-session-user" };
  expect(authenticatedUser(state).status).toBe("suspended");
  expect(authenticatedUser(state).permissions).toEqual([]);
  expect(can(authenticatedUser(state), "finance:release")).toBe(false);
});

it("gestor de usuários alcança gestão sem receber administração de configurações", () => {
  const operator = seedAccessState().users.find(user => user.access === "operator")!;
  const manager = { ...operator, permissions: ["users:manage" as const] };
  expect(canAccessView(manager, "settings")).toBe(true);
  expect(can(manager, "settings:manage")).toBe(false);
  expect(canAccessView({ ...operator, permissions: ["settings:view"] }, "settings")).toBe(false);
  expect(canAccessView({ ...manager, status: "suspended" }, "settings")).toBe(false);
});
