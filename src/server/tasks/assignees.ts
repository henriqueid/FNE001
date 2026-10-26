import { effectivePermissions, type AccessUser, type Permission } from "@/src/domain/access/model";
import type { UserDepartment } from "@/src/domain/copilot/daily-briefing";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type AssigneeRow = {
  user_id: string;
  name: string;
  role: string;
  department: UserDepartment;
  access_level: AccessUser["access"];
  status: AccessUser["status"];
  tenant_id: string;
  company_scopes_json: string;
};

export async function loadTaskAssignee(
  db: DecisionDatabase,
  tenantId: string,
  userId: string,
  now: string,
): Promise<AccessUser | null> {
  const row = await db
    .prepare(
      `select u.user_id, u.name, u.role, u.department, u.access_level, u.status,
            m.tenant_id, m.company_scopes::text as company_scopes_json
     from private.access_users u join private.tenant_memberships m on m.user_id = u.user_id
     where m.tenant_id = ? and u.user_id = ? and u.status = 'active'`,
    )
    .bind(tenantId, userId)
    .first<AssigneeRow>();
  if (!row || row.status !== "active") return null;
  const [permissions, authorities, functions] = await Promise.all([
    db
      .prepare("select permission from private.access_permissions where tenant_id = ? and user_id = ?")
      .bind(tenantId, userId)
      .all<{ permission: Permission }>(),
    db
      .prepare(
        "select authority_id from private.authority_assignments where tenant_id = ? and user_id = ? and valid_from <= ? and (valid_until is null or valid_until >= ?)",
      )
      .bind(tenantId, userId, now, now)
      .all<{ authority_id: string }>(),
    db
      .prepare("select function_area from private.user_function_assignments where tenant_id = ? and user_id = ?")
      .bind(tenantId, userId)
      .all<{ function_area: UserDepartment }>(),
  ]);
  return {
    id: row.user_id,
    name: row.name,
    email: "",
    role: row.role,
    department: row.department,
    access: row.access_level,
    status: row.status,
    tenantIds: [tenantId],
    responsibilities: [],
    companyScopes: JSON.parse(row.company_scopes_json) as string[],
    permissions: effectivePermissions({
      access: row.access_level,
      permissions: permissions.results.map(item => item.permission),
    }),
    authorityIds: authorities.results.map(item => item.authority_id),
    functionalAreas: functions.results.map(item => item.function_area),
  };
}
