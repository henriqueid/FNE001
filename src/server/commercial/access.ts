import { sameCommercialValue } from "@/src/domain/commercial/persistence";
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
  const previousVisibleDocuments = new Set(previousVisibleLinks.map(link => link.document.replace(/\D/g, "")));
  const hiddenDocuments = new Set([
    ...previous.links.filter(link => !visibleLink(repIds, link)).map(link => link.document.replace(/\D/g, "")),
    ...previous.deals
      .filter(deal => !repIds.has(deal.repId) && !previousVisibleDocuments.has(deal.document.replace(/\D/g, "")))
      .map(deal => deal.document.replace(/\D/g, "")),
  ]);
  if (
    submitted.links.some(
      link =>
        hiddenDocuments.has(link.document.replace(/\D/g, "")) &&
        !previousVisibleDocuments.has(link.document.replace(/\D/g, "")),
    )
  )
    throw new CommercialScopeError("O Comercial enviado contém registros fora da sua carteira.");
  const visibleDocuments = new Set([
    ...previousVisibleDocuments,
    ...submitted.links.map(link => link.document.replace(/\D/g, "")),
  ]);
  assertSubmittedScope(submitted, repIds, visibleDocuments);
  const visible = filterCommercialState(previous, principal);
  for (const key of ["links", "deals", "visits", "committees", "prospects"] as const) {
    const hiddenIds = new Set(
      previous[key].filter(item => !visible[key].some(own => own.id === item.id)).map(item => item.id),
    );
    if (submitted[key].some(item => hiddenIds.has(item.id)))
      throw new CommercialScopeError("O Comercial enviado contém registros fora da sua carteira.");
  }

  return {
    ...submitted,
    reps: previous.reps,
    links: [...hidden(previous.links, link => visibleLink(repIds, link)), ...submitted.links],
    deals: [
      ...hidden(
        previous.deals,
        deal => repIds.has(deal.repId) || previousVisibleDocuments.has(deal.document.replace(/\D/g, "")),
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

/** Exige alçada também para snapshots novos e vincula limites às decisões desta gravação. */
export function authorizeCommercialTransition(
  previous: CommercialState | null,
  next: CommercialState,
  principal: CommercialPrincipal,
) {
  const decisions = next.committees.filter(committee => {
    const prior = previous?.committees.find(item => item.id === committee.id);
    return (
      (!prior || prior.status === "Em pauta") &&
      (committee.status !== "Em pauta" ||
        committee.approved !== prior?.approved ||
        (!!prior && committee.rate !== prior.rate) ||
        committee.riskOpinion !== prior?.riskOpinion ||
        committee.conditions !== prior?.conditions ||
        committee.decidedAt !== prior?.decidedAt ||
        committee.decidedBy !== prior?.decidedBy ||
        committee.history.slice(prior?.history.length ?? 0).some(event => event.action === "Adiado"))
    );
  });
  const changedLimits = next.links.filter(link => {
    const prior = previous?.links.find(item => item.id === link.id);
    return (
      link.approvedLimit !== (prior?.approvedLimit ?? 0) ||
      (!!prior && link.approvedLimit > 0 && link.document.replace(/\D/g, "") !== prior.document.replace(/\D/g, ""))
    );
  });
  if ((decisions.length || changedLimits.length) && !principal.permissions.includes("risk:decide"))
    throw new CommercialScopeError(
      "Somente um usuário com alçada de risco pode registrar decisões ou alterar limites.",
    );
  for (const link of changedLimits) {
    const prior = previous?.links.find(item => item.id === link.id);
    const matching = decisions.filter(
      committee =>
        (committee.status === "Aprovado" || committee.status === "Aprovado com ressalvas") &&
        committee.request !== "Taxa especial" &&
        committee.request !== "Concentração de sacado" &&
        (committee.document
          ? committee.document.replace(/\D/g, "") === link.document.replace(/\D/g, "")
          : committee.clientName === link.clientName),
    );
    if (matching.length !== 1 || !Number.isFinite(matching[0].approved) || !(matching[0].approved! > 0))
      throw new CommercialScopeError("A alteração de limite exige uma nova decisão correspondente do comitê.");
    const decision = matching[0];
    const expected =
      decision.request === "Aumento de limite" ? (prior?.approvedLimit ?? 0) + decision.approved! : decision.approved!;
    if (link.approvedLimit !== expected)
      throw new CommercialScopeError("O limite enviado diverge do valor autorizado pela decisão do comitê.");
  }
  for (const [month, closing] of Object.entries(next.closings)) {
    const prior = previous?.closings[month];
    if (
      (prior?.status === "Enviada ao financeiro" ||
        closing.status === "Enviada ao financeiro" ||
        closing.financeTitles?.length ||
        closing.sentAt) &&
      !sameCommercialValue(prior, closing)
    )
      throw new CommercialScopeError("O envio de comissões ao Financeiro exige o comando específico.");
  }
  for (const [month, closing] of Object.entries(previous?.closings ?? {}))
    if (closing.status === "Enviada ao financeiro" && !next.closings[month])
      throw new CommercialScopeError("O fechamento enviado ao Financeiro não pode ser removido.");
}
