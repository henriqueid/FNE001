import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";

type ScopedPrincipal = Pick<ServerPrincipal, "companyScopes">;

const titleAllowed = (principal: ScopedPrincipal, company?: string) =>
  !!company && principalHasCompanyScope(principal, company);

export function filterPortfolioScope(principal: ScopedPrincipal, state: PortfolioState): PortfolioState {
  const titles = state.titles.filter(title => titleAllowed(principal, title.company));
  return { ...state, titles, historicalTitleCount: titles.length };
}

export function mergePortfolioScope(
  principal: ScopedPrincipal,
  current: PortfolioState,
  candidate: PortfolioState,
): { state?: PortfolioState; error?: string } {
  if (candidate.titles.some(title => !titleAllowed(principal, title.company)))
    return { error: "A Carteira enviada contém título de uma empresa fora do seu escopo." };

  const currentById = new Map(current.titles.map(title => [title.id, title]));
  const candidateById = new Map(candidate.titles.map(title => [title.id, title]));
  if (candidate.titles.some(title => !currentById.has(title.id)))
    return { error: "A Carteira enviada contém um título que não pertence à posição atual." };

  const scopedCurrent = current.titles.filter(title => titleAllowed(principal, title.company));
  if (scopedCurrent.some(title => !candidateById.has(title.id)))
    return { error: "A Carteira enviada não pode remover títulos do seu escopo." };

  return {
    state: {
      ...current,
      titles: current.titles.map(title =>
        titleAllowed(principal, title.company) ? candidateById.get(title.id)! : title,
      ),
    },
  };
}
