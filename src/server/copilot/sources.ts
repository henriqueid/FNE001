/** Fontes completas autorizadas do cliente; não há fallback demonstrativo nem busca externa. */
import { portfolioHomeTitles, type PortfolioState } from "@/src/domain/portfolio/model";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { partyToCedent } from "@/src/domain/registry/parties";
import type { SystemKnowledge } from "@/src/domain/copilot/system-query";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { filterCompanyScope } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadOperations } from "@/src/server/operations/repository";
import { loadCurrentPortfolio } from "@/src/server/portfolio/repository";
import { filterPortfolioScope } from "@/src/server/portfolio/access";
import { loadRegistryParties } from "@/src/server/registry/repository";
import { loadEligibilityPolicyState } from "@/src/server/eligibility/policy-repository";
import { loadOperationalSources } from "./operational-sources";
import type { OperationalData } from "@/src/domain/copilot/operational-data";
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";

export const copilotDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export type CopilotSources = OperationalData & {
  knowledge: SystemKnowledge;
  portfolio: PortfolioState;
  entityCompanies: Map<string, string>;
  additionalLabels?: Map<string, string>;
  additionalBehavior?: BehaviorEvent[];
};

export async function loadCopilotSources(db: DecisionDatabase, principal: ServerPrincipal): Promise<CopilotSources> {
  const has = (permission: ServerPrincipal["permissions"][number]) => principal.permissions.includes(permission);
  const [allOperations, fullPortfolio, parties, policyState] = await Promise.all([
    has("operations:view") ? loadOperations(db, principal.tenantId) : [],
    has("portfolio:manage") ? loadCurrentPortfolio(db, principal.tenantId) : { version: 3 as const, titles: [] },
    has("registry:view") ? loadRegistryParties(db, principal.tenantId) : [],
    has("settings:view") || has("settings:manage") ? loadEligibilityPolicyState(db, principal.tenantId) : null,
  ]);
  const operations = filterCompanyScope(principal, allOperations, operation => operation.vehicle);
  const portfolio = filterPortfolioScope(principal, fullPortfolio);
  const visibleDocuments = new Set([
    ...operations.map(operation => operation.document.replace(/\D/g, "")),
    ...portfolio.titles.map(title => title.ownerDocument.replace(/\D/g, "")),
  ]);
  const cedents = parties
    .filter(party => party.roles.includes("cedente") && visibleDocuments.has(party.document.replace(/\D/g, "")))
    .map(partyToCedent);
  const policies = (policyState?.policies ?? []).filter(
    policy =>
      !!policy.company &&
      principal.companyScopes.some(
        scope => scope === "*" || scope.trim().toLowerCase() === policy.company!.trim().toLowerCase(),
      ),
  );
  const knowledge: SystemKnowledge = {
    operations,
    cedents,
    titles: portfolioHomeTitles(portfolio),
    policies,
    rules: masterRuleCatalog,
    parameters: operationalParametersFor(),
    today: copilotDate(),
  };
  const entityCompanies = new Map<string, string>([
    ...operations.map(operation => [`operation:${operation.id}`, operation.vehicle] as const),
    ...portfolio.titles.filter(title => title.company).map(title => [`title:${title.id}`, title.company!] as const),
    ...policies.filter(policy => policy.company).map(policy => [`policy:${policy.id}`, policy.company!] as const),
  ]);
  const additional = await loadOperationalSources(db, principal, operations, portfolio);
  additional.entities.forEach((company, id) => entityCompanies.set(id, company));
  return {
    knowledge,
    portfolio,
    entityCompanies,
    finance: additional.finance,
    commercial: additional.commercial,
    tasks: additional.tasks,
    additionalLabels: additional.labels,
    additionalBehavior: additional.behavior,
  };
}
