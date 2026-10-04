"use client";
/**
 * Hook de métricas da visão geral: recorta operações, carteira e financeiro pela empresa
 * e pelo período escolhidos e devolve, tipado, tudo o que cabeçalho, KPIs e cards exibem.
 * Não guarda estado próprio; período, perfil e relógio vêm de `use-home-preferences.ts`.
 */
import { useQuality } from "@/src/features/risk/use-quality-policy";
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
import { type CarteiraFlow, cashFlow, dailyProjection } from "@/src/domain/finance/reports";
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
import { demoCedentHistories, demoDebtorHistories } from "@/src/domain/core/demo/quality-history";
import { collectionMonth, concentration, rollRates, vintages } from "@/src/domain/risk/portfolio-dynamics";
import { qualityRankings } from "@/src/domain/risk/quality";
import { type QualityPolicy, provisionRate } from "@/src/domain/risk/quality-policy";
import { originationIndicators } from "@/src/domain/indicators/origination";
import { financeIndicators } from "@/src/domain/indicators/finance";
import { pipelineIndicators } from "@/src/domain/indicators/pipeline";
import { daysFrom } from "@/src/domain/indicators/portfolio";
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
  qualityPolicy: QualityPolicy;
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
  qualityPolicy,
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
  // linha do tempo do caixa para o gráfico principal: realizado (30 dias atrás) + projetado (60 dias à frente)
  const timeline = useMemo(() => {
    const back = homeSettings.timeline.daysBack,
      ahead = homeSettings.timeline.daysAhead;
    const from = isoDate(new Date(new Date(`${today}T12:00:00`).getTime() - back * 86_400_000));
    const to = isoDate(new Date(new Date(`${today}T12:00:00`).getTime() + ahead * 86_400_000));
    const run = (factor: number) =>
      cashFlow(finance, { scope: companyScope, from, to, today, granularity: "dia", carteira, carteiraFactor: factor });
    const base = run(homeSettings.recovery.base);
    const todayIndex = base.findIndex(p => p.from === today);
    // a partir de hoje desconta as liberações prontas; de D+2 em diante, as que estão em formalização
    const adjust = (closing: number, i: number) =>
      i < todayIndex ? closing : closing - readyOut - (i >= todayIndex + 2 ? formalizationOut : 0);
    const line = (points: typeof base) => points.map((p, i) => adjust(p.closing, i));
    return {
      dates: base.map(p => p.from),
      todayIndex,
      base: line(base),
      conservative: line(run(homeSettings.recovery.conservative)),
      optimistic: line(run(homeSettings.recovery.optimistic)),
      inflow: base.map(p => p.totalIn),
      outflow: base.map(p => p.totalOut),
      // descontos aplicados sobre a curva: aparecem marcados no gráfico para a queda não parecer erro
      readyOut,
      formalizationOut,
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

  /* risco: histórico mensal, qualidade (piorando × melhorando), rolagem, safras, concentração e cobrança */
  // históricos compartilhados pelo app (o mesmo score do cadastro e da operação); fora do provedor, gera aqui
  const shared = useQuality();
  const cedentHistories = useMemo(
    () => shared?.cedentHistories ?? demoCedentHistories(registryCedents, today),
    [shared, registryCedents, today],
  );
  const scopedCedentHistories = useMemo(
    () =>
      cedExp.flatMap(exposure => {
        const history = cedentHistories.find(item => item.document === exposure.document);
        return history ? [{ ...history, exposure: exposure.exposure }] : [];
      }),
    [cedentHistories, cedExp],
  );
  const debtorHistories = useMemo(() => {
    const known = new Map((shared?.debtorHistories ?? []).map(h => [h.document, h]));
    const missing = debExp.filter(d => !known.has(d.document));
    const generated = new Map(
      demoDebtorHistories(
        missing.map(d => ({
          id: d.document,
          name: d.name,
          document: d.document,
          exposure: d.exposure,
          debtor: debtors.find(x => x.document.replace(/\D/g, "") === d.document),
        })),
        today,
      ).map(h => [h.document, h]),
    );
    return debExp.flatMap(d => {
      const h = known.get(d.document) ?? generated.get(d.document);
      return h ? [{ ...h, name: d.name, exposure: d.exposure }] : [];
    });
  }, [shared, debExp, debtors, today]);
  const risk = useMemo(
    () => ({
      cedentQuality: qualityRankings(scopedCedentHistories, qualityPolicy),
      debtorQuality: qualityRankings(debtorHistories, qualityPolicy),
      rollRates: rollRates(scopedCedentHistories),
      vintages: vintages(scopedCedentHistories),
      cedentConcentration: concentration(cedExp.map(c => ({ name: c.name, amount: c.exposure }))),
      debtorConcentration: concentration(debExp.map(d => ({ name: d.name, amount: d.exposure }))),
      collection: collectionMonth(scopedCedentHistories),
      collectionPrevious: collectionMonth(scopedCedentHistories, 1),
      collectionHistory: Array.from({ length: 6 }, (_, index) =>
        collectionMonth(scopedCedentHistories, 5 - index),
      ).filter(month => month.month),
      policy: qualityPolicy,
    }),
    [scopedCedentHistories, debtorHistories, qualityPolicy, cedExp, debExp],
  );

  const automation = useMemo(() => pipelineIndicators(scoped), [scoped]);
  const limitHeadroom = cedExp.reduce(
    (sum, cedent) => sum + Math.max(0, cedent.limit - cedent.usedLimit - cedent.pipeline),
    0,
  );
  const projectedBase = timeline.base.slice(timeline.todayIndex);
  const minimumProjectedValue = Math.min(...projectedBase);
  const minimumProjectedOffset = projectedBase.indexOf(minimumProjectedValue);
  const minimumProjectedIndex = Math.max(0, timeline.todayIndex + minimumProjectedOffset);
  const liquidity = {
    minimumProjectedValue,
    minimumProjectedDate: timeline.dates[minimumProjectedIndex] ?? today,
    fundingGap: Math.max(0, minimumCash - minimumProjectedValue),
    operatingCapacity: Math.max(0, capacity),
  };

  const portfolioHistory = useMemo(() => {
    const months = [...new Set(scopedCedentHistories.flatMap(history => history.months.map(row => row.month)))].sort();
    const bucketDays = [0, 1, 31, 61, 91];
    const raw = months.map(month => {
      const rows = scopedCedentHistories.flatMap(history => history.months.filter(row => row.month === month));
      const settled = rows.reduce((sum, row) => sum + row.settled, 0);
      const onTime = rows.reduce((sum, row) => sum + row.settledOnTime, 0);
      return {
        month,
        balance: rows.reduce((sum, row) => sum + row.openBalance, 0),
        overdue30: rows.reduce((sum, row) => sum + row.overdue30, 0),
        provision: rows.reduce(
          (sum, row) =>
            sum +
            row.buckets.reduce(
              (bucketSum, amount, index) =>
                bucketSum + (amount * provisionRate(bucketDays[index], qualityPolicy.indicators.provisionBands)) / 100,
              0,
            ),
          0,
        ),
        onTimeRate: settled ? (onTime / settled) * 100 : 100,
      };
    });
    const latestBalance = raw[raw.length - 1]?.balance ?? 0;
    const scale = latestBalance > 0 ? portfolioTotal / latestBalance : 1;
    const normalized = raw.map(row => ({
      ...row,
      balance: row.balance * scale,
      overdue30: row.overdue30 * scale,
      provision: row.provision * scale,
    }));
    const latest = normalized[normalized.length - 1];
    if (latest) {
      latest.balance = portfolioTotal;
      latest.overdue30 = titles
        .filter(title => daysFrom(title.dueDate, today) > 30)
        .reduce((sum, title) => sum + title.amount, 0);
      latest.provision = titles.reduce(
        (sum, title) =>
          sum +
          (title.amount * provisionRate(daysFrom(title.dueDate, today), qualityPolicy.indicators.provisionBands)) / 100,
        0,
      );
    }
    return normalized;
  }, [scopedCedentHistories, qualityPolicy, portfolioTotal, titles, today]);
  const portfolioHistoryIsDemo =
    !shared?.cedentHistories || qualityPolicy.name.toLocaleLowerCase("pt-BR").includes("demonstra");

  /* indicadores de mercado da Gestão: originação do período, carteira, provisão e concentração */
  const market = useMemo(() => {
    const periodOps = scoped.filter(op => {
      const d = operationDate(op, today);
      return isLive(op) && d >= win.from && d <= win.to;
    });
    const origination = originationIndicators(periodOps, op => operationDate(op, today));
    const late = (dueDate: string) => daysFrom(dueDate, today);
    const overdueOver = (days: number) => titles.filter(t => late(t.dueDate) > days).reduce((s, t) => s + t.amount, 0);
    const provision = titles.reduce(
      (s, t) => s + (t.amount * provisionRate(late(t.dueDate), qualityPolicy.indicators.provisionBands)) / 100,
      0,
    );
    return {
      origination,
      overdue30: overdueOver(30),
      overdue60: overdueOver(60),
      overdue90: overdueOver(90),
      provision,
    };
  }, [scoped, today, win, titles, qualityPolicy]);
  const economics = useMemo(
    () =>
      financeIndicators(
        finance,
        companyScope,
        win.from,
        win.to,
        market.origination.rate,
        market.origination.fundingCost,
        cur.volume,
        Math.max(0, bankBalance),
      ),
    [finance, companyScope, win, market.origination, cur.volume, bankBalance],
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
    timeline,
    risk,
    market,
    automation,
    economics,
    liquidity,
    limitHeadroom,
    portfolioHistory,
    portfolioHistoryIsDemo,
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
