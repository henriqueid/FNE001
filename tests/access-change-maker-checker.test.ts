import { seedAccessState, type AccessUser } from "@/src/domain/access/model";
import { decideAccessChange, requestAccessChange } from "@/src/server/access/change-requests";
import { AccessCriticalChangeError, saveAccessDirectory } from "@/src/server/access/repository";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import { describe, expect, it } from "vitest";

const unwrap = (value: unknown) =>
  value && typeof value === "object" && "__stratoJson" in value
    ? (value as unknown as { value: unknown }).value
    : value;

class Statement implements DecisionStatement {
  values: unknown[] = [];
  constructor(
    readonly query: string,
    private readonly database: FakeDatabase,
  ) {}
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async first<T>() {
    return (this.database.first(this.query) as T | null) ?? null;
  }
  async all<T>() {
    return { results: (this.database.all(this.query) as T[]) ?? [] };
  }
  async run() {
    this.database.run(this.query, this.values.map(unwrap));
    return { success: true };
  }
}

class FakeDatabase implements DecisionDatabase {
  user: AccessUser = {
    ...seedAccessState().users.find(candidate => candidate.access === "operator")!,
    id: "subject",
    tenantIds: ["tenant-1"],
    companyScopes: ["Empresa A"],
  };
  request?: Record<string, unknown>;
  runs: Array<{ query: string; values: unknown[] }> = [];
  prepare(query: string) {
    return new Statement(query, this);
  }
  first(query: string) {
    if (query.includes("from private.access_change_requests")) return this.request ?? null;
    return null;
  }
  all(query: string) {
    if (query.includes("FROM private.access_users u"))
      return [
        {
          user_id: this.user.id,
          email: this.user.email,
          login_name: this.user.loginName ?? null,
          cpf: this.user.cpf ?? null,
          name: this.user.name,
          role: this.user.role,
          department: this.user.department,
          access_level: this.user.access,
          status: this.user.status,
          manager_user_id: this.user.managerUserId ?? null,
          commercial_rep_id: this.user.commercialRepId ?? null,
          account_manager_id: this.user.accountManagerId ?? null,
          operation_owner: this.user.operationOwner ?? null,
          substitute_user_id: this.user.substituteUserId ?? null,
          responsibilities_json: JSON.stringify(this.user.responsibilities),
          cedent_documents_json: JSON.stringify(this.user.cedentDocuments ?? []),
          revenue_goal_share: this.user.revenueGoalShare ?? null,
          company_scopes_json: JSON.stringify(this.user.companyScopes),
        },
      ];
    if (query.includes("FROM private.access_permissions"))
      return this.user.permissions.map(permission => ({ permission }));
    if (query.includes("FROM private.authority_assignments"))
      return (this.user.authorityIds ?? []).map(authority_id => ({ authority_id }));
    if (query.includes("FROM private.user_function_assignments"))
      return (this.user.functionalAreas ?? [this.user.department]).map(function_area => ({ function_area }));
    return [];
  }
  run(query: string, values: unknown[]) {
    this.runs.push({ query, values });
    if (query.includes("insert into private.access_change_requests"))
      this.request = {
        change_id: values[1],
        subject_user_id: values[2],
        previous_profile: values[3],
        proposed_profile: values[4],
        reason: values[5],
        status: "PENDING",
        requested_by: values[6],
        requested_by_name: values[7],
        requested_at: "2026-10-14T10:00:00.000Z",
        decided_by: null,
        decided_by_name: null,
        decided_at: null,
        decision_reason: null,
      };
  }
  async batch() {
    return [];
  }
  async exec() {}
  async transaction<T>(work: (database: DecisionDatabase) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const maker = { id: "maker", name: "Preparador" };
const checker = { id: "checker", name: "Aprovador" };

describe("maker-checker de privilégios", () => {
  it("bloqueia elevação direta no diretório", async () => {
    const db = new FakeDatabase();
    const proposed = { ...db.user, access: "admin" as const };
    await expect(
      saveAccessDirectory(db, "tenant-1", maker.id, {
        version: 2,
        authenticatedUserId: maker.id,
        users: [proposed],
      }),
    ).rejects.toBeInstanceOf(AccessCriticalChangeError);
    expect(db.runs).toHaveLength(0);
  });

  it("registra proposta sem alterar o perfil e impede decisão do solicitante ou beneficiário", async () => {
    const db = new FakeDatabase();
    const proposed = { ...db.user, status: "active" as const, access: "manager" as const };
    const changeId = await requestAccessChange(
      db,
      "tenant-1",
      maker,
      db.user.id,
      proposed,
      "Promoção aprovada no comitê de acessos.",
    );
    expect(changeId).toMatch(/^access-change-/);
    expect(db.user.access).toBe("operator");
    await expect(decideAccessChange(db, "tenant-1", maker, changeId, "APPROVED", "Conferido")).rejects.toThrow(
      "solicitante",
    );
    await expect(
      decideAccessChange(db, "tenant-1", { id: db.user.id, name: db.user.name }, changeId, "APPROVED", "Conferido"),
    ).rejects.toThrow("beneficiário");
  });

  it("permite que outro administrador aplique exatamente a proposta congelada", async () => {
    const db = new FakeDatabase();
    const proposed = {
      ...db.user,
      access: "manager" as const,
      permissions: [...db.user.permissions, "users:manage" as const],
    };
    const changeId = await requestAccessChange(
      db,
      "tenant-1",
      maker,
      db.user.id,
      proposed,
      "Gestão de equipe validada pela Diretoria.",
    );
    await decideAccessChange(db, "tenant-1", checker, changeId, "APPROVED", "Evidências conferidas");
    expect(
      db.runs.some(
        item =>
          item.query.toLowerCase().includes("insert into private.access_events") &&
          item.values.includes("ACCESS_CRITICAL_CHANGE_APPROVED"),
      ),
    ).toBe(true);
    expect(db.runs.some(item => item.query.toLowerCase().includes("update private.access_change_requests"))).toBe(true);
  });
});
