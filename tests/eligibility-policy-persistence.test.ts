import {
  activatePolicyVersion,
  createPolicyVersion,
  seedEligibilityPolicies,
  updatePolicyBinding,
} from "@/src/domain/eligibility/policy-library";
import {
  governEligibilityPolicyTransition,
  validateEligibilityPolicyState,
  validateEligibilityPolicyTransition,
} from "@/src/domain/eligibility/policy-persistence";
import { policyRequestHash } from "@/src/server/eligibility/policy-repository";
import { describe, expect, it } from "vitest";

const actor = { id: "user-henrique-admin", name: "Henrique" };
const approver = { id: "user-cristiane-admin", name: "Cristiane" };

function versionedState() {
  const previous = seedEligibilityPolicies();
  const active = previous.policies[0];
  const draft = updatePolicyBinding(createPolicyVersion(active, "2026-11-01"), active.bindings[0].ruleId, {
    enabled: true,
    parameter: 25,
  });
  return { previous, draft };
}

describe("governança persistente de políticas", () => {
  it("separa solicitação e aprovação, encerra a vigência anterior e mantém o agregado válido", () => {
    const { previous, draft } = versionedState();
    const withDraft = { ...previous, policies: [...previous.policies, draft] };
    const requestedCandidate = {
      ...withDraft,
      policies: withDraft.policies.map(policy =>
        policy.id === draft.id
          ? {
              ...policy,
              publicationRequest: {
                requestedById: "identidade-forjada",
                requestedBy: "Pessoa forjada",
                requestedAt: "2020-01-01T00:00:00.000Z",
                justification: "Limites revisados para publicação pela Diretoria.",
              },
            }
          : policy,
      ),
    };
    const requested = governEligibilityPolicyTransition(
      withDraft,
      requestedCandidate,
      actor,
      "2026-10-13T11:00:00.000Z",
    );
    expect(validateEligibilityPolicyTransition(withDraft, requested, actor)).toBeNull();
    expect(requested.policies.find(policy => policy.id === draft.id)?.publicationRequest?.requestedById).toBe(actor.id);

    const policies = activatePolicyVersion(requested.policies, draft.id, draft.effectiveFrom, {
      approvedById: "identidade-forjada",
      approvedBy: "Pessoa forjada",
      approvedAt: "2026-10-13T12:00:00.000Z",
      justification: "Limites revisados e aprovados pela Diretoria.",
    });
    const next = governEligibilityPolicyTransition(
      requested,
      { version: 2 as const, policies },
      approver,
      "2026-10-13T12:00:00.000Z",
    );

    expect(validateEligibilityPolicyState(next)).toBeNull();
    expect(validateEligibilityPolicyTransition(requested, next, approver)).toBeNull();
    expect(next.policies.find(policy => policy.id === draft.id)?.status).toBe("ATIVA");
    expect(next.policies.find(policy => policy.id === draft.id)?.approval?.approvedById).toBe(approver.id);
    expect(next.policies.find(policy => policy.id === previous.policies[0].id)?.effectiveTo).toBe("2026-10-31");
  });

  it("recusa publicação direta, autoaprovação, alteração pendente, exclusão e reescrita", () => {
    const previous = seedEligibilityPolicies();
    const active = previous.policies[0];
    const rewritten = {
      ...previous,
      policies: previous.policies.map(policy =>
        policy.id === active.id ? { ...policy, name: "Nome adulterado" } : policy,
      ),
    };
    const removed = { ...previous, policies: previous.policies.slice(1) };
    const draft = createPolicyVersion(active, "2026-11-01");
    const withDraft = { ...previous, policies: [...previous.policies, draft] };
    const direct = {
      ...withDraft,
      policies: activatePolicyVersion(withDraft.policies, draft.id, draft.effectiveFrom, {
        approvedById: actor.id,
        approvedBy: actor.name,
        approvedAt: "2026-10-13T12:00:00.000Z",
        justification: "Tentativa de aprovação sem solicitação prévia.",
      }),
    };
    const requested = governEligibilityPolicyTransition(
      withDraft,
      {
        ...withDraft,
        policies: withDraft.policies.map(policy =>
          policy.id === draft.id
            ? {
                ...policy,
                publicationRequest: {
                  requestedById: actor.id,
                  requestedBy: actor.name,
                  requestedAt: "2026-10-13T11:00:00.000Z",
                  justification: "Solicitação formal de publicação da política.",
                },
              }
            : policy,
        ),
      },
      actor,
      "2026-10-13T11:00:00.000Z",
    );
    const selfApproved = {
      ...requested,
      policies: activatePolicyVersion(requested.policies, draft.id, draft.effectiveFrom, {
        approvedById: actor.id,
        approvedBy: actor.name,
        approvedAt: "2026-10-13T12:00:00.000Z",
        justification: "Tentativa de aprovar a própria solicitação.",
      }),
    };
    const changedWhilePending = {
      ...requested,
      policies: requested.policies.map(policy =>
        policy.id === draft.id ? { ...policy, name: "Conteúdo alterado" } : policy,
      ),
    };
    const rejected = governEligibilityPolicyTransition(
      requested,
      {
        ...requested,
        policies: requested.policies.map(policy => {
          if (policy.id !== draft.id) return policy;
          const { publicationRequest: _publicationRequest, ...editable } = policy;
          return {
            ...editable,
            publicationRejection: {
              rejectedById: "identidade-forjada",
              rejectedBy: "Pessoa forjada",
              rejectedAt: "2020-01-01T00:00:00.000Z",
              justification: "Parâmetro sem evidência suficiente para publicação.",
            },
          };
        }),
      },
      approver,
      "2026-10-13T12:30:00.000Z",
    );

    expect(validateEligibilityPolicyTransition(previous, rewritten, actor)).toContain("só pode ser encerrada");
    expect(validateEligibilityPolicyTransition(previous, removed, actor)).toContain("não pode ser removida");
    expect(validateEligibilityPolicyTransition(withDraft, direct, actor)).toContain("Envie a política");
    expect(validateEligibilityPolicyTransition(requested, selfApproved, actor)).toContain("não pode aprovar");
    expect(validateEligibilityPolicyTransition(requested, changedWhilePending, actor)).toContain(
      "não pode ser alterada",
    );
    expect(validateEligibilityPolicyTransition(requested, rejected, approver)).toBeNull();
    expect(rejected.policies.find(policy => policy.id === draft.id)?.publicationRejection?.rejectedById).toBe(
      approver.id,
    );
  });

  it("produz hash estável ignorando apenas a versão de persistência", async () => {
    const state = seedEligibilityPolicies();
    const left = await policyRequestHash({ tenantId: "tenant", actorId: actor.id, expectedVersion: 1, state });
    const right = await policyRequestHash({
      state: { ...state, persistenceVersion: 99 },
      expectedVersion: 1,
      actorId: actor.id,
      tenantId: "tenant",
    });
    const changed = await policyRequestHash({ tenantId: "tenant", actorId: actor.id, expectedVersion: 2, state });

    expect(left).toBe(right);
    expect(left).not.toBe(changed);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });
});
