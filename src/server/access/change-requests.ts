import { criticalAccessChanges, type AccessChangeRequest } from "@/src/domain/access/governance";
import type { AccessUser } from "@/src/domain/access/model";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { applyAccessUserProfile, loadAccessDirectory, type ServerPrincipal } from "./repository";

type ChangeRow = {
  change_id: string;
  subject_user_id: string;
  previous_profile: AccessUser;
  proposed_profile: AccessUser;
  reason: string;
  status: AccessChangeRequest["status"];
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

export class AccessChangeConflictError extends Error {}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};

const same = (left: unknown, right: unknown) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const mapped = (row: ChangeRow): AccessChangeRequest => ({
  id: row.change_id,
  subjectUserId: row.subject_user_id,
  previous: row.previous_profile,
  proposed: row.proposed_profile,
  reason: row.reason,
  status: row.status,
  requestedById: row.requested_by,
  requestedBy: row.requested_by_name,
  requestedAt: row.requested_at,
  decidedById: row.decided_by ?? undefined,
  decidedBy: row.decided_by_name ?? undefined,
  decidedAt: row.decided_at ?? undefined,
  decisionReason: row.decision_reason ?? undefined,
});

export async function listPendingAccessChanges(db: DecisionDatabase, tenantId: string) {
  const result = await db
    .prepare(
      `select change_id, subject_user_id, previous_profile, proposed_profile, reason, status,
              requested_by, requested_by_name, requested_at, decided_by, decided_by_name,
              decided_at, decision_reason
       from private.access_change_requests
       where tenant_id = ? and status = 'PENDING'
       order by requested_at`,
    )
    .bind(tenantId)
    .all<ChangeRow>();
  return result.results.map(mapped);
}

export async function requestAccessChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  subjectUserId: string,
  proposed: AccessUser,
  reason: string,
) {
  if (reason.trim().length < 10) throw new AccessChangeConflictError("Informe um motivo com pelo menos 10 caracteres.");
  const directory = await loadAccessDirectory(db, tenantId, actor.id);
  const previous = directory.users.find(user => user.id === subjectUserId);
  if (!previous) throw new AccessChangeConflictError("O usuário não pertence a esta organização.");
  if (proposed.id !== subjectUserId || !proposed.tenantIds.includes(tenantId))
    throw new AccessChangeConflictError("O perfil proposto não corresponde ao usuário e à organização.");
  const critical = criticalAccessChanges(previous, proposed);
  if (!critical.length) throw new AccessChangeConflictError("A proposta não contém uma alteração crítica de acesso.");
  const requester = directory.users.find(user => user.id === actor.id);
  if (requester?.status === "active" && requester.access === "admin") {
    if (!db.transaction) throw new AccessChangeConflictError("A alteração administrativa exige transação de banco.");
    await db.transaction(transaction => applyAccessUserProfile(transaction, tenantId, actor.id, proposed));
    return null;
  }
  const changeId = `access-change-${crypto.randomUUID()}`;
  await db
    .prepare(
      `insert into private.access_change_requests
        (tenant_id, change_id, subject_user_id, previous_profile, proposed_profile,
         reason, requested_by, requested_by_name)
       values (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
    )
    .bind(
      tenantId,
      changeId,
      subjectUserId,
      jsonParameter(previous),
      jsonParameter(proposed),
      reason.trim(),
      actor.id,
      actor.name,
    )
    .run();
  return changeId;
}

export async function decideAccessChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: Pick<ServerPrincipal, "id" | "name">,
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason: string,
) {
  if (decisionReason.trim().length < 5)
    throw new AccessChangeConflictError("Informe uma justificativa de decisão com pelo menos 5 caracteres.");
  const work = async (transaction: DecisionDatabase) => {
    const row = await transaction
      .prepare(
        `select change_id, subject_user_id, previous_profile, proposed_profile, reason, status,
                requested_by, requested_by_name, requested_at, decided_by, decided_by_name,
                decided_at, decision_reason
         from private.access_change_requests
         where tenant_id = ? and change_id = ?
         for update`,
      )
      .bind(tenantId, changeId)
      .first<ChangeRow>();
    if (!row || row.status !== "PENDING") throw new AccessChangeConflictError("A solicitação não está mais pendente.");
    const directory = await loadAccessDirectory(transaction, tenantId, actor.id);
    const decider = directory.users.find(user => user.id === actor.id);
    const directAdmin = decider?.status === "active" && decider.access === "admin";
    if (!directAdmin && row.requested_by === actor.id)
      throw new AccessChangeConflictError("O solicitante não pode decidir a própria alteração.");
    if (!directAdmin && row.subject_user_id === actor.id)
      throw new AccessChangeConflictError("O beneficiário não pode aprovar a própria alteração.");
    const now = new Date().toISOString();
    if (decision === "APPROVED") {
      const current = directory.users.find(user => user.id === row.subject_user_id);
      if (!current || !same(current, row.previous_profile))
        throw new AccessChangeConflictError(
          "O perfil atual mudou durante a espera. Rejeite esta solicitação e prepare uma nova proposta.",
        );
      if (!criticalAccessChanges(current, row.proposed_profile).length)
        throw new AccessChangeConflictError("A proposta deixou de representar uma alteração crítica.");
    }
    await transaction
      .prepare(
        `update private.access_change_requests set
           status = ?, decided_by = ?, decided_by_name = ?, decided_at = ?,
           decision_reason = ?, applied_at = ?
         where tenant_id = ? and change_id = ? and status = 'PENDING'`,
      )
      .bind(
        decision,
        actor.id,
        actor.name,
        now,
        decisionReason.trim(),
        decision === "APPROVED" ? now : null,
        tenantId,
        changeId,
      )
      .run();
    // Confere o administrador vigente antes de aplicar eventual redução do próprio acesso.
    if (decision === "APPROVED")
      await applyAccessUserProfile(
        transaction,
        tenantId,
        actor.id,
        row.proposed_profile,
        "ACCESS_CRITICAL_CHANGE_APPROVED",
      );
  };
  if (db.transaction) await db.transaction(work);
  else await work(db);
}
