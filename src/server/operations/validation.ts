/** Revalida operações com política, cadastro e carteira lidos pelo servidor no mesmo tenant. */
import type { Operation } from "@/src/domain/core/types";
import type { EligibilityPolicy } from "@/src/domain/eligibility/model";
import { evaluateOperationEligibility } from "@/src/domain/eligibility/operation-adapter";
import { effectiveRunSummary } from "@/src/domain/eligibility/decision";
import {
  loadEligibilityExceptionGrants,
  verifiedEligibilityOverrides,
  type EligibilityExceptionGrant,
} from "./exception-evidence";
import { pricingCalculation, roundPricing } from "@/src/domain/operations/pricing";
import { portfolioBalance, type PortfolioState } from "@/src/domain/portfolio/model";
import { partyToCedent, partyToDebtor, type Party } from "@/src/domain/registry/parties";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadEligibilityPolicyState } from "@/src/server/eligibility/policy-repository";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { loadRegistryParties } from "@/src/server/registry/repository";
import { OperationGovernanceError } from "./governance";
import {
  approvalHash,
  approvalEvidenceComplete,
  loadApprovalAuthorityPolicy,
  loadOperationApprovalGrants,
  type ApprovalAuthorityPolicy,
  type OperationApprovalGrant,
} from "./approval-evidence";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const digits = (value: string) => value.replace(/\D/g, "");

/** Distingue ausência do comando de aprovação auditável de uma reprovação do motor. */
export class OperationApprovalAuthorityUnavailableError extends OperationGovernanceError {}

export type OperationAuthorityContext = {
  policies: EligibilityPolicy[];
  parties: Party[];
  portfolio: PortfolioState;
  asOf: string;
  approvalPolicy?: ApprovalAuthorityPolicy;
  approvalGrants?: OperationApprovalGrant[];
  exceptionGrants?: EligibilityExceptionGrant[];
};

export async function loadOperationAuthorityContext(
  db: DecisionDatabase,
  tenantId: string,
  operation?: Operation,
): Promise<OperationAuthorityContext> {
  // Os comandos chamadores mantêm a transação e a trava financeira do tenant até a gravação.
  await db.prepare("select tenant_id from private.policy_states where tenant_id = ? for share").bind(tenantId).all();
  await db.prepare("select party_id from private.registry_parties where tenant_id = ? for share").bind(tenantId).all();
  const [policyState, parties, portfolio] = await Promise.all([
    loadEligibilityPolicyState(db, tenantId),
    loadRegistryParties(db, tenantId),
    loadCurrentPortfolio(db, tenantId),
  ]);
  const approvalPolicy = operation ? await loadApprovalAuthorityPolicy(db, tenantId, operation.vehicle) : undefined;
  const approvalGrants = operation ? await loadOperationApprovalGrants(db, tenantId, operation.id) : [];
  const exceptionGrants = operation ? await loadEligibilityExceptionGrants(db, tenantId, operation.id) : [];
  return {
    policies: policyState?.policies ?? [],
    parties,
    portfolio,
    asOf: new Date().toISOString().slice(0, 10),
    approvalPolicy,
    approvalGrants,
    exceptionGrants,
  };
}

export function assertOperationTitleTotals(operation: Operation) {
  const entries = operation.manualEntry?.entries ?? [];
  if (!entries.every(title => Number.isFinite(title.amount) && title.amount > 0))
    throw new OperationGovernanceError("Os títulos precisam ter valores positivos e finitos.");
  if (new Set(entries.map(title => title.id)).size !== entries.length)
    throw new OperationGovernanceError("A entrada contém identificadores de títulos repetidos.");
  const amount = roundPricing(entries.reduce((sum, title) => sum + title.amount, 0));
  if (
    operation.titleCount !== entries.length ||
    !Number.isFinite(operation.amount) ||
    roundPricing(operation.amount) !== amount
  )
    throw new OperationGovernanceError(
      "Soma e quantidade da operação devem corresponder aos títulos persistidos na entrada.",
    );
}

export function operationRequiresAuthority(current: Operation | null, requested: Operation) {
  return Boolean(
    current &&
    (requested.stage > current.stage ||
      requested.stage >= 5 ||
      !same(current.approvalReview, requested.approvalReview) ||
      !same(current.releaseReview, requested.releaseReview)),
  );
}

export function authoritativeEligibilityRun(current: Operation, context: OperationAuthorityContext) {
  const cedentParty = context.parties.find(
    party =>
      digits(party.document) === digits(current.document) &&
      party.roles.includes("cedente") &&
      party.status === "Ativo",
  );
  if (!cedentParty) throw new OperationGovernanceError("Cedente ativo não localizado no cadastro persistido.");
  const portfolio = context.portfolio.titles.filter(
    title => title.company === current.vehicle && title.operationId !== current.id,
  );
  const exposure = (document: string, owner: boolean, overdue = false) =>
    portfolio
      .filter(
        title =>
          digits(owner ? title.ownerDocument : title.debtorDocument) === digits(document) &&
          (!overdue || title.dueDate < context.asOf),
      )
      .reduce((sum, title) => sum + portfolioBalance(title), 0);
  const cedent = {
    ...partyToCedent(cedentParty),
    usedLimit: exposure(current.document, true),
    portfolioReceivable: exposure(current.document, true),
    portfolioOverdue: exposure(current.document, true, true),
  };
  const debtors = context.parties
    .filter(party => party.roles.includes("sacado") && party.status === "Ativo")
    .map(party => ({
      ...partyToDebtor(party),
      portfolioReceivable: exposure(party.document, false),
      portfolioOverdue: exposure(party.document, false, true),
    }));
  const rawRun = evaluateOperationEligibility({
    operation: current,
    cedent,
    debtors,
    policies: context.policies,
    asOf: context.asOf,
  });

  const unavailable = new Set([
    "externalScore",
    "internalScore",
    "averageDelayDays",
    "repurchasePercent",
    "restrictionCount",
    "groupConcentrationPercent",
    "confirmationStatus",
  ]);
  const evaluations = rawRun.evaluations.map(evaluation =>
    unavailable.has(evaluation.variable)
      ? {
          ...evaluation,
          outcome: "NAO_AVALIADO" as const,
          observed: null,
          explanation:
            "Fonte autoritativa indisponível; eventual aceitação exige exceção explícita da alçada configurada.",
          evidence:
            "Dado ausente no contrato persistido do servidor. Nenhum valor de demonstração ou zero foi presumido.",
        }
      : evaluation,
  );
  const normalized = { ...rawRun, evaluations };
  const summary = effectiveRunSummary(normalized, []);
  const inputFingerprint = approvalHash({ input: rawRun.inputFingerprint, evaluations });
  return {
    ...normalized,
    id: `eligibility:${current.id}:${context.asOf}:${inputFingerprint}`,
    inputFingerprint,
    ...summary,
  };
}

/** Ausência de dados e de vínculo auditável não pode ser suprida por um resultado enviado pelo navegador. */
export function assertAuthoritativeOperation(
  current: Operation,
  requested: Operation,
  context: OperationAuthorityContext,
) {
  assertOperationTitleTotals(requested);
  const advancing = requested.stage > current.stage;
  if (
    advancing &&
    [
      "manualEntry",
      "pricingReview",
      "riskReview",
      "document",
      "vehicle",
      "institution",
      "policy",
      "clientOperationalParameters",
    ].some(field => !same(current[field as keyof Operation], requested[field as keyof Operation]))
  )
    throw new OperationGovernanceError("Salve os dados e decisões antes de solicitar o avanço de etapa.");
  if (requested.stage <= 2 && !requested.approvalReview && !requested.releaseReview) return;
  const run = authoritativeEligibilityRun(current, context);
  if (!run.evaluations.length)
    throw new OperationGovernanceError("Não há política ativa aplicável persistida para validar o avanço.");
  const overrides = verifiedEligibilityOverrides(current, run, context.exceptionGrants ?? []);
  const effective = effectiveRunSummary(run, overrides);
  if (effective.counts.REPROVADO || effective.counts.EXCECAO || effective.counts.NAO_AVALIADO)
    throw new OperationGovernanceError(
      "Elegibilidade reexecutada no servidor impede o avanço; exceções exigem decisão auditável vinculada à avaliação.",
    );
  if (requested.stage >= 5 || requested.releaseReview) {
    const pricing = current.pricingReview;
    if (!pricing || pricing.status !== "Condição salva")
      throw new OperationGovernanceError("Salve a condição comercial antes de aprovar ou liberar.");
    const numericTerms = [
      pricing.monthlyRate,
      pricing.fundingCostMonthly,
      pricing.floatDays,
      pricing.minimumTermDays,
      pricing.operationFee,
      pricing.feePerTitle,
      pricing.adValoremPercent,
      pricing.guaranteePercent,
      pricing.manualRetention,
      ...(pricing.manualFees ?? []).map(fee => fee.amount),
    ];
    if (
      numericTerms.some(value => !Number.isFinite(value) || value < 0) ||
      pricing.monthlyRate >= 100 ||
      pricing.guaranteePercent > 100
    )
      throw new OperationGovernanceError("A condição comercial contém parâmetros numéricos inválidos.");
    if (pricing.repurchaseTitleIds?.length || pricing.settlementAdjustmentIds?.length)
      throw new OperationGovernanceError(
        "Recompras e compensações exigem vínculo autoritativo aos títulos da carteira.",
      );
    const calculated = pricingCalculation(current, pricing);
    if (!Number.isFinite(calculated.net) || roundPricing(requested.netAmount) !== roundPricing(calculated.net))
      throw new OperationGovernanceError("O valor líquido diverge do preço recalculado no servidor.");
  }
  if (
    (requested.stage >= 6 || requested.approvalReview?.finalDecision?.outcome === "APROVADA") &&
    !approvalEvidenceComplete(requested, context.policies, context.approvalPolicy, context.approvalGrants ?? [])
  )
    throw new OperationApprovalAuthorityUnavailableError(
      "A aprovação formal exige trilha e atribuições verificáveis vinculadas à operação; o snapshot do navegador não autoriza liberação.",
    );
}
