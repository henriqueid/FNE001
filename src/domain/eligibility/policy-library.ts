import { destinations } from "@/src/domain/core/demo/companies";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type EligibilityPolicy, type PolicyRuleBinding } from "./model";
import { demoPoliciesFor } from "./demo-policy";

export type EligibilityPolicyState = {
  version: 2;
  policies: EligibilityPolicy[];
};

export function seedEligibilityPolicies(): EligibilityPolicyState {
  const names: Record<string, string> = {
    "Lastro Prime FIDC · Classe Sênior": "Política Lastro Prime FIDC",
    "Aurora Recebíveis FIDC · Classe Única": "Política Aurora Recebíveis",
    "Órbita Securitizadora S.A.": "Política Órbita Securitizadora",
    "Lastro Fomento Mercantil": "Política Lastro Fomento",
  };
  const policies = destinations.map(destination => {
    const operations = initialOperations.filter(operation => operation.vehicle === destination.name);
    const sources = operations.flatMap(demoPoliciesFor);
    const bindings = new Map(sources.flatMap(policy => policy.bindings).map(binding => [binding.ruleId, binding]));
    return {
      id: `POL-${slug(destination.name)}:v1.0`,
      name: names[destination.name] ?? `Política ${destination.name}`,
      version: "v1.0",
      layer: "INSTITUICAO" as const,
      modality: destination.institution,
      company: destination.name,
      effectiveFrom: "2026-01-01",
      status: "ATIVA" as const,
      bindings: [...bindings.values()].map(binding => ({ ...binding })),
    };
  });
  return { version: 2, policies };
}

export function migrateEligibilityPolicyState(value: unknown): EligibilityPolicyState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<EligibilityPolicyState>;
  if (candidate.version !== 2 || !Array.isArray(candidate.policies)) return undefined;
  return { version: 2, policies: candidate.policies };
}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

export function createBlankPolicy(input: {
  name: string;
  version: string;
  modality: EligibilityPolicy["modality"];
  company: string;
  product?: string;
  effectiveFrom: string;
}): EligibilityPolicy {
  return {
    id: `POL-${slug(input.company)}-${slug(input.name)}:${slug(input.version)}-${Date.now()}`,
    name: input.name.trim(),
    version: input.version.trim(),
    layer: "INSTITUICAO",
    modality: input.modality,
    company: input.company,
    product: input.product?.trim() || undefined,
    effectiveFrom: input.effectiveFrom,
    status: "RASCUNHO",
    bindings: [],
  };
}

export function addPolicyRule(policy: EligibilityPolicy, ruleId: string): EligibilityPolicy {
  if (policy.status !== "RASCUNHO" || policy.bindings.some(binding => binding.ruleId === ruleId)) return policy;
  return {
    ...policy,
    bindings: [
      ...policy.bindings,
      {
        ruleId,
        enabled: false,
        parameter: null,
        failureOutcome: "EXCECAO",
        action: "SOLICITAR_DECISAO",
        overrideAllowed: false,
      },
    ],
  };
}

function nextVersion(version: string) {
  const match = version.match(/^(.*?)(\d+)$/);
  if (!match) return `${version}.1`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

export function createPolicyVersion(policy: EligibilityPolicy, effectiveFrom: string): EligibilityPolicy {
  const version = nextVersion(policy.version);
  return {
    ...policy,
    id: `${policy.id.replace(/:v[^:]+$/i, "")}:v${version.replace(/^v/i, "")}`,
    version,
    effectiveFrom,
    effectiveTo: undefined,
    status: "RASCUNHO",
    bindings: policy.bindings.map(binding => ({ ...binding })),
  };
}

export function updatePolicyBinding(
  policy: EligibilityPolicy,
  ruleId: string,
  patch: Partial<PolicyRuleBinding>,
): EligibilityPolicy {
  if (policy.status !== "RASCUNHO") return policy;
  return {
    ...policy,
    bindings: policy.bindings.map(binding => (binding.ruleId === ruleId ? { ...binding, ...patch } : binding)),
  };
}

function sameScope(a: EligibilityPolicy, b: EligibilityPolicy) {
  return a.layer === b.layer && a.modality === b.modality && a.company === b.company && a.product === b.product;
}

export function activatePolicyVersion(
  policies: EligibilityPolicy[],
  policyId: string,
  effectiveFrom: string,
): EligibilityPolicy[] {
  const target = policies.find(policy => policy.id === policyId);
  if (!target || target.status !== "RASCUNHO" || !target.bindings.some(binding => binding.enabled)) return policies;
  return policies.map(policy => {
    if (policy.id === policyId) return { ...policy, status: "ATIVA", effectiveFrom };
    if (policy.status !== "ATIVA" || !sameScope(policy, target)) return policy;
    const priorDay = new Date(`${effectiveFrom}T12:00:00`);
    priorDay.setDate(priorDay.getDate() - 1);
    return { ...policy, status: "ENCERRADA", effectiveTo: priorDay.toISOString().slice(0, 10) };
  });
}
