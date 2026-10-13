import type { Operation, ReleaseReview } from "@/src/domain/core/types";

type Actor = { id: string; name: string };

export class OperationGovernanceError extends Error {}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function releaseReviewChanged(current: Operation | null, requested: Operation) {
  return !same(current?.releaseReview, requested.releaseReview);
}

export function governReleaseTransition(
  current: Operation | null,
  requested: Operation,
  actor: Actor,
  now = new Date().toISOString(),
): Operation {
  const next = requested.releaseReview;
  if (!next) return requested;
  const previous = current?.releaseReview;

  if (previous?.status === "Enviada ao financeiro") {
    if (!same(previous, next))
      throw new OperationGovernanceError("Uma liberação aprovada não pode ser reescrita; use estorno ou cancelamento.");
    return requested;
  }

  if (next.status === "Em preparação") {
    const preparedById = previous?.preparedById ?? actor.id;
    const preparedBy = previous?.preparedBy ?? actor.name;
    const preparedAt = previous?.preparedAt ?? now;
    return {
      ...requested,
      releaseReview: {
        ...next,
        preparedById,
        preparedBy,
        preparedAt,
        approvedById: undefined,
        approvedBy: undefined,
        approvedAt: undefined,
      },
    };
  }

  if (!previous?.preparedById)
    throw new OperationGovernanceError(
      "A liberação precisa ser preparada e salva antes de ser aprovada por uma segunda pessoa.",
    );
  if (previous.preparedById === actor.id)
    throw new OperationGovernanceError("Quem preparou a liberação não pode aprovar o próprio pagamento.");

  const governed: ReleaseReview = {
    ...next,
    preparedById: previous.preparedById,
    preparedBy: previous.preparedBy,
    preparedAt: previous.preparedAt,
    approvedById: actor.id,
    approvedBy: actor.name,
    approvedAt: now,
    releasedBy: actor.name,
  };
  return { ...requested, releaseReview: governed };
}

