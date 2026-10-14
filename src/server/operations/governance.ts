import type { Operation, ReleaseReview } from "@/src/domain/core/types";
import {
  approvalChangedPreparedRelease,
  approvedPayables,
  preparedReleaseError,
} from "@/src/server/operations/release-approval";

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
    if (!previous?.preparedById && !next.preparedById) {
      return {
        ...requested,
        releaseReview: {
          ...next,
          preparedById: undefined,
          preparedBy: undefined,
          preparedAt: undefined,
          approvedById: undefined,
          approvedBy: undefined,
          approvedAt: undefined,
        },
      };
    }
    if (previous?.preparedById && previous.preparedById !== actor.id && approvalChangedPreparedRelease(previous, next))
      throw new OperationGovernanceError(
        "Somente quem preparou pode alterar o pacote; o conferente deve aprovar ou devolver para nova preparação.",
      );
    const preparationError = preparedReleaseError(requested, next);
    if (preparationError) throw new OperationGovernanceError(preparationError);
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
  if (approvalChangedPreparedRelease(previous, next))
    throw new OperationGovernanceError(
      "Favorecidos, contas, valores e data não podem mudar durante a aprovação; devolva para nova preparação.",
    );

  const payables = approvedPayables(requested, previous, now);

  const governed: ReleaseReview = {
    ...previous,
    status: "Enviada ao financeiro",
    preparedById: previous.preparedById,
    preparedBy: previous.preparedBy,
    preparedAt: previous.preparedAt,
    approvedById: actor.id,
    approvedBy: actor.name,
    approvedAt: now,
    payables,
    releasedAt: now,
    releasedBy: actor.name,
    audit: [
      ...(previous.audit ?? []),
      {
        at: now,
        by: actor.name,
        action: "Liberada ao financeiro",
        detail: `${payables.length} lançamento(s) criado(s) a partir do pacote preparado.`,
      },
    ],
  };
  return {
    ...requested,
    status: "Liberada ao financeiro",
    nextAction: "Aguardando pagamento no financeiro",
    releaseReview: governed,
  };
}

