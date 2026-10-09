/**
 * Leitura de um parâmetro do motor para as telas que ainda calculam por conta própria.
 * Ordem: (1) o snapshot da execução gravado na operação, que preserva o valor usado na análise;
 * (2) a política vigente resolvida pelas camadas (as configuradas em Políticas ou, sem elas, a demo).
 * Assim a etapa antiga e o motor nunca mostram limites diferentes para a mesma regra.
 */
import { type Operation } from "@/src/domain/core/types";
import { demoPoliciesFor } from "./demo-policy";
import { masterRuleCatalog } from "./master-rule-catalog";
import { type EligibilityPolicy, type EligibilityValue } from "./model";
import { resolvePolicyRules } from "./policy-resolver";

export type PolicyParameterReading = {
  ruleId: string;
  parameter: EligibilityValue;
  policyName: string;
  policyVersion: string;
  /** "snapshot" = valor congelado na análise; "vigente" = política atual. */
  source: "snapshot" | "vigente";
};

export function policyParameterFor(
  operation: Operation,
  ruleId: string,
  policies?: EligibilityPolicy[] | null,
  asOf = new Date().toISOString().slice(0, 10),
): PolicyParameterReading | undefined {
  const frozen = operation.eligibilityReview?.run.evaluations.find(item => item.ruleId === ruleId);
  if (frozen)
    return {
      ruleId,
      parameter: frozen.parameter,
      policyName: frozen.policyName,
      policyVersion: frozen.policyVersion,
      source: "snapshot",
    };
  const resolved = resolvePolicyRules({
    catalog: masterRuleCatalog,
    policies: policies ?? demoPoliciesFor(operation),
    modality: operation.institution,
    product: operation.policy.replace(/\s+v[\d.]+$/i, ""),
    company: operation.vehicle,
    asOf,
  }).find(item => item.rule.id === ruleId);
  if (!resolved) return undefined;
  return {
    ruleId,
    parameter: resolved.binding.parameter,
    policyName: resolved.policy.name,
    policyVersion: resolved.policy.version,
    source: "vigente",
  };
}
