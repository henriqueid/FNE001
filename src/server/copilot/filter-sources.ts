/** Aplica o mesmo recorte explícito a dados, comportamento e fontes complementares. */
import type { CopilotSources } from "./sources";
export function filterCopilotSources(sources: CopilotSources, filters?: { company?: string; document?: string }) {
  const document = filters?.document?.replace(/\D/g, "");
  const matching = new Set<string>();
  if (document) {
    sources.knowledge.titles
      .filter(title => [title.ownerDocument, title.debtorDocument].some(value => value.replace(/\D/g, "") === document))
      .forEach(title => matching.add(`title:${title.id}`));
    sources.knowledge.operations
      .filter(operation => operation.document.replace(/\D/g, "") === document)
      .forEach(operation => matching.add(`operation:${operation.id}`));
    sources.finance?.titles
      .filter(title => title.counterpartyDocument?.replace(/\D/g, "") === document)
      .forEach(title => matching.add(`finance:${title.id}`));
    sources.commercial?.visits
      .filter(visit => visit.document?.replace(/\D/g, "") === document)
      .forEach(visit => matching.add(`visit:${visit.id}`));
    sources.commercial?.committees
      .filter(item => item.document?.replace(/\D/g, "") === document)
      .forEach(item => matching.add(`committee:${item.id}`));
    sources.tasks?.tasks
      .filter(task => matching.has(`operation:${task.snapshot.operationId}`))
      .forEach(task => matching.add(`task:${task.id}`));
  }
  const refs = new Set(
    [...sources.entityCompanies]
      .filter(
        ([ref, company]) =>
          (!filters?.company || company.toLowerCase() === filters.company.toLowerCase()) &&
          (!document || matching.has(ref)),
      )
      .map(([ref]) => ref),
  );
  return {
    refs,
    data: {
      finance: sources.finance
        ? { ...sources.finance, titles: sources.finance.titles.filter(title => refs.has(`finance:${title.id}`)) }
        : null,
      commercial: sources.commercial
        ? {
            ...sources.commercial,
            visits: sources.commercial.visits.filter(visit => refs.has(`visit:${visit.id}`)),
            committees: sources.commercial.committees.filter(item => refs.has(`committee:${item.id}`)),
          }
        : null,
      tasks: sources.tasks
        ? { ...sources.tasks, tasks: sources.tasks.tasks.filter(task => refs.has(`task:${task.id}`)) }
        : null,
    },
  };
}
