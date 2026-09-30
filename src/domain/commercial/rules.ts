import { daysBetween, digits, goalMonths, inRange, monthEnd, monthStart, round2 } from "./calendar";
import { type CommercialState, type CommissionLine, type CommissionRules, type Deal, type OpFinancials } from "./types";
// Módulo comercial: comerciais, carteira de clientes vinculados, visitas, funil, comitês, negócios e comissões.
// Regra central: todo negócio (operação efetivada) pertence ao comercial vinculado ao cliente NA DATA da operação.
// Transferir um cliente muda só os negócios futuros. A comissão é apurada por competência mensal e,
// depois de fechada, vira um lançamento a pagar no Financeiro.

import { type Operation } from "@/src/domain/core/types";
import { todayIso } from "@/src/domain/finance/ledger";

export const defaultRules: CommissionRules = {
  base: "receita",
  tiers: [
    { from: 0, rate: 3 },
    { from: 80, rate: 5 },
    { from: 100, rate: 7 },
    { from: 120, rate: 8 },
  ],
  newAccountBonus: 500,
  newAccountWindow: 90,
  clawback: true,
};

// [nome, documento, comercial, dias desde o vínculo, origem, limite, volume mensal, taxa a.m., segmento, cidade, dias desde a última operação (inativos), sem operação ainda]

/** Comercial dono do cliente numa data, considerando as transferências de carteira.
    Regra: o negócio pertence ao comercial vinculado ao cliente na data da operação. */
export function repAt(state: Pick<CommercialState, "links">, document: string, date: string): string | undefined {
  const link = state.links.find(l => digits(l.document) === digits(document));
  if (!link) return undefined;
  const transfers = [...link.transfers].sort((a, b) => a.at.localeCompare(b.at));
  let owner = transfers.length ? transfers[0].from : link.repId;
  for (const t of transfers) if (t.at <= date) owner = t.to;
  return owner;
}

/** Data comercial da operação: liberação ao financeiro; sem ela, a data do aditivo. */
export function dealDate(op: Operation, today: string) {
  const released = op.releaseReview?.releasedAt?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (released) return `${released[3]}-${released[2]}-${released[1]}`;
  const d = (op.aditivoNumber ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : today;
}

/** Operações liberadas ao financeiro no workspace viram negócios do comercial dono do cliente
    (gravado na operação quando ela nasce; sem registro, resolvido pelo vínculo na data). */
export function liveDeals(
  state: CommercialState,
  operations: Operation[],
  financials: OpFinancials,
  today = todayIso(),
): Deal[] {
  return operations
    .filter(op => op.status === "Liberada ao financeiro")
    .flatMap(op => {
      const f = financials[op.id];
      const date = dealDate(op, today);
      const repId = op.commercialRepId ?? repAt(state, op.document, date);
      if (!repId || !f) return [];
      return [
        {
          id: `live-${op.id}`,
          date,
          bordero: op.borderoNumber,
          clientName: op.cedent,
          document: op.document,
          repId,
          vehicle: op.vehicle,
          face: f.face,
          discount: f.discount,
          fees: f.fees,
          revenue: f.revenue,
          rate: f.rate,
          titles: op.titleCount,
          operationId: op.id,
          live: true,
        },
      ];
    });
}

export function firstDealDate(deals: Deal[], document: string) {
  return deals
    .filter(d => digits(d.document) === digits(document))
    .reduce<string | undefined>((min, d) => (!min || d.date < min ? d.date : min), undefined);
}

export function repMetrics(state: CommercialState, deals: Deal[], from: string, to: string, today = todayIso()) {
  return state.reps.map(rep => {
    const mine = deals.filter(d => d.repId === rep.id && inRange(d.date, from, to));
    const face = round2(mine.reduce((s, d) => s + d.face, 0));
    const revenue = round2(mine.reduce((s, d) => s + d.revenue, 0));
    const newAccounts = state.links.filter(
      l => l.repId === rep.id && l.origin !== "Carteira transferida" && inRange(l.since, from, to),
    );
    const activated = state.links.filter(
      l =>
        l.repId === rep.id &&
        (() => {
          const f = firstDealDate(deals, l.document);
          return f && inRange(f, from, to) && daysBetween(l.since, f) <= state.rules.newAccountWindow;
        })(),
    );
    const visits = state.visits.filter(v => v.repId === rep.id && inRange(v.date, from, to));
    const committees = state.committees.filter(c => c.repId === rep.id && inRange(c.decidedAt ?? c.date, from, to));
    const goal = round2(rep.monthlyGoal * goalMonths(from, to));
    const clients = new Set(mine.map(d => digits(d.document))).size;
    const portfolio = state.links.filter(l => l.repId === rep.id);
    const idle = portfolio.filter(
      l =>
        l.status !== "Em onboarding" &&
        (() => {
          const last = deals.filter(d => digits(d.document) === digits(l.document)).at(-1)?.date;
          return !last || daysBetween(last, today) > 30;
        })(),
    );
    return {
      rep,
      deals: mine.length,
      face,
      revenue,
      avgRate: face ? round2(mine.reduce((s, d) => s + d.rate * d.face, 0) / face) : 0,
      ticket: mine.length ? round2(face / mine.length) : 0,
      clients,
      portfolio: portfolio.length,
      idle,
      newAccounts,
      activated,
      goal,
      attainment: goal ? round2((revenue / goal) * 100) : 0,
      visitsDone: visits.filter(v => v.status === "Realizada").length,
      visitsPlanned: visits.filter(v => v.status === "Agendada").length,
      visitsLost: visits.filter(v => v.status === "Cancelada" || v.status === "Não realizada").length,
      committeesApproved: committees.filter(c => c.status === "Aprovado" || c.status === "Aprovado com ressalvas")
        .length,
      committeesRejected: committees.filter(c => c.status === "Reprovado").length,
      committeesPending: state.committees.filter(c => c.repId === rep.id && c.status === "Em pauta").length,
      pipeline: round2(
        state.prospects
          .filter(p => p.repId === rep.id && !p.lost && p.stage !== "Aprovado")
          .reduce((s, p) => s + p.potential, 0),
      ),
    };
  });
}

export function tierRate(rules: CommissionRules, attainment: number) {
  return (
    [...rules.tiers]
      .sort((a, b) => a.from - b.from)
      .filter(t => attainment >= t.from)
      .at(-1)?.rate ?? 0
  );
}

export function computeCommission(
  state: CommercialState,
  deals: Deal[],
  month: string,
  rules = state.rules,
): CommissionLine[] {
  const from = monthStart(month),
    to = monthEnd(month);
  return state.reps
    .filter(r => r.active)
    .map(rep => {
      const mine = deals.filter(d => d.repId === rep.id && inRange(d.date, from, to));
      const base = round2(mine.reduce((s, d) => s + (rules.base === "receita" ? d.revenue : d.face), 0));
      const revenue = round2(mine.reduce((s, d) => s + d.revenue, 0));
      const goal = rep.monthlyGoal;
      const attainment = goal ? round2((revenue / goal) * 100) : 0;
      const rate = rep.flatRate ?? tierRate(rules, attainment);
      const pct = rate / 100;
      const commission = round2(base * pct);
      const bonusAccounts = state.links
        .filter(
          l =>
            l.repId === rep.id &&
            l.origin !== "Carteira transferida" &&
            (() => {
              const f = firstDealDate(deals, l.document);
              return f && inRange(f, from, to) && daysBetween(l.since, f) <= rules.newAccountWindow;
            })(),
        )
        .map(l => l.clientName);
      const bonus = round2(bonusAccounts.length * rules.newAccountBonus);
      const dealClawback = mine
        .filter(d => d.repurchased)
        .reduce((s, d) => s + (rules.base === "receita" ? d.revenue : d.face) * (d.repurchased! / d.face) * pct, 0);
      // Recompras registradas na Carteira: estorno proporcional à receita que o cliente gera por real de face.
      const carteiraClawback = (state.carteiraEvents ?? [])
        .filter(e => inRange(e.date, from, to) && repAt(state, e.document, e.date) === rep.id)
        .reduce((s, e) => {
          const clientDeals = deals.filter(d => digits(d.document) === digits(e.document));
          const face = clientDeals.reduce((t, d) => t + d.face, 0);
          const take =
            rules.base === "receita" ? (face ? clientDeals.reduce((t, d) => t + d.revenue, 0) / face : 0) : 1;
          return s + e.amount * take * pct;
        }, 0);
      const clawback = rules.clawback ? round2(dealClawback + carteiraClawback) : 0;
      return {
        repId: rep.id,
        base,
        goal,
        attainment,
        rate,
        commission,
        bonus,
        bonusAccounts,
        clawback,
        total: round2(commission + bonus - clawback),
        deals: mine.length,
      };
    });
}
