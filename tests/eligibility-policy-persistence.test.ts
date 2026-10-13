import {
  activatePolicyVersion,
  createPolicyVersion,
  seedEligibilityPolicies,
  updatePolicyBinding,
} from "@/src/domain/eligibility/policy-library";
import {
  validateEligibilityPolicyState,
  validateEligibilityPolicyTransition,
} from "@/src/domain/eligibility/policy-persistence";
import { policyRequestHash } from "@/src/server/eligibility/policy-repository";
import { describe, expect, it } from "vitest";

const actor = { id: "user-henrique-admin", name: "Henrique" };

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
  it("aprova uma versão, encerra a vigência anterior e mantém o agregado válido", () => {
    const { previous, draft } = versionedState();
    const withDraft = { ...previous, policies: [...previous.policies, draft] };
    const policies = activatePolicyVersion(withDraft.policies, draft.id, draft.effectiveFrom, {
      approvedById: actor.id,
      approvedBy: actor.name,
      approvedAt: "2026-10-13T12:00:00.000Z",
      justification: "Limites revisados e aprovados pela Diretoria.",
    });
    const next = { version: 2 as const, policies };

    expect(validateEligibilityPolicyState(next)).toBeNull();
    expect(validateEligibilityPolicyTransition(withDraft, next, actor)).toBeNull();
    expect(policies.find(policy => policy.id === draft.id)?.status).toBe("ATIVA");
    expect(policies.find(policy => policy.id === previous.policies[0].id)?.effectiveTo).toBe("2026-10-31");
  });

  it("recusa autoria falsa, exclusão e reescrita de versão ativa", () => {
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
    const forged = {
      ...withDraft,
      policies: activatePolicyVersion(withDraft.policies, draft.id, draft.effectiveFrom, {
        approvedById: "outro-usuario",
        approvedBy: "Outra pessoa",
        approvedAt: "2026-10-13T12:00:00.000Z",
        justification: "Tentativa de aprovação com outra identidade.",
      }),
    };

    expect(validateEligibilityPolicyTransition(previous, rewritten, actor)).toContain("só pode ser encerrada");
    expect(validateEligibilityPolicyTransition(previous, removed, actor)).toContain("não pode ser removida");
    expect(validateEligibilityPolicyTransition(withDraft, forged, actor)).toContain("não corresponde à sessão");
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
