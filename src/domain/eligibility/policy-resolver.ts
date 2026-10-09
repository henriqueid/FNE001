import { type InstitutionType } from "@/src/domain/core/types";
import { type EligibilityPolicy, type MasterRule, type PolicyLayer, type ResolvedRule } from "./model";

const layerPriority: Record<PolicyLayer, number> = {
  UNIVERSAL: 0,
  MODALIDADE: 1,
  INSTITUICAO: 2,
  PRODUTO: 3,
  CARTEIRA: 4,
};

function isEffective(policy: EligibilityPolicy, asOf: string) {
  return (
    policy.status === "ATIVA" && policy.effectiveFrom <= asOf && (!policy.effectiveTo || policy.effectiveTo >= asOf)
  );
}

export function resolvePolicyRules({
  catalog,
  policies,
  modality,
  product,
  company,
  asOf,
}: {
  catalog: MasterRule[];
  policies: EligibilityPolicy[];
  modality: InstitutionType;
  product?: string;
  company?: string;
  asOf: string;
}): ResolvedRule[] {
  const byId = new Map(catalog.map(rule => [rule.id, rule]));
  const resolved = new Map<string, ResolvedRule>();
  policies
    .filter(policy => isEffective(policy, asOf))
    .filter(policy => !policy.modality || policy.modality === modality)
    .filter(policy => !policy.product || policy.product === product)
    .filter(policy => !policy.company || policy.company === company)
    .sort((a, b) => layerPriority[a.layer] - layerPriority[b.layer])
    .forEach(policy => {
      policy.bindings
        .filter(binding => binding.enabled)
        .forEach(binding => {
          const rule = byId.get(binding.ruleId);
          if (!rule) return;
          if (rule.modalities[0] !== "TODAS" && !rule.modalities.includes(modality as never)) return;
          resolved.set(rule.id, { rule, binding, policy });
        });
    });
  return [...resolved.values()];
}
