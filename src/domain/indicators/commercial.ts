/**
 * Indicadores comerciais: clientes sem operar por faixa de dias (risco de perder o cliente),
 * funil ponderado pela probabilidade de cada etapa (política) e, por comercial, taxa média,
 * receita e qualidade da carteira trazida (vencido e recompra).
 */
import { type CommercialState } from "@/src/domain/commercial/types";
import { type IndicatorParameters } from "@/src/domain/risk/quality-policy";
import { daysFrom } from "./portfolio";

export function commercialIndicators(
  state: CommercialState,
  today: string,
  params: Pick<IndicatorParameters, "inactiveDays" | "funnelProbability">,
  portfolioByRep: Record<string, { open: number; overdue: number; repurchased: number }> = {},
) {
  const lastDeal = new Map<string, string>();
  state.deals.forEach(d => {
    const key = d.document.replace(/\D/g, "");
    if (!lastDeal.has(key) || (lastDeal.get(key) ?? "") < d.date) lastDeal.set(key, d.date);
  });
  const clients = state.links.filter(l => l.status === "Ativo");
  const idle = clients.map(l => {
    const last = lastDeal.get(l.document.replace(/\D/g, ""));
    return { link: l, days: last ? daysFrom(last, today) : daysFrom(l.since, today), never: !last };
  });
  const [d1, d2, d3] = params.inactiveDays;
  const prospects = state.prospects.filter(p => !p.lost);
  const weighted = prospects.reduce((s, p) => s + (p.potential * (params.funnelProbability[p.stage] ?? 0)) / 100, 0);
  const byRep = state.reps.map(rep => {
    const deals = state.deals.filter(d => d.repId === rep.id);
    const face = deals.reduce((s, d) => s + d.face, 0);
    const p = portfolioByRep[rep.id] ?? { open: 0, overdue: 0, repurchased: 0 };
    return {
      id: rep.id,
      name: rep.name,
      deals: deals.length,
      face,
      revenue: deals.reduce((s, d) => s + d.revenue, 0),
      rate: face ? deals.reduce((s, d) => s + d.rate * d.face, 0) / face : 0,
      overdueRate: p.open ? (p.overdue / p.open) * 100 : 0,
      repurchaseRate: face ? (p.repurchased / face) * 100 : 0,
    };
  });
  return {
    activeClients: clients.length,
    idle1: idle.filter(x => x.days > d1 && x.days <= d2),
    idle2: idle.filter(x => x.days > d2 && x.days <= d3),
    idle3: idle.filter(x => x.days > d3),
    weightedPipeline: weighted,
    pipeline: prospects.reduce((s, p) => s + p.potential, 0),
    byRep,
  };
}
