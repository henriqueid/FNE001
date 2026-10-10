import { type Permission } from "@/src/domain/access/model";
import { type DecisionEventType } from "@/src/domain/decisions/model";
import { type ServerPrincipal } from "@/src/server/access/repository";
import { sessionPrincipal } from "@/src/server/access/session";
import { type DecisionDatabase } from "./repository";

export type DecisionPrincipal = {
  user: ServerPrincipal;
  tenantId: string;
};

export class DecisionAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export async function decisionPrincipal(db: DecisionDatabase, headers: Headers): Promise<DecisionPrincipal> {
  const tenantId = headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) throw new DecisionAccessError("Empresa não informada.", 401);
  const user = await sessionPrincipal(db, headers, tenantId);
  if (!user) throw new DecisionAccessError("Sessão inválida, expirada ou sem acesso a esta empresa.", 401);
  return { user, tenantId };
}

const permissionByEvent: Partial<Record<DecisionEventType, Permission>> = {
  EXCEPTION_APPROVED: "risk:decide",
  EXCEPTION_REJECTED: "risk:decide",
  DECISION_REVIEWED: "risk:decide",
  OPERATION_SENT_TO_FORMALIZATION: "controlleria:formalize",
  PAYMENT_CONFIRMED: "finance:release",
};

export function assertDecisionPermission(user: ServerPrincipal, eventType?: DecisionEventType, authorityId?: string) {
  const permission = eventType ? permissionByEvent[eventType] : undefined;
  if (permission && !user.permissions.includes(permission))
    throw new DecisionAccessError("Usuário sem permissão para esta decisão.", 403);
  if (!permission && !user.permissions.includes("operations:view"))
    throw new DecisionAccessError("Usuário sem acesso às operações.", 403);
  if (
    (eventType === "EXCEPTION_APPROVED" || eventType === "EXCEPTION_REJECTED") &&
    (!authorityId || !user.authorityIds.includes(authorityId))
  )
    throw new DecisionAccessError("Usuário sem a alçada exigida para esta decisão.", 403);
}
