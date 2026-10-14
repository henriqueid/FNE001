import type { EligibilityPolicy } from "./model";
import type { EligibilityPolicyState } from "./policy-library";

const unique = (values: string[]) => new Set(values).size === values.length;
const validDate = (value: string | undefined) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
const validInstant = (value: string | undefined) => !!value && Number.isFinite(new Date(value).getTime());
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const withoutPublicationRequest = (policy: EligibilityPolicy) => {
  const { publicationRequest: _publicationRequest, ...editable } = policy;
  return editable;
};
const withoutPublicationDecision = (policy: EligibilityPolicy) => {
  const { publicationRequest: _publicationRequest, publicationRejection: _publicationRejection, ...editable } = policy;
  return editable;
};
const withoutPersistence = (state: EligibilityPolicyState) => {
  const { persistenceVersion: _persistenceVersion, ...snapshot } = state;
  return snapshot;
};

function validPolicy(policy: EligibilityPolicy) {
  if (!policy.id.trim() || !policy.name.trim() || !policy.version.trim() || !validDate(policy.effectiveFrom))
    return false;
  if (policy.effectiveTo && (!validDate(policy.effectiveTo) || policy.effectiveTo < policy.effectiveFrom)) return false;
  if (!unique(policy.bindings.map(binding => binding.ruleId))) return false;
  if (
    policy.bindings.some(
      binding =>
        !binding.ruleId.trim() ||
        !["ALERTA", "EXCECAO", "REPROVADO"].includes(binding.failureOutcome) ||
        !["CONTINUAR", "SINALIZAR", "SOLICITAR_DECISAO", "BLOQUEAR"].includes(binding.action),
    )
  )
    return false;
  if (
    policy.publicationRequest &&
    (!policy.publicationRequest.requestedById.trim() ||
      !policy.publicationRequest.requestedBy.trim() ||
      !validInstant(policy.publicationRequest.requestedAt) ||
      policy.publicationRequest.justification.trim().length < 10)
  )
    return false;
  if (
    policy.publicationRejection &&
    (!policy.publicationRejection.rejectedById.trim() ||
      !policy.publicationRejection.rejectedBy.trim() ||
      !validInstant(policy.publicationRejection.rejectedAt) ||
      policy.publicationRejection.justification.trim().length < 10)
  )
    return false;
  if (policy.status === "RASCUNHO") return !policy.approval && !policy.effectiveTo;
  return (
    !!policy.approval?.approvedById.trim() &&
    !!policy.approval.approvedBy.trim() &&
    validInstant(policy.approval.approvedAt) &&
    policy.approval.justification.trim().length >= 10 &&
    policy.bindings.some(binding => binding.enabled && binding.parameter !== null)
  );
}

/** Aplica identidades e horários confiáveis antes de validar e persistir o comando. */
export function governEligibilityPolicyTransition(
  previous: EligibilityPolicyState | null,
  next: EligibilityPolicyState,
  actor: { id: string; name: string },
  now = new Date().toISOString(),
): EligibilityPolicyState {
  if (!previous) return next;
  const priorById = new Map(previous.policies.map(policy => [policy.id, policy]));
  return {
    ...next,
    policies: next.policies.map(candidate => {
      const prior = priorById.get(candidate.id);
      if (!prior || prior.status !== "RASCUNHO") return candidate;
      if (!prior.publicationRequest && candidate.status === "RASCUNHO" && candidate.publicationRequest)
        return {
          ...candidate,
          publicationRequest: {
            ...candidate.publicationRequest,
            requestedById: actor.id,
            requestedBy: actor.name,
            requestedAt: now,
          },
        };
      if (prior.publicationRequest && candidate.status === "ATIVA" && candidate.approval)
        return {
          ...candidate,
          publicationRequest: prior.publicationRequest,
          approval: {
            ...candidate.approval,
            approvedById: actor.id,
            approvedBy: actor.name,
            approvedAt: now,
          },
        };
      if (
        prior.publicationRequest &&
        candidate.status === "RASCUNHO" &&
        !candidate.publicationRequest &&
        candidate.publicationRejection
      )
        return {
          ...candidate,
          publicationRejection: {
            ...candidate.publicationRejection,
            rejectedById: actor.id,
            rejectedBy: actor.name,
            rejectedAt: now,
          },
        };
      return candidate;
    }),
  };
}

const scope = (policy: EligibilityPolicy) =>
  [policy.layer, policy.modality ?? "", policy.company ?? "", policy.product ?? ""].join("|");

export function validateEligibilityPolicyState(state: EligibilityPolicyState): string | null {
  if (state.version !== 2 || !Array.isArray(state.policies)) return "Versão do estado de políticas não suportada.";
  if (!unique(state.policies.map(policy => policy.id))) return "Há identificadores de política duplicados.";
  if (!state.policies.every(validPolicy)) return "Há política, vigência, regra ou aprovação inválida.";
  const activeScopes = state.policies.filter(policy => policy.status === "ATIVA").map(scope);
  if (!unique(activeScopes)) return "Só pode existir uma política ativa por escopo.";
  return null;
}

/** Impede exclusão ou reescrita de versões publicadas e autentica a aprovação material. */
export function validateEligibilityPolicyTransition(
  previous: EligibilityPolicyState | null,
  next: EligibilityPolicyState,
  actor: { id: string; name: string },
): string | null {
  if (!previous) {
    if (next.policies.some(policy => policy.status !== "RASCUNHO"))
      return "O estado inicial só pode conter políticas em rascunho.";
    if (next.policies.some(policy => policy.publicationRequest))
      return "Salve o rascunho antes de enviá-lo para aprovação.";
    return null;
  }
  const nextById = new Map(next.policies.map(policy => [policy.id, policy]));
  for (const prior of previous.policies) {
    const candidate = nextById.get(prior.id);
    if (!candidate) return `A política ${prior.name} ${prior.version} não pode ser removida.`;
    if (prior.status === "ENCERRADA" && !same(prior, candidate))
      return `A política encerrada ${prior.name} ${prior.version} é imutável.`;
    if (prior.status === "ATIVA") {
      if (same(prior, candidate)) continue;
      const closed = { ...prior, status: "ENCERRADA", effectiveTo: candidate.effectiveTo };
      if (candidate.status !== "ENCERRADA" || !candidate.effectiveTo || !same(closed, candidate))
        return `A política ativa ${prior.name} ${prior.version} só pode ser encerrada por uma nova vigência.`;
    }
    if (prior.status === "RASCUNHO" && candidate.status === "ENCERRADA")
      return `A política ${prior.name} ${prior.version} precisa ser aprovada antes de ser encerrada.`;
    if (prior.status === "RASCUNHO" && prior.publicationRequest) {
      if (candidate.status === "RASCUNHO" && !same(prior, candidate)) {
        const validRejection =
          !candidate.publicationRequest &&
          !!candidate.publicationRejection &&
          !same(prior.publicationRejection, candidate.publicationRejection) &&
          same(withoutPublicationDecision(prior), withoutPublicationDecision(candidate));
        if (!validRejection)
          return `A política ${prior.name} ${prior.version} está aguardando aprovação e não pode ser alterada.`;
        if (prior.publicationRequest.requestedById === actor.id)
          return "Quem solicitou a publicação não pode rejeitar a própria política.";
        if (
          candidate.publicationRejection?.rejectedById !== actor.id ||
          candidate.publicationRejection.rejectedBy !== actor.name ||
          !validInstant(candidate.publicationRejection.rejectedAt)
        )
          return "A rejeição da política não corresponde à sessão autenticada.";
      }
      if (candidate.status === "ATIVA") {
        if (!same(prior.publicationRequest, candidate.publicationRequest))
          return "A solicitação de publicação não pode ser alterada durante a aprovação.";
        const { approval: _approval, ...activated } = candidate;
        if (!same(prior, { ...activated, status: "RASCUNHO" }))
          return "O conteúdo da política não pode ser alterado durante a aprovação.";
        if (prior.publicationRequest.requestedById === actor.id)
          return "Quem solicitou a publicação não pode aprovar a própria política.";
        if (
          candidate.approval?.approvedById !== actor.id ||
          candidate.approval.approvedBy !== actor.name ||
          !validInstant(candidate.approval.approvedAt)
        )
          return "A aprovação da política não corresponde à sessão autenticada.";
      }
    }
    if (
      prior.status === "RASCUNHO" &&
      !prior.publicationRequest &&
      candidate.publicationRequest &&
      (candidate.status !== "RASCUNHO" || !same(withoutPublicationRequest(prior), withoutPublicationRequest(candidate)))
    )
      return "Salve todas as alterações antes de enviar a política para aprovação.";
  }
  for (const candidate of next.policies) {
    const prior = previous.policies.find(policy => policy.id === candidate.id);
    if (!prior && candidate.status !== "RASCUNHO") return "Uma política nova deve começar como rascunho.";
    if (!prior && candidate.publicationRequest) return "Salve o rascunho antes de enviá-lo para aprovação.";
    if (prior?.status === "RASCUNHO" && candidate.status === "ATIVA") {
      if (!prior.publicationRequest) return "Envie a política para aprovação antes de ativá-la.";
      if (
        candidate.approval?.approvedById !== actor.id ||
        candidate.approval.approvedBy !== actor.name ||
        !validInstant(candidate.approval.approvedAt)
      )
        return "A aprovação da política não corresponde à sessão autenticada.";
    }
  }
  return same(withoutPersistence(previous), withoutPersistence(next))
    ? "Nenhuma alteração de política foi informada."
    : null;
}
