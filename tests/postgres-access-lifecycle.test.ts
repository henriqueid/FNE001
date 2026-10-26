/** Ciclo com handlers HTTP reais e PostgreSQL descartável; nunca usa conexão não autorizada. */
import { beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/src/server/database/postgres";
import { allPermissions, canAccessView, type AccessUser } from "@/src/domain/access/model";
import { applyAccessUserProfile, loadAccessDirectory, principalForSession } from "@/src/server/access/repository";
import { createUserSession, hashSessionToken, loginSession, sessionCookie } from "@/src/server/access/session";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { hashPassword } from "@/src/server/access/password";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import { POST as signup } from "@/app/api/auth/requests/route";
import { POST as login, GET as session, DELETE as logout } from "@/app/api/auth/session/route";
import { GET as directory, POST as createUser, PUT as saveUser } from "@/app/api/access/users/route";
import { POST as proposeAccess, PUT as decideAccess } from "@/app/api/access/change-requests/route";
import { GET as settings } from "@/app/api/operational-parameters/route";

const isolated = process.env.STRATO_TEST_DATABASE_URL;
const password = "ChurumeLocal2026Aa";
const suffix = () => crypto.randomUUID().replaceAll("-", "");
function cpf(seed: number) {
  let digits = String(seed).padStart(9, "0").slice(-9);
  for (let count = 9; count <= 10; count++) {
    const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (count + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    digits += String(remainder === 10 ? 0 : remainder);
  }
  return digits;
}
function req(tenantId: string, cookie: string, method: string, body?: unknown, path = "/api/access/users") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "x-strato-tenant-id": tenantId, cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function fixture() {
  const db = getDatabase();
  const stamp = suffix();
  const tenantId = `CHURUME-access-${stamp}`;
  await db
    .prepare(
      "insert into private.tenants(tenant_id,legal_name,display_name) values (?,'CHURUME Acesso','CHURUME Acesso')",
    )
    .bind(tenantId)
    .run();
  const admin: AccessUser = {
    id: `CHURUME-admin-${stamp}`,
    email: `admin-${stamp}@churume.invalid`,
    loginName: `admin.${stamp.slice(0, 12)}`,
    name: "CHURUME Administrador",
    role: "Administrador",
    department: "Diretoria",
    functionalAreas: ["Diretoria"],
    access: "admin",
    status: "active",
    tenantIds: [tenantId],
    responsibilities: [],
    companyScopes: ["CHURUME Empresa A", "CHURUME Empresa B"],
    permissions: [...allPermissions],
    authorityIds: [],
  };
  await db.transaction!(transaction => applyAccessUserProfile(transaction, tenantId, admin.id, admin));
  const issued = await createUserSession(db, admin.id);
  const cookie = sessionCookie(issued.token, issued.expiresAt, false).split(";")[0];
  return { db, tenantId, admin, cookie, stamp };
}
async function save(f: Awaited<ReturnType<typeof fixture>>, user: AccessUser) {
  const response = await saveUser(
    req(f.tenantId, f.cookie, "PUT", { version: 2, authenticatedUserId: f.admin.id, users: [user] }),
  );
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  return (await response.json()).users.find((item: AccessUser) => item.id === user.id) as AccessUser;
}
async function authenticate(tenantId: string, identifier: string, secret = password) {
  return login(req(tenantId, "", "POST", { identifier, password: secret }, "/api/auth/session"));
}
describe.skipIf(!isolated)("CHURUME ciclo real de usuários em PostgreSQL local descartável", () => {
  beforeAll(() => {
    const url = new URL(isolated!);
    if (url.hostname !== "127.0.0.1" || !url.port || url.port === "5432" || process.env.DATABASE_URL !== isolated)
      throw new Error(
        "Exige STRATO_TEST_DATABASE_URL em loopback/porta dedicada, igual à conexão do processo isolado.",
      );
  });
  it("solicita, recusa pending, aprova, autentica por 3 identidades, aplica revogação/empresa em sessão aberta e suspende", async () => {
    const f = await fixture();
    const input = {
      name: "CHURUME Solicitante",
      loginName: `user.${f.stamp.slice(0, 12)}`,
      cpf: cpf(170000000 + Math.floor(Math.random() * 700000000)),
      email: `${f.stamp}@churume.invalid`,
      password,
      department: "Cadastro",
    };
    expect((await signup(req(f.tenantId, "", "POST", input))).status).toBe(201);
    expect((await authenticate(f.tenantId, input.loginName)).status).toBe(401);
    expect((await signup(req(f.tenantId, "", "POST", input))).status).toBe(200);
    const state = await loadAccessDirectory(f.db, f.tenantId, f.admin.id);
    const pending = state.users.find(user => user.loginName === input.loginName)!;
    expect(pending.status).toBe("pending");
    expect(pending.permissions).toEqual([]);
    const approved = await save(f, {
      ...pending,
      status: "active",
      role: "CHURUME Analista multifuncional",
      functionalAreas: ["Cadastro", "Operações"],
      permissions: ["dashboard:view", "registry:view", "settings:view"],
      companyScopes: ["CHURUME Empresa A"],
    });
    expect(canAccessView(approved, "registry")).toBe(true);
    expect(canAccessView(approved, "finance")).toBe(false);
    expect(canAccessView(approved, "operations")).toBe(false);
    expect((await authenticate(f.tenantId, input.loginName, "SenhaIncorreta1")).status).toBe(401);
    for (const identifier of [input.loginName, input.cpf, input.email])
      expect((await authenticate(f.tenantId, identifier)).status).toBe(201);
    const accepted = await authenticate(f.tenantId, input.loginName);
    const cookie = accepted.headers.get("set-cookie")!.split(";")[0];
    expect(cookie).toContain("strato_session=");
    expect(accepted.headers.get("set-cookie")).toContain("HttpOnly");
    expect((await session(req(f.tenantId, cookie, "GET"))).status).toBe(200);
    const ownDirectory = await directory(req(f.tenantId, cookie, "GET"));
    expect(ownDirectory.status).toBe(200);
    const ownState = await ownDirectory.json();
    expect(ownState.authenticatedUserId).toBe(approved.id);
    expect(ownState.users.map((item: AccessUser) => item.id)).toEqual([approved.id]);
    expect(
      (
        await saveUser(
          req(f.tenantId, cookie, "PUT", {
            version: 2,
            users: [{ ...approved, access: "admin", permissions: allPermissions }],
          }),
        )
      ).status,
    ).toBe(403);
    expect((await settings(req(f.tenantId, cookie, "GET")))?.status).toBe(200);
    const revoked = await save(f, {
      ...approved,
      permissions: ["dashboard:view"],
      companyScopes: ["CHURUME Empresa B"],
    });
    expect((await settings(req(f.tenantId, cookie, "GET")))?.status).toBe(403);
    const fresh = (await (await session(req(f.tenantId, cookie, "GET"))).json()).principal;
    expect(fresh.permissions).toEqual(["dashboard:view"]);
    expect(principalHasCompanyScope(fresh, "CHURUME Empresa A")).toBe(false);
    expect(principalHasCompanyScope(fresh, "CHURUME Empresa B")).toBe(true);
    expect((await session(req(`CHURUME-foreign-${f.stamp}`, cookie, "GET"))).status).toBe(401);
    const suspended = await save(f, { ...revoked, status: "suspended" });
    expect((await session(req(f.tenantId, cookie, "GET"))).status).toBe(401);
    expect((await authenticate(f.tenantId, input.loginName)).status).toBe(401);
    await save(f, { ...suspended, status: "active" });
    expect((await session(req(f.tenantId, cookie, "GET"))).status).toBe(401);
    const newLogin = await authenticate(f.tenantId, input.loginName);
    const newCookie = newLogin.headers.get("set-cookie")!.split(";")[0];
    expect((await logout(req(f.tenantId, newCookie, "DELETE"))).status).toBe(200);
    expect((await session(req(f.tenantId, newCookie, "GET"))).status).toBe(401);
    const events = await f.db
      .prepare(
        "select actor_id,event_type from private.access_events where tenant_id = ? and subject_user_id = ? order by created_at",
      )
      .bind(f.tenantId, approved.id)
      .all<{ actor_id: string; event_type: string }>();
    expect(events.results[0].event_type).toBe("ACCESS_REQUESTED");
    expect(events.results.slice(1).every(event => event.actor_id === f.admin.id)).toBe(true);
  });
  it("suspensão concorrente ao login revoga também sessão emitida durante autenticação", async () => {
    const f = await fixture();
    const user: AccessUser = {
      ...f.admin,
      id: `CHURUME-race-${f.stamp}`,
      email: `race-${f.stamp}@churume.invalid`,
      loginName: `race.${f.stamp.slice(0, 12)}`,
      access: "operator",
      permissions: ["dashboard:view"],
    };
    await f.db.transaction!(tx => applyAccessUserProfile(tx, f.tenantId, f.admin.id, user));
    await f.db
      .prepare("insert into private.access_credentials(user_id,password_hash,status) values (?,?,'active')")
      .bind(user.id, await hashPassword(password))
      .run();
    let arrived!: () => void;
    let release!: () => void;
    const atPassword = new Promise<void>(resolve => {
      arrived = resolve;
    });
    const resume = new Promise<void>(resolve => {
      release = resolve;
    });
    const intercept = (database: DecisionDatabase): DecisionDatabase => ({
      ...database,
      prepare(query) {
        const statement = database.prepare(query);
        if (!query.includes("failed_attempts = 0")) return statement;
        const run = statement.run.bind(statement);
        statement.run = async () => {
          arrived();
          await resume;
          return run();
        };
        return statement;
      },
      transaction: work => database.transaction!(tx => work(intercept(tx))),
    });
    const pendingLogin = loginSession(intercept(f.db), f.tenantId, user.loginName!, password);
    await atPassword;
    let suspensionDone = false;
    const suspension = f.db.transaction!(tx =>
      applyAccessUserProfile(tx, f.tenantId, f.admin.id, { ...user, status: "suspended" }),
    ).then(() => {
      suspensionDone = true;
    });
    try {
      // A suspensão termina no código vulnerável; com lock, aguarda a transação do login.
      let coordinated = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const blocked = await f.db
          .prepare(
            "select count(*)::int as count from pg_stat_activity where wait_event_type = 'Lock' and query like '%INSERT INTO private.access_users%'",
          )
          .first<{ count: number }>();
        if (suspensionDone || blocked!.count > 0) {
          coordinated = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      expect(coordinated).toBe(true);
    } finally {
      release();
    }
    const issued = await pendingLogin;
    await suspension;
    expect(issued).not.toBeNull();
    await f.db.transaction!(tx => applyAccessUserProfile(tx, f.tenantId, f.admin.id, user));
    expect(await principalForSession(f.db, await hashSessionToken(issued!.token), f.tenantId)).toBeNull();
  });
  it("cria dois usuários sem email, valida duplicidade/senha e não autentica login inexistente contra CPF vazio", async () => {
    const f = await fixture();
    const legacy = {
      ...f.admin,
      id: `CHURUME-legacy-${f.stamp}`,
      email: `legacy-${f.stamp}@churume.invalid`,
      loginName: `legacy.${f.stamp.slice(0, 12)}`,
      access: "operator" as const,
      permissions: [],
    };
    await f.db.transaction!(transaction => applyAccessUserProfile(transaction, f.tenantId, f.admin.id, legacy));
    await f.db
      .prepare("insert into private.access_credentials(user_id,password_hash,status) values (?,?,'active')")
      .bind(legacy.id, await hashPassword(password))
      .run();
    expect((await authenticate(f.tenantId, `inexistente.${f.stamp}`)).status).toBe(401);
    const base = { name: "CHURUME Gerenciado", department: "Operações", password };
    const first = {
      ...base,
      loginName: `one.${f.stamp.slice(0, 12)}`,
      cpf: cpf(110000000 + Math.floor(Math.random() * 10000000)),
    };
    const second = {
      ...base,
      loginName: `two.${f.stamp.slice(0, 12)}`,
      cpf: cpf(210000000 + Math.floor(Math.random() * 10000000)),
    };
    expect((await createUser(req(f.tenantId, f.cookie, "POST", { ...first, password: "fraca" }))).status).toBe(400);
    expect((await createUser(req(f.tenantId, f.cookie, "POST", first))).status).toBe(201);
    expect((await createUser(req(f.tenantId, f.cookie, "POST", first))).status).toBe(409);
    expect((await createUser(req(f.tenantId, f.cookie, "POST", second))).status).toBe(201);
    expect((await authenticate(f.tenantId, second.loginName)).status).toBe(401);
  });
  it("gestor de usuários não se promove pela API; somente administrador vigente decide proposta", async () => {
    const f = await fixture();
    const manager: AccessUser = {
      ...f.admin,
      id: `CHURUME-manager-${f.stamp}`,
      email: `manager-${f.stamp}@churume.invalid`,
      loginName: `manager.${f.stamp.slice(0, 12)}`,
      access: "manager",
      department: "Operações",
      functionalAreas: ["Operações"],
      permissions: ["dashboard:view", "users:manage"],
      authorityIds: [],
    };
    await f.db.transaction!(transaction => applyAccessUserProfile(transaction, f.tenantId, f.admin.id, manager));
    const issued = await createUserSession(f.db, manager.id);
    const cookie = sessionCookie(issued.token, issued.expiresAt, false).split(";")[0];
    const proposed = { ...manager, access: "admin" as const, permissions: [...allPermissions] };
    expect(canAccessView(manager, "settings")).toBe(true);
    expect((await saveUser(req(f.tenantId, cookie, "PUT", { version: 2, users: [proposed] }))).status).toBe(409);
    const proposal = await proposeAccess(
      req(f.tenantId, cookie, "POST", {
        subjectUserId: manager.id,
        proposed,
        reason: "CHURUME nova competência solicitada",
      }),
    );
    expect(proposal.status).toBe(201);
    const { changeId } = await proposal.json();
    expect(changeId).toBeTruthy();
    expect((await (await session(req(f.tenantId, cookie, "GET"))).json()).principal.access).toBe("manager");
    expect(
      (
        await decideAccess(
          req(f.tenantId, cookie, "PUT", { changeId, decision: "APPROVED", reason: "Tentativa do beneficiário" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await decideAccess(
          req(f.tenantId, f.cookie, "PUT", {
            changeId,
            decision: "APPROVED",
            reason: "CHURUME conferência independente",
          }),
        )
      ).status,
    ).toBe(200);
    expect((await (await session(req(f.tenantId, cookie, "GET"))).json()).principal.access).toBe("admin");
  });
  it("alçada é independente de departamento/permissão e alterações afetam sessão aberta", async () => {
    const f = await fixture();
    const operator: AccessUser = {
      ...f.admin,
      id: `CHURUME-credit-${f.stamp}`,
      email: `credit-${f.stamp}@churume.invalid`,
      loginName: `credit.${f.stamp.slice(0, 12)}`,
      access: "operator",
      department: "Cadastro",
      functionalAreas: ["Cadastro", "Risco e crédito"],
      permissions: ["registry:view", "risk:decide"],
      companyScopes: ["CHURUME Empresa A"],
      authorityIds: [],
    };
    await f.db.transaction!(transaction => applyAccessUserProfile(transaction, f.tenantId, f.admin.id, operator));
    const issued = await createUserSession(f.db, operator.id);
    const tokenHash = await hashSessionToken(issued.token);
    expect((await principalForSession(f.db, tokenHash, f.tenantId))?.authorityIds).toEqual([]);
    await save(f, { ...operator, authorityIds: ["credit-director"] });
    let principal = await principalForSession(f.db, tokenHash, f.tenantId);
    expect(principal?.authorityIds).toEqual(["credit-director"]);
    expect(principal?.department).toBe("Cadastro");
    expect(principal?.permissions).toContain("risk:decide");
    await f.db
      .prepare(
        "update private.authority_assignments set valid_from = now() - interval '2 days', valid_until = now() - interval '1 day' where tenant_id = ? and user_id = ?",
      )
      .bind(f.tenantId, operator.id)
      .run();
    expect((await principalForSession(f.db, tokenHash, f.tenantId))?.authorityIds).toEqual([]);
    await save(f, { ...operator, authorityIds: ["credit-director"], permissions: ["registry:view"] });
    principal = await principalForSession(f.db, tokenHash, f.tenantId);
    expect(principal?.authorityIds).toEqual(["credit-director"]);
    expect(principal?.permissions).not.toContain("risk:decide");
    await save(f, operator);
    expect((await principalForSession(f.db, tokenHash, f.tenantId))?.authorityIds).toEqual([]);
  });
  it("GET self-only do operador não expõe diretório e revalida vínculo e suspensão", async () => {
    const f = await fixture();
    const operator: AccessUser = {
      ...f.admin,
      id: `CHURUME-operator-${f.stamp}`,
      name: "CHURUME Operador real",
      loginName: `operator.${f.stamp.slice(0, 12)}`,
      email: `operator-${f.stamp}@churume.invalid`,
      access: "operator",
      role: "Operador",
      department: "Operações",
      functionalAreas: ["Operações"],
      permissions: ["dashboard:view", "operations:view"],
      companyScopes: ["CHURUME Empresa A"],
    };
    await f.db.transaction!(transaction => applyAccessUserProfile(transaction, f.tenantId, f.admin.id, operator));
    const issued = await createUserSession(f.db, operator.id);
    const cookie = sessionCookie(issued.token, issued.expiresAt, false).split(";")[0];
    const response = await directory(req(f.tenantId, cookie, "GET"));
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.authenticatedUserId).toBe(operator.id);
    expect(state.users).toHaveLength(1);
    expect(state.users[0]).toMatchObject({
      id: operator.id,
      name: "CHURUME Operador real",
      access: "operator",
      permissions: ["dashboard:view", "operations:view"],
    });
    const managed = await directory(req(f.tenantId, f.cookie, "GET"));
    expect((await managed.json()).users).toHaveLength(2);
    expect((await createUser(req(f.tenantId, cookie, "POST", {}))).status).toBe(403);
    expect((await saveUser(req(f.tenantId, cookie, "PUT", { version: 2, users: [] }))).status).toBe(403);
    expect((await directory(req(`CHURUME-unlinked-${f.stamp}`, cookie, "GET"))).status).toBe(401);
    await f.db
      .prepare("update private.access_users set status = 'suspended' where user_id = ?")
      .bind(operator.id)
      .run();
    expect((await directory(req(f.tenantId, cookie, "GET"))).status).toBe(401);
  });
});
