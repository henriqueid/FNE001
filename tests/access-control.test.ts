import {
  activeUser,
  authenticatedUser,
  can,
  canAccessView,
  defaultViewFor,
  migrateAccessState,
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
    expect(permissionsFor("Operações", "manager")).toContain("users:manage");
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
});
