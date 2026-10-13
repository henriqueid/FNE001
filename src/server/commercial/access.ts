import type { CommercialState } from "@/src/domain/commercial/types";
import type { ServerPrincipal } from "@/src/server/access/repository";

type CommercialPrincipal = Pick<ServerPrincipal, "access" | "permissions" | "commercialRepId" | "accountManagerId">;

export class CommercialScopeError extends Error {}

export function hasFullCommercialScope(principal: CommercialPrincipal) {
  return (
    principal.access === "admin" ||
    principal.permissions.includes("users:manage") ||
    principal.permissions.includes("risk:decide")
  );
}

const representativeIds = (principal: CommercialPrincipal) =>
  new Set([principal.commercialRepId, principal.accountManagerId].filter((value): value is string => !!value));

const visibleLink = (repIds: Set<string>, link: CommercialState["links"][number]) =>
  repIds.has(link.repId) || (!!link.managerId && repIds.has(link.managerId));

export function filterCommercialState(state: CommercialState, principal: CommercialPrincipal): CommercialState {
  if (hasFullCommercialScope(principal)) return state;
  const repIds = representativeIds(principal);
  const links = state.links.filter(link => visibleLink(repIds, link));
  const documents = new Set(links.map(link => link.document.replace(/\D/g, "")));
  const closings = Object.fromEntries(
    Object.entries(state.closings)
      .map(([month, closing]) => [month, { ...closing, lines: closing.lines.filter(line => repIds.has(line.repId)) }])
      .filter(([, closing]) => (closing as CommercialState["closings"][string]).lines.length > 0),
  );
  return {
    ...state,
    reps: state.reps.filter(rep => repIds.has(rep.id)),
    links,
    deals: state.deals.filter(deal => repIds.has(deal.repId) || documents.has(deal.document.replace(/\D/g, ""))),
    visits: state.visits.filter(visit => repIds.has(visit.repId)),
    committees: state.committees.filter(committee => repIds.has(committee.repId)),
    prospects: state.prospects.filter(prospect => repIds.has(prospect.repId)),
    closings,
  };
}

function assertSubmittedScope(state: CommercialState, repIds: Set<string>, visibleDocuments: Set<string>) {
  const invalid =
    state.links.some(link => !visibleLink(repIds, link)) ||
    state.deals.some(deal => !repIds.has(deal.repId) && !visibleDocuments.has(deal.document.replace(/\D/g, ""))) ||
    state.visits.some(visit => !repIds.has(visit.repId)) ||
    state.committees.some(committee => !repIds.has(committee.repId)) ||
    state.prospects.some(prospect => !repIds.has(prospect.repId));
  if (invalid) throw new CommercialScopeError("O Comercial enviado contém registros fora da sua carteira.");
}

const hidden = <T>(items: T[], visible: (item: T) => boolean) => items.filter(item => !visible(item));

/** Recompõe o agregado completo sem permitir que uma visão segmentada apague ou altere carteiras ocultas. */
export function mergeCommercialScope(
  previous: CommercialState | null,
  submitted: CommercialState,
  principal: CommercialPrincipal,
): CommercialState {
  if (hasFullCommercialScope(principal)) return submitted;
  if (!previous)
    throw new CommercialScopeError(
      "A estrutura Comercial deve ser inicializada por um gestor antes do uso segmentado.",
    );
  const repIds = representativeIds(principal);
  if (!repIds.size) throw new CommercialScopeError("Seu usuário não possui vínculo com um responsável comercial.");

  const previousVisibleLinks = previous.links.filter(link => visibleLink(repIds, link));
  const visibleDocuments = new Set(
    [...previousVisibleLinks, ...submitted.links].map(link => link.document.replace(/\D/g, "")),
  );
  assertSubmittedScope(submitted, repIds, visibleDocuments);

  return {
    ...submitted,
    reps: previous.reps,
    links: [...hidden(previous.links, link => visibleLink(repIds, link)), ...submitted.links],
    deals: [
      ...hidden(
        previous.deals,
        deal => repIds.has(deal.repId) || visibleDocuments.has(deal.document.replace(/\D/g, "")),
      ),
      ...submitted.deals,
    ],
    visits: [...hidden(previous.visits, visit => repIds.has(visit.repId)), ...submitted.visits],
    committees: [...hidden(previous.committees, committee => repIds.has(committee.repId)), ...submitted.committees],
    prospects: [...hidden(previous.prospects, prospect => repIds.has(prospect.repId)), ...submitted.prospects],
    rules: previous.rules,
    closings: previous.closings,
    seq: Math.max(previous.seq, submitted.seq),
  };
}
