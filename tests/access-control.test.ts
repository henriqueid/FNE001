import {
  activateUser,
  activeUser,
  can,
  migrateAccessState,
  permissionsFor,
  seedAccessState,
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
    const active = activateUser(seeded, operator.id);
    const suspended = updateAccessUser(active, { ...operator, status: "suspended" });

    expect(activeUser(active).id).toBe(operator.id);
    expect(activateUser(suspended, operator.id)).toBe(suspended);
  });

  it("aplica permissões padrão por departamento e nível", () => {
    expect(permissionsFor("Risco e crédito", "operator")).toContain("risk:decide");
    expect(permissionsFor("Operações", "operator")).not.toContain("finance:release");
    expect(permissionsFor("Operações", "manager")).toContain("users:manage");
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
      activeUserId: seeded.activeUserId,
      users: [{ ...seeded.users[0], role: "Administrador principal" }],
    });

    expect(migrated.users[0].role).toBe("Administrador principal");
    expect(migrated.users.length).toBe(seeded.users.length);
  });
});
