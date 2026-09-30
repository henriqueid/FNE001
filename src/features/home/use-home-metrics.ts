"use client";
/**
 * Hook de métricas da visão geral: recorta operações, carteira e financeiro pela empresa
 * e pelo período escolhidos e devolve, tipado, tudo o que cabeçalho, KPIs e cards exibem.
 * Não guarda estado próprio; período, perfil e relógio vêm de `use-home-preferences.ts`.
 */
import {
  buildConcentrationRows,
  buildCollectionRows,
  buildMilestones,
  buildNeeds,
  buildRiskAlerts,
} from "./home-metrics-builders";

import { useCedents } from "@/src/app/registry-context";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { accountBalance, scopedAccounts } from "@/src/domain/finance/banking";
import { type CarteiraFlow, dailyProjection } from "@/src/domain/finance/reports";
import type { FinanceState } from "@/src/domain/finance/model";
import {
  aging,
  cedentExposure,
  daysBetween,
  debtorExposure,
  isActive,
  isLive,
  isoDate,
  isSlower,
  maturityAgenda,
  operationDate,
  origination,
  periodWindow,
  portfolioTitles,
  settlementPending,
  teamRows,
  vehicleExposure,
  type OpFinancial,
} from "@/src/domain/home/metrics";
import { homeSettings, periodLabels, type HomePeriod, type HomeProfile } from "@/src/domain/home/settings";
import { useMemo } from "react";

export type HomeMetricsInput = {
  operations: Operation[];
  debtors: Debtor[];
  financials: Record<string, OpFinancial>;
  finance: FinanceState;
  carteira: CarteiraFlow[];
  companyScope: string;
  period: HomePeriod;
  profile: HomeProfile;
  now: Date;
};

export type HealthTone = "critical" | "watch" | "ok";

export type HomeMetrics = ReturnType<typeof useHomeMetrics>;

export function useHomeMetrics({
  operations,
  debtors,
  financials,
  finance,
  carteira,
  companyScope,
  period,
  profile,
  now,
}: HomeMetricsInput) {
  const registryCedents = useCedents();
  const fin = financials;
  const today = isoDate(now);
  const labels = periodLabels[period];

  /* originação no recorte de empresa, período atual e anterior */
  const scoped = useMemo(
    () => (companyScope === "Consolidado" ? operations : operations.filter(op => op.vehicle === companyScope)),
    [operations, companyScope],
  );
  const win = useMemo(() => periodWindow(period, now), [period, now]);
  const cur = useMemo(() => origination(scoped, fin, win.from, win.to, today), [scoped, fin, win, today]);
  const prev = useMemo(() => origination(scoped, fin, win.prevFrom, win.prevTo, today), [scoped, fin, win, today]);
  const target =
    homeSettings.volumeTarget[period] *
    (companyScope === "Consolidado" ? 1 : (homeSettings.vehicleTargetShare[companyScope] ?? 0));

  // carteira: títulos em aberto + títulos das operações liberadas ao financeiro
  const titles = useMemo(
    () => portfolioTitles(operations).filter(t => companyScope === "Consolidado" || t.vehicle === companyScope),
    [operations, companyScope],
  );
  const portfolioTotal = titles.reduce((s, t) => s + t.amount, 0);
  const agingBuckets = useMemo(() => aging(titles, today), [titles, today]);
  const overdueTitles = titles.filter(t => t.dueDate < today);
  const overdueTotal = overdueTitles.reduce((s, t) => s + t.amount, 0);
  const overdueRatio = portfolioTotal ? (overdueTotal / portfolioTotal) * 100 : 0;
  const agenda = useMemo(() => maturityAgenda(titles, today), [titles, today]);
  const cedExp = useMemo(
    () => cedentExposure(titles, operations, registryCedents, portfolioTotal, today),
    [titles, operations, registryCedents, portfolioTotal, today],
  );
  const debExp = useMemo(
    () => debtorExposure(titles, debtors, portfolioTotal, today),
    [titles, debtors, portfolioTotal, today],
  );
  const vehExp = useMemo(() => vehicleExposure(scoped, fin), [scoped, fin]);

  // caixa: saldos reais das contas + títulos do financeiro + carteira − operações prontas para liberar
  const bankAccounts = scopedAccounts(finance, companyScope);
  const bankBalance = bankAccounts.reduce((s, a) => s + accountBalance(finance, a.id), 0);
  const minimumCash = bankAccounts.reduce((s, a) => s + a.minimumBalance, 0);
  const netOf = (op: Operation) => fin[op.id]?.net || op.netAmount || op.amount;
  const readyOut = scoped.filter(op => op.status === "Pronta para liberar").reduce((s, op) => s + netOf(op), 0);
  const formalizationOut = scoped
    .filter(op => isActive(op) && (op.status === "Pronta para formalizar" || op.stage === 5))
    .reduce((s, op) => s + netOf(op), 0);
  const cash = useMemo(() => {
    const curve = (factor: number) =>
      dailyProjection(finance, companyScope, today, carteira, factor).map(
        (v, i) => v - readyOut - (i >= 2 ? formalizationOut : 0),
      );
    const openFin = finance.titles.filter(
      t => t.status === "Em aberto" && (companyScope === "Consolidado" || t.company === companyScope),
    );
    const dueToday = openFin.filter(t => t.kind === "Pagar" && t.dueDate <= today).reduce((s, t) => s + t.amount, 0);
    const inflow30 =
      carteira.filter(c => c.date >= today && daysBetween(today, c.date) <= 30).reduce((s, c) => s + c.amount, 0) +
      openFin
        .filter(t => t.kind === "Receber" && daysBetween(today, t.dueDate) <= 30)
        .reduce((s, t) => s + t.amount, 0);
    return {
      base: curve(homeSettings.recovery.base),
      conservative: curve(homeSettings.recovery.conservative),
      optimistic: curve(homeSettings.recovery.optimistic),
      outflowToday: dueToday + readyOut,
      inflow30,
    };
  }, [finance, companyScope, today, carteira, readyOut, formalizationOut]);
  const overduePayables = finance.titles.filter(
    t =>
      t.status === "Em aberto" &&
      t.kind === "Pagar" &&
      t.dueDate < today &&
      (companyScope === "Consolidado" || t.company === companyScope),
  );
  const releasesToPay = finance.titles.filter(
    t =>
      t.status === "Em aberto" &&
      t.origin === "Liberação de operação" &&
      (companyScope === "Consolidado" || t.company === companyScope),
  );
  const pend = settlementPending();
  const team = useMemo(() => teamRows(scoped, fin, win.from, win.to, today), [scoped, fin, win, today]);

  /* esteira: operações em andamento, prontas e com bloqueio */
  const active = scoped.filter(isActive);
  const activeAmount = active.reduce((s, op) => s + op.amount, 0);
  const ready = active.filter(op => op.status === "Pronta para liberar");
  const readyAmount = ready.reduce((s, op) => s + (fin[op.id]?.net || op.netAmount || op.amount), 0);
  const blockedOps = active.filter(op => op.blockers > 0);
  const interventions = active.filter(op => op.blockers > 0 || op.alerts > 1 || isSlower(op));
  const capacity = Math.min(...cash.base.slice(0, 8)) - minimumCash;
  const freeCash = bankBalance - minimumCash;
  const dueToday = agenda[0];
  const fromReleased = titles.filter(t => t.source === "Operação liberada");

  // tendência por intervalo do período
  const trendValues = win.buckets.map(b =>
    scoped.filter(op => isLive(op) && b.match(op)).reduce((s, op) => s + (fin[op.id]?.face || op.amount), 0),
  );
  const trendRevenue = win.buckets.map(b =>
    scoped.filter(op => isLive(op) && b.match(op)).reduce((s, op) => s + (fin[op.id]?.revenue ?? 0), 0),
  );

  /* listas derivadas: alertas, pendências, marcos, cobrança e concentração */
  const alerts = buildRiskAlerts({ cedExp, debExp, titles, active, today });
  const profileAlerts = alerts.filter(a => a.profiles.includes(profile));
  const needs = buildNeeds({
    active,
    fin,
    releasesToPay,
    overduePayables,
    overdueTitles,
    overdueTotal,
    dueToday,
    pend,
    profile,
  });
  const milestones = buildMilestones({ blockedOps, fromReleased, ready, readyAmount, dueToday, pend });
  const collectionRows = buildCollectionRows(agingBuckets, pend);
  const { cedRows, debRows, vehRows } = buildConcentrationRows(cedExp, debExp, vehExp);

  /* situação geral para o briefing */
  const criticalCount = needs.filter(n => n.severity === "critical").length;
  const urgentCount = needs.filter(n => n.severity === "serious").length;
  const health: { tone: HealthTone; label: string } =
    criticalCount > 0
      ? { tone: "critical", label: "Exige decisão" }
      : urgentCount > 0
        ? { tone: "watch", label: "Atenção" }
        : { tone: "ok", label: "Sob controle" };
  const volumePct = target ? (cur.volume / target) * 100 : 0;
  const lastDate = scoped
    .filter(isLive)
    .map(op => operationDate(op, today))
    .sort()
    .pop();
  const periodEmpty = cur.count === 0 && period !== "mes";

  return {
    today,
    labels,
    scoped,
    win,
    cur,
    prev,
    target,
    volumePct,
    lastDate,
    periodEmpty,
    titles,
    portfolioTotal,
    agingBuckets,
    overdueTitles,
    overdueTotal,
    overdueRatio,
    agenda,
    dueToday,
    cedExp,
    debExp,
    cedRows,
    debRows,
    vehRows,
    cash,
    bankBalance,
    minimumCash,
    capacity,
    freeCash,
    active,
    activeAmount,
    ready,
    readyAmount,
    blockedOps,
    interventions,
    team,
    trendValues,
    trendRevenue,
    profileAlerts,
    needs,
    milestones,
    collectionRows,
    criticalCount,
    urgentCount,
    health,
  };
}
