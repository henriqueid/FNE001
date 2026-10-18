/** Reutiliza os filtros oficiais dos módulos e só associa registros com empresa identificável. */
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { loadFinanceState } from "@/src/server/finance/repository";
import { filterFinanceState } from "@/src/server/finance/access";
import { loadCommercialState } from "@/src/server/commercial/repository";
import { filterCommercialState } from "@/src/server/commercial/access";
import { loadTaskState } from "@/src/server/tasks/repository";
import { visibleTaskState } from "@/src/server/tasks/access";
import type { Operation } from "@/src/domain/core/types";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";

export async function loadOperationalSources(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  operations: Operation[],
  portfolio: PortfolioState,
) {
  const [fullFinance, fullCommercial, taskState] = await Promise.all([
    principal.permissions.includes("finance:view") ? loadFinanceState(db, principal.tenantId) : null,
    principal.permissions.includes("portfolio:manage") || principal.permissions.includes("risk:decide")
      ? loadCommercialState(db, principal.tenantId)
      : null,
    principal.permissions.includes("operations:view") ? loadTaskState(db, principal.tenantId) : null,
  ]);
  const operationCompanies = new Map(operations.map(operation => [operation.id, operation.vehicle]));
  const finance = filterFinanceState(fullFinance, principal, operationCompanies);
  const commercial = fullCommercial ? filterCommercialState(fullCommercial, principal) : null;
  const companyByDocument = new Map<string, string>();
  operations.forEach(operation => companyByDocument.set(operation.document.replace(/\D/g, ""), operation.vehicle));
  portfolio.titles
    .filter(title => title.company)
    .forEach(title => {
      companyByDocument.set(title.ownerDocument.replace(/\D/g, ""), title.company!);
      companyByDocument.set(title.debtorDocument.replace(/\D/g, ""), title.company!);
    });
  const entities = new Map<string, string>();
  const labels = new Map<string, string>();
  const behavior: BehaviorEvent[] = [];
  finance?.titles.forEach(title => {
    entities.set(`finance:${title.id}`, title.company);
    labels.set(`finance:${title.id}`, `${title.description} · ${title.counterparty}`);
    title.history.forEach((entry, index) =>
      behavior.push({
        id: `finance:${title.id}:${index}`,
        tenantId: principal.tenantId,
        company: title.company,
        entityId: `finance:${title.id}`,
        actorId: entry.by,
        at: entry.at,
        kind: "observation",
        text: `${entry.action}: ${entry.detail}`,
        source: "finance",
        visibility: "company",
        status: "recorded",
        evidenceRefs: [`finance:${title.id}`],
      }),
    );
  });
  if (commercial) {
    commercial.visits = commercial.visits.filter(
      visit => visit.document && companyByDocument.has(visit.document.replace(/\D/g, "")),
    );
    commercial.committees = commercial.committees.filter(
      item => item.document && companyByDocument.has(item.document.replace(/\D/g, "")),
    );
    commercial.visits.forEach(visit => {
      const company = companyByDocument.get(visit.document!.replace(/\D/g, ""))!;
      const entityId = `visit:${visit.id}`;
      entities.set(entityId, company);
      labels.set(entityId, `Visita ${visit.target} · ${visit.date}`);
      if (visit.notes || visit.outcome)
        behavior.push({
          id: entityId,
          tenantId: principal.tenantId,
          company,
          entityId,
          actorId: visit.repId,
          at: visit.date,
          kind: "observation",
          text: `${visit.status}: ${visit.notes ?? ""} ${visit.outcome ?? ""}`,
          source: "commercial",
          visibility: "company",
          status: "recorded",
          evidenceRefs: [entityId],
        });
    });
    commercial.committees.forEach(item => {
      const company = companyByDocument.get(item.document!.replace(/\D/g, ""))!;
      const entityId = `committee:${item.id}`;
      entities.set(entityId, company);
      labels.set(entityId, `Comitê ${item.clientName} · ${item.date}`);
      behavior.push({
        id: entityId,
        tenantId: principal.tenantId,
        company,
        entityId,
        actorId: item.decidedBy ?? item.repId,
        at: item.decidedAt ?? item.date,
        kind: "decision",
        text: `${item.request}: ${item.status}. ${item.commercialOpinion} ${item.riskOpinion ?? ""} Condições: ${item.conditions ?? "não informadas"}. Não concede nova alçada.`,
        source: "commercial",
        visibility: "company",
        status: "recorded",
        evidenceRefs: [entityId],
      });
    });
    commercial.deals = commercial.deals.filter(deal => principalHasCompanyScope(principal, deal.vehicle));
  }
  const tasks = visibleTaskState(taskState, principal, operationCompanies);
  if (tasks)
    tasks.tasks = tasks.tasks.filter(
      task => task.snapshot.operationId && operationCompanies.has(task.snapshot.operationId),
    );
  tasks?.tasks.forEach(task => {
    const company = operationCompanies.get(task.snapshot.operationId!)!;
    const entityId = `task:${task.id}`;
    entities.set(entityId, company);
    labels.set(entityId, task.snapshot.title);
    task.history.forEach(entry =>
      behavior.push({
        id: `task:${task.id}:${entry.id}`,
        tenantId: principal.tenantId,
        company,
        entityId,
        actorId: entry.by,
        at: entry.at,
        kind: "observation",
        text: `${entry.action}: ${entry.detail}`,
        source: "task",
        visibility: "private",
        status: "recorded",
        evidenceRefs: [entityId, `operation:${task.snapshot.operationId}`],
      }),
    );
  });
  return { finance, commercial, tasks, entities, labels, behavior };
}
