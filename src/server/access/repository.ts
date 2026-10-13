import {
  permissionsFor,
  seedAccessState,
  type AccessState,
  type AccessUser,
  type Permission,
} from "@/src/domain/access/model";
import { normalizeCpf, normalizeLoginName } from "@/src/domain/access/identity";
import { userFunctionalAreas, type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { type DecisionDatabase } from "@/src/server/decisions/repository";
import { verifyPassword } from "./password";

export type ServerPrincipal = {
  id: string;
  name: string;
  role: string;
  department: AccessUser["department"];
  functionalAreas: UserDepartment[];
  access: AccessUser["access"];
  status: "active" | "suspended";
  tenantId: string;
  permissions: Permission[];
  authorityIds: string[];
  companyScopes: string[];
};

export async function ensureAccessSchema(_db: DecisionDatabase) {
  // The PostgreSQL schema and immutable audit triggers live in Supabase migrations.
}

export async function seedAccessDirectory(db: DecisionDatabase) {
  await ensureAccessSchema(db);
}

type PrincipalRow = {
  user_id: string;
  name: string;
  role: string;
  department: AccessUser["department"];
  access_level: AccessUser["access"];
  status: "active" | "suspended";
  tenant_id: string;
  company_scopes_json: string;
};

export async function principalForSession(
  db: DecisionDatabase,
  tokenHash: string,
  tenantId: string,
  at = new Date().toISOString(),
): Promise<ServerPrincipal | null> {
  await seedAccessDirectory(db);
  const user = await db
    .prepare(
      `SELECT u.user_id, u.name, u.role, u.department, u.access_level, u.status, m.tenant_id,
              m.company_scopes::text AS company_scopes_json
       FROM private.app_sessions s
       JOIN private.access_users u ON u.user_id = s.user_id
       JOIN private.tenant_memberships m ON m.user_id = u.user_id AND m.tenant_id = ?
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`,
    )
    .bind(tenantId, tokenHash, at)
    .first<PrincipalRow>();
  if (!user) return null;
  const permissions = await db
    .prepare("SELECT permission FROM private.access_permissions WHERE tenant_id = ? AND user_id = ?")
    .bind(tenantId, user.user_id)
    .all<{ permission: Permission }>();
  const authorities = await db
    .prepare(
      `SELECT authority_id FROM private.authority_assignments
       WHERE tenant_id = ? AND user_id = ? AND valid_from <= ? AND (valid_until IS NULL OR valid_until >= ?)`,
    )
    .bind(tenantId, user.user_id, at, at)
    .all<{ authority_id: string }>();
  const functions = await db
    .prepare(
      "SELECT function_area FROM private.user_function_assignments WHERE tenant_id = ? AND user_id = ? ORDER BY function_area",
    )
    .bind(tenantId, user.user_id)
    .all<{ function_area: UserDepartment }>();
  return {
    id: user.user_id,
    name: user.name,
    role: user.role,
    department: user.department,
    functionalAreas: functions.results.length ? functions.results.map(item => item.function_area) : [user.department],
    access: user.access_level,
    status: user.status,
    tenantId: user.tenant_id,
    permissions: permissions.results.map(item => item.permission),
    authorityIds: authorities.results.map(item => item.authority_id),
    companyScopes: JSON.parse(user.company_scopes_json) as string[],
  };
}

export async function createSession(db: DecisionDatabase, userId: string, tokenHash: string, expiresAt: string) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO private.app_sessions (token_hash, user_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
    )
    .bind(tokenHash, userId, now, expiresAt)
    .run();
}

type CredentialRow = {
  user_id: string;
  password_hash: string;
  credential_status: "pending" | "active" | "suspended";
  user_status: AccessUser["status"];
  locked_until: string | null;
};

export async function authenticateCredentials(
  db: DecisionDatabase,
  tenantId: string,
  identifier: string,
  password: string,
) {
  await seedAccessDirectory(db);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedCpf = normalizeCpf(identifier);
  const credential = await db
    .prepare(
      `SELECT c.user_id, c.password_hash, c.status AS credential_status,
        c.locked_until, u.status AS user_status
       FROM private.access_credentials c
       JOIN private.access_users u ON u.user_id = c.user_id
       JOIN private.tenant_memberships m ON m.user_id = u.user_id AND m.tenant_id = ?
       WHERE lower(COALESCE(u.email, '')) = ?
          OR lower(COALESCE(u.login_name, '')) = ?
          OR COALESCE(u.cpf, '') = ?`,
    )
    .bind(tenantId, normalizedIdentifier, normalizedIdentifier, normalizedCpf)
    .first<CredentialRow>();
  const now = new Date();
  if (
    !credential ||
    credential.credential_status !== "active" ||
    credential.user_status !== "active" ||
    (credential.locked_until && new Date(credential.locked_until) > now)
  )
    return null;
  if (!(await verifyPassword(password, credential.password_hash))) {
    const lockedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    await db
      .prepare(
        `UPDATE private.access_credentials SET
          failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN ? ELSE locked_until END,
          updated_at = ?
         WHERE user_id = ?`,
      )
      .bind(lockedUntil, now.toISOString(), credential.user_id)
      .run();
    return null;
  }
  await db
    .prepare(
      "UPDATE private.access_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE user_id = ?",
    )
    .bind(now.toISOString(), credential.user_id)
    .run();
  return credential.user_id;
}

export async function registerAccessRequest(
  db: DecisionDatabase,
  input: {
    tenantId: string;
    name: string;
    email: string;
    loginName: string;
    cpf: string;
    department: AccessUser["department"];
    passwordHash: string;
  },
) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedLoginName = normalizeLoginName(input.loginName);
  const normalizedCpf = normalizeCpf(input.cpf);
  const existing = await db
    .prepare(
      `SELECT user_id, status FROM private.access_users
       WHERE lower(COALESCE(email, '')) = ? OR lower(COALESCE(login_name, '')) = ? OR cpf = ?`,
    )
    .bind(normalizedEmail, normalizedLoginName, normalizedCpf)
    .first<{ user_id: string; status: AccessUser["status"] }>();
  if (existing) return { userId: existing.user_id, status: "existing" } as const;
  const userId = `user-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO private.access_users (
        user_id, email, login_name, cpf, name, role, department, access_level, status,
        manager_user_id, commercial_rep_id, account_manager_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Aguardando definição', ?, 'operator', 'pending', NULL, NULL, NULL, ?)`,
    )
    .bind(userId, normalizedEmail, normalizedLoginName, normalizedCpf, input.name.trim(), input.department, now)
    .run();
  await db
    .prepare(
      "INSERT INTO private.tenant_memberships (tenant_id, user_id, company_scopes, created_at) VALUES (?, ?, '[]'::jsonb, ?)",
    )
    .bind(input.tenantId, userId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO private.user_function_assignments
        (tenant_id, user_id, function_area, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.tenantId, userId, input.department, userId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO private.access_credentials
        (user_id, password_hash, status, failed_attempts, locked_until, created_at, updated_at)
       VALUES (?, ?, ?, 0, NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         password_hash = excluded.password_hash,
         status = CASE WHEN access_credentials.status = 'active' THEN 'active' ELSE excluded.status END,
         failed_attempts = 0, locked_until = NULL, updated_at = excluded.updated_at`,
    )
    .bind(userId, input.passwordHash, "pending", now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO private.access_events
        (event_id, tenant_id, actor_id, subject_user_id, event_type, payload, created_at)
       VALUES (?, ?, ?, ?, 'ACCESS_REQUESTED', ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      userId,
      userId,
      {
        email: normalizedEmail,
        loginName: normalizedLoginName,
        cpfEnding: normalizedCpf.slice(-4),
        requestedDepartment: input.department,
      },
      now,
    )
    .run();
  return { userId, status: "pending" } as const;
}

export class AccessIdentityConflictError extends Error {}

export async function createManagedAccessUser(
  db: DecisionDatabase,
  input: {
    tenantId: string;
    actorId: string;
    name: string;
    email?: string;
    loginName: string;
    cpf: string;
    department: AccessUser["department"];
    passwordHash: string;
  },
) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const normalizedLoginName = normalizeLoginName(input.loginName);
  const normalizedCpf = normalizeCpf(input.cpf);
  const existing = await db
    .prepare(
      `SELECT user_id FROM private.access_users
       WHERE lower(COALESCE(email, '')) = ? OR lower(COALESCE(login_name, '')) = ? OR cpf = ?`,
    )
    .bind(normalizedEmail ?? "", normalizedLoginName, normalizedCpf)
    .first<{ user_id: string }>();
  if (existing) throw new AccessIdentityConflictError("E-mail, login personalizado ou CPF já está em uso.");

  const userId = `user-${crypto.randomUUID()}`;
  const permissions = permissionsFor(input.department, "operator");
  const statements = [
    db
      .prepare(
        `INSERT INTO private.access_users (
          user_id, email, login_name, cpf, name, role, department, access_level, status,
          manager_user_id, commercial_rep_id, account_manager_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Aguardando definição', ?, 'operator', 'pending', NULL, NULL, NULL, ?)`,
      )
      .bind(userId, normalizedEmail, normalizedLoginName, normalizedCpf, input.name.trim(), input.department, now),
    db
      .prepare(
        "INSERT INTO private.tenant_memberships (tenant_id, user_id, company_scopes, created_at) VALUES (?, ?, '[]'::jsonb, ?)",
      )
      .bind(input.tenantId, userId, now),
    db
      .prepare(
        `INSERT INTO private.user_function_assignments
          (tenant_id, user_id, function_area, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(input.tenantId, userId, input.department, input.actorId, now),
    db
      .prepare(
        `INSERT INTO private.access_credentials
          (user_id, password_hash, status, failed_attempts, locked_until, created_at, updated_at)
         VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
      )
      .bind(userId, input.passwordHash, now, now),
    ...permissions.map(permission =>
      db
        .prepare(
          "INSERT INTO private.access_permissions (tenant_id, user_id, permission, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(input.tenantId, userId, permission, now),
    ),
    db
      .prepare(
        `INSERT INTO private.access_events
          (event_id, tenant_id, actor_id, subject_user_id, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, 'USER_CREATED_BY_ADMIN', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.tenantId,
        input.actorId,
        userId,
        {
          email: normalizedEmail,
          loginName: normalizedLoginName,
          cpfEnding: normalizedCpf.slice(-4),
          department: input.department,
        },
        now,
      ),
  ];
  await db.batch(statements);
  return userId;
}

export async function revokeSession(db: DecisionDatabase, tokenHash: string) {
  await ensureAccessSchema(db);
  await db
    .prepare("UPDATE private.app_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash)
    .run();
}

type AccessUserRow = {
  user_id: string;
  email: string | null;
  login_name: string | null;
  cpf: string | null;
  name: string;
  role: string;
  department: AccessUser["department"];
  access_level: AccessUser["access"];
  status: AccessUser["status"];
  manager_user_id: string | null;
  commercial_rep_id: string | null;
  account_manager_id: string | null;
  operation_owner: string | null;
  substitute_user_id: string | null;
  responsibilities_json: string;
  cedent_documents_json: string;
  revenue_goal_share: string | number | null;
  company_scopes_json: string;
};

export async function loadAccessDirectory(
  db: DecisionDatabase,
  tenantId: string,
  authenticatedUserId: string,
): Promise<AccessState> {
  await seedAccessDirectory(db);
  const result = await db
    .prepare(
      `SELECT u.*,
        u.responsibilities::text AS responsibilities_json,
        u.cedent_documents::text AS cedent_documents_json,
        m.company_scopes::text AS company_scopes_json
       FROM private.access_users u
       JOIN private.tenant_memberships m ON m.user_id = u.user_id
       WHERE m.tenant_id = ?
       ORDER BY u.name`,
    )
    .bind(tenantId)
    .all<AccessUserRow>();
  const seeded = new Map(seedAccessState().users.map(user => [user.id, user]));
  const users: AccessUser[] = [];
  for (const row of result.results) {
    const permissions = await db
      .prepare("SELECT permission FROM private.access_permissions WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, row.user_id)
      .all<{ permission: Permission }>();
    const authorities = await db
      .prepare("SELECT authority_id FROM private.authority_assignments WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, row.user_id)
      .all<{ authority_id: string }>();
    const functions = await db
      .prepare(
        "SELECT function_area FROM private.user_function_assignments WHERE tenant_id = ? AND user_id = ? ORDER BY function_area",
      )
      .bind(tenantId, row.user_id)
      .all<{ function_area: UserDepartment }>();
    const base = seeded.get(row.user_id);
    users.push({
      ...(base ?? {
        id: row.user_id,
        responsibilities: [],
      }),
      id: row.user_id,
      email: row.email ?? "",
      loginName: row.login_name ?? undefined,
      cpf: row.cpf ?? undefined,
      name: row.name,
      role: row.role,
      department: row.department,
      functionalAreas: functions.results.length ? functions.results.map(item => item.function_area) : [row.department],
      access: row.access_level,
      status: row.status,
      tenantIds: [tenantId],
      authorityIds: authorities.results.map(item => item.authority_id),
      companyScopes: JSON.parse(row.company_scopes_json) as string[],
      managerUserId: row.manager_user_id ?? undefined,
      commercialRepId: row.commercial_rep_id ?? undefined,
      accountManagerId: row.account_manager_id ?? undefined,
      operationOwner: row.operation_owner ?? undefined,
      substituteUserId: row.substitute_user_id ?? undefined,
      responsibilities: JSON.parse(row.responsibilities_json) as string[],
      cedentDocuments: JSON.parse(row.cedent_documents_json) as string[],
      revenueGoalShare: row.revenue_goal_share === null ? undefined : Number(row.revenue_goal_share),
      permissions: permissions.results.map(item => item.permission),
    });
  }
  return { version: 2, authenticatedUserId, users };
}

export async function saveAccessDirectory(db: DecisionDatabase, tenantId: string, actorId: string, state: AccessState) {
  await seedAccessDirectory(db);
  const now = new Date().toISOString();
  for (const user of state.users.filter(candidate => candidate.tenantIds.includes(tenantId))) {
    await db
      .prepare(
        `INSERT INTO private.access_users (
          user_id, email, login_name, cpf, name, role, department, access_level, status,
          manager_user_id, commercial_rep_id, account_manager_id,
          responsibilities, operation_owner, substitute_user_id, cedent_documents,
          revenue_goal_share, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          email = excluded.email, login_name = excluded.login_name, cpf = excluded.cpf,
          name = excluded.name, role = excluded.role,
          department = excluded.department, access_level = excluded.access_level, status = excluded.status,
          manager_user_id = excluded.manager_user_id, commercial_rep_id = excluded.commercial_rep_id,
          account_manager_id = excluded.account_manager_id,
          responsibilities = excluded.responsibilities, operation_owner = excluded.operation_owner,
          substitute_user_id = excluded.substitute_user_id, cedent_documents = excluded.cedent_documents,
          revenue_goal_share = excluded.revenue_goal_share, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        user.email || null,
        user.loginName ?? null,
        user.cpf ?? null,
        user.name,
        user.role,
        user.department,
        user.access,
        user.status,
        user.managerUserId ?? null,
        user.commercialRepId ?? null,
        user.accountManagerId ?? null,
        user.responsibilities,
        user.operationOwner ?? null,
        user.substituteUserId ?? null,
        user.cedentDocuments ?? [],
        user.revenueGoalShare ?? null,
        now,
      )
      .run();
    await db
      .prepare("UPDATE private.access_credentials SET status = ?, updated_at = ? WHERE user_id = ?")
      .bind(user.status === "active" ? "active" : user.status, now, user.id)
      .run();
    await db
      .prepare(
        `INSERT INTO private.tenant_memberships (tenant_id, user_id, company_scopes, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tenant_id, user_id) DO UPDATE SET company_scopes = excluded.company_scopes`,
      )
      .bind(tenantId, user.id, user.companyScopes, now)
      .run();
    await db
      .prepare("DELETE FROM private.user_function_assignments WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, user.id)
      .run();
    for (const area of userFunctionalAreas(user))
      await db
        .prepare(
          `INSERT INTO private.user_function_assignments
            (tenant_id, user_id, function_area, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(tenantId, user.id, area, actorId, now)
        .run();
    await db
      .prepare("DELETE FROM private.access_permissions WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, user.id)
      .run();
    for (const permission of user.permissions)
      await db
        .prepare(
          "INSERT INTO private.access_permissions (tenant_id, user_id, permission, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(tenantId, user.id, permission, now)
        .run();
    await db
      .prepare("DELETE FROM private.authority_assignments WHERE tenant_id = ? AND user_id = ?")
      .bind(tenantId, user.id)
      .run();
    for (const authorityId of user.authorityIds ?? [])
      await db
        .prepare(
          `INSERT INTO private.authority_assignments
            (tenant_id, user_id, authority_id, valid_from, valid_until, created_at)
           VALUES (?, ?, ?, ?, NULL, ?)`,
        )
        .bind(tenantId, user.id, authorityId, now, now)
        .run();
    await db
      .prepare(
        `INSERT INTO private.access_events
          (event_id, tenant_id, actor_id, subject_user_id, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, 'ACCESS_PROFILE_SAVED', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tenantId,
        actorId,
        user.id,
        {
          role: user.role,
          department: user.department,
          functionalAreas: userFunctionalAreas(user),
          access: user.access,
          status: user.status,
          companyScopes: user.companyScopes,
          permissions: user.permissions,
          authorityIds: user.authorityIds ?? [],
        },
        now,
      )
      .run();
  }
}
