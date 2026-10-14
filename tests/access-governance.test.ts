import { criticalAccessChanges } from "@/src/domain/access/governance";
import { seedAccessState } from "@/src/domain/access/model";
import { describe, expect, it } from "vitest";

const operator = seedAccessState().users.find(user => user.access === "operator")!;

describe("governança de alterações de acesso", () => {
  it("classifica ativações, elevações, escopos, alçadas e identificadores como críticos", () => {
    const changes = criticalAccessChanges(
      { ...operator, status: "pending" },
      {
        ...operator,
        status: "active",
        access: "admin",
        permissions: [...operator.permissions, "users:manage"],
        authorityIds: ["credit-director"],
        companyScopes: [...operator.companyScopes, "Nova empresa"],
        email: "novo@strato.local",
      },
    );
    expect(changes).toContain("ativação do acesso");
    expect(changes).toContain("elevação do nível de acesso");
    expect(changes).toContain("novas permissões");
    expect(changes).toContain("novas alçadas");
    expect(changes).toContain("ampliação do escopo empresarial");
    expect(changes).toContain("e-mail de acesso");
  });

  it("permite redução de privilégio e suspensão imediata", () => {
    const admin = seedAccessState().users[0];
    expect(
      criticalAccessChanges(admin, {
        ...admin,
        status: "suspended",
        access: "manager",
        permissions: ["dashboard:view"],
        authorityIds: [],
        companyScopes: admin.companyScopes.slice(0, 1),
      }),
    ).toEqual([]);
  });
});
