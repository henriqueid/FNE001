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
    throw new OperationGovernanceError("A liberação precisa ser preparada e salva antes de ser enviada ao financeiro.");
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

/** Invariantes mínimas que não podem depender apenas da interface do navegador. */
export function assertOperationTransition(current: Operation | null, requested: Operation) {
  if (!current && requested.stage !== 1)
    throw new OperationGovernanceError("Uma operação nova deve começar na etapa Entrada.");
  if (
    !current &&
    (requested.riskReview ||
      requested.eligibilityReview ||
      requested.approvalReview ||
      requested.releaseReview ||
      requested.stageCompletions?.length)
  )
    throw new OperationGovernanceError(
      "Uma operação nova não pode trazer decisões ou conclusões de etapas posteriores.",
    );
  if (current && requested.stage < current.stage)
    throw new OperationGovernanceError("O retorno de etapa exige o fluxo explícito de devolução.");
  if (current && ["Cancelada", "Liberada ao financeiro"].includes(current.status) && !same(current, requested))
    throw new OperationGovernanceError("Uma operação encerrada é somente para consulta e não pode ser reescrita.");
  if (requested.stage > 1 && requested.titleCount <= 0)
    throw new OperationGovernanceError("A operação precisa ter ao menos um título antes de avançar da entrada.");
  if (requested.releaseReview && requested.stage !== 6)
    throw new OperationGovernanceError("A preparação financeira só pode começar na etapa de Liberação.");
  if (
    requested.status === "Liberada ao financeiro" &&
    (requested.stage !== 6 || requested.releaseReview?.status !== "Enviada ao financeiro")
  )
    throw new OperationGovernanceError("A liberação financeira exige a etapa 6 e uma autorização concluída.");
  if (current && requested.stage > current.stage + 1) {
    throw new OperationGovernanceError("O avanço precisa validar cada etapa intermediária no servidor.");
  }
  if (current?.stage !== 6 && requested.stage === 6) {
    const review = requested.approvalReview;
    const approvalsReady =
      Boolean(review?.approvals?.length) && review!.approvals!.every(item => item.status === "Aprovado");
    const documentsReady =
      Boolean(review?.documents?.length) &&
      review!.documents!.filter(item => item.required).every(item => ["Pronto", "Dispensado"].includes(item.status));
    const signaturesReady =
      Boolean(review?.signatures?.length) && review!.signatures!.every(item => item.status === "Assinado");
    if (review?.finalDecision?.outcome !== "APROVADA" || !approvalsReady || !documentsReady || !signaturesReady)
      throw new OperationGovernanceError("A etapa de Liberação exige aprovação, documentos e assinaturas concluídos.");
  }
}
