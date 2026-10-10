import { can, seedAccessState, type AccessUser, type Permission } from "@/src/domain/access/model";
import { type DecisionEventType } from "@/src/domain/decisions/model";

export type DecisionPrincipal = {
  user: AccessUser;
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

export function decisionPrincipal(headers: Headers): DecisionPrincipal {
  const userId = headers.get("x-strato-user-id")?.trim();
  const tenantId = headers.get("x-strato-tenant-id")?.trim();
  if (!userId || !tenantId) throw new DecisionAccessError("Sessão ou empresa não informada.", 401);

  const user = seedAccessState().users.find(candidate => candidate.id === userId);
  if (!user || user.status !== "active") throw new DecisionAccessError("Sessão inválida ou suspensa.", 401);
  if (!user.tenantIds.includes(tenantId)) throw new DecisionAccessError("Usuário sem acesso a esta empresa.", 403);
  return { user, tenantId };
}

const permissionByEvent: Partial<Record<DecisionEventType, Permission>> = {
  EXCEPTION_APPROVED: "risk:decide",
  EXCEPTION_REJECTED: "risk:decide",
  DECISION_REVIEWED: "risk:decide",
  OPERATION_SENT_TO_FORMALIZATION: "controlleria:formalize",
  PAYMENT_CONFIRMED: "finance:release",
};

export function assertDecisionPermission(user: AccessUser, eventType?: DecisionEventType) {
  const permission = eventType ? permissionByEvent[eventType] : undefined;
  if (permission && !can(user, permission))
    throw new DecisionAccessError("Usuário sem permissão para esta decisão.", 403);
  if (!permission && !can(user, "operations:view"))
    throw new DecisionAccessError("Usuário sem acesso às operações.", 403);
}
