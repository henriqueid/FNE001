/**
 * Regras puras da visão geral: montam alertas de risco, pendências, marcos do dia,
 * linhas de cobrança e linhas de concentração a partir dos números já agregados.
 * Sem estado nem React; chamadas a cada render por `use-home-metrics.ts`.
 */
import type { Alert, CollectionRow, Milestone, NeedItem, Row } from "@/src/features/home/sections/index";
import { compact, pct, type Severity, severityOrder } from "./widgets";

import { type Operation } from "@/src/domain/core/types";
import type { FinanceState } from "@/src/domain/finance/model";
import {
  type aging,
  brDate,
  type cedentExposure,
  daysBetween,
  type debtorExposure,
  isSlower,
  type maturityAgenda,
  type portfolioTitles,
  type settlementPending,
  stageName,
  type vehicleExposure,
  type OpFinancial,
} from "@/src/domain/home/metrics";
import { homeSettings, type HomeProfile } from "@/src/domain/home/settings";

export type PortfolioTitle = ReturnType<typeof portfolioTitles>[number];
export type CedentExposure = ReturnType<typeof cedentExposure>[number];
export type DebtorExposure = ReturnType<typeof debtorExposure>[number];
export type VehicleExposure = ReturnType<typeof vehicleExposure>[number];
export type AgendaDay = ReturnType<typeof maturityAgenda>[number];
export type AgingBucket = ReturnType<typeof aging>[number];
export type SettlementPending = ReturnType<typeof settlementPending>;
export type FinanceTitle = FinanceState["titles"][number];

/* alertas de risco: regras sobre carteira, limites e cadastros */
export function buildRiskAlerts({
  cedExp,
  debExp,
  titles,
  active,
  today,
}: {
  cedExp: CedentExposure[];
  debExp: DebtorExposure[];
  titles: PortfolioTitle[];
  active: Operation[];
  today: string;
}): Alert[] {
  const alerts: Alert[] = [];
  const activeOpOf = (doc: string) => active.find(op => op.document === doc);
  cedExp.forEach(c => {
    if (!Number.isNaN(c.used) && c.used >= 75)
      alerts.push({
        id: `lim-${c.document}`,
        severity: c.used >= 90 ? "critical" : "serious",
        title: `${c.name} com ${pct(c.used, 0)} do limite comprometido`,
        detail: `Limite ${compact(c.limit)} · utilizado ${compact(c.usedLimit)}${c.pipeline ? ` + ${compact(c.pipeline)} em operações em andamento` : ""}.`,
        profiles: ["gestao", "operacao", "risco"],
        action: activeOpOf(c.document) ? "Abrir operação" : "Revisar limite",
        op: activeOpOf(c.document),
      });
    const late30 = titles.filter(t => t.ownerDocument === c.document && daysBetween(t.dueDate, today) > 30);
    if (late30.length)
      alerts.push({
        id: `late-${c.document}`,
        severity: "serious",
        title: `${c.name}: ${compact(late30.reduce((s, t) => s + t.amount, 0))} vencidos há mais de 30 dias`,
        detail: `${late30.length} título(s), o mais antigo vencido em ${brDate(late30.map(t => t.dueDate).sort()[0])}. Avaliar recompra ou jurídico.`,
        profiles: ["gestao", "risco"],
        action: activeOpOf(c.document) ? "Abrir operação" : "Ver carteira",
        op: activeOpOf(c.document),
      });
    if (c.incidents > 0)
      alerts.push({
        id: `inc-${c.document}`,
        severity: "watch",
        title: `${c.name} com ${c.incidents} apontamento(s) cadastral(is)`,
        detail: `Score ${c.score ?? "—"}. Revisar antes da próxima compra.`,
        profiles: ["risco"],
        action: "Abrir análise",
        op: activeOpOf(c.document),
      });
  });
  debExp.forEach(d => {
    if (d.share > homeSettings.debtorConcentrationCap)
      alerts.push({
        id: `conc-${d.document}`,
        severity: "serious",
        title: `Sacado ${d.name} concentra ${pct(d.share)} da carteira`,
        detail: `Acima do teto de ${homeSettings.debtorConcentrationCap}% da política.`,
        profiles: ["gestao", "risco"],
        action: "Ver enquadramento",
      });
    if (d.score !== undefined && d.score < 600)
      alerts.push({
        id: `score-${d.document}`,
        severity: "watch",
        title: `Sacado ${d.name} com score ${d.score}`,
        detail: `Exposição de ${compact(d.exposure)}${d.overdue ? `, ${compact(d.overdue)} vencidos` : ""}.`,
        profiles: ["risco", "operacao"],
        action: "Ver sacado",
      });
  });
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts;
}

/* pendências: operações em andamento + carteira, já filtradas pelo perfil e ordenadas por severidade */
export function buildNeeds({
  active,
  fin,
  releasesToPay,
  overduePayables,
  overdueTitles,
  overdueTotal,
  dueToday,
  pend,
  profile,
}: {
  active: Operation[];
  fin: Record<string, OpFinancial>;
  releasesToPay: FinanceTitle[];
  overduePayables: FinanceTitle[];
  overdueTitles: PortfolioTitle[];
  overdueTotal: number;
  dueToday: AgendaDay;
  pend: SettlementPending;
  profile: HomeProfile;
}): NeedItem[] {
  return [
    ...active.flatMap((op): NeedItem[] => {
      if (op.blockers > 0)
        return [
          {
            id: op.id,
            kind: "Decisão",
            severity: "critical",
            title: `${op.cedent}: ${op.nextAction.toLowerCase()}`,
            detail: `Aditivo ${op.aditivoNumber} · ${stageName(op.stage)} · ${op.blockers} bloqueio(s)`,
            amount: op.amount,
            due: op.waitingFor ? `há ${op.waitingFor}` : "",
            action: "Decidir",
            op,
            profiles: ["gestao", "operacao", "risco"],
          },
        ];
      if (op.status === "Pronta para liberar")
        return [
          {
            id: op.id,
            kind: "Liberação",
            severity: "serious",
            title: `Liberar pagamento para ${op.cedent}`,
            detail: `Aditivo ${op.aditivoNumber} · pronta para o financeiro`,
            amount: fin[op.id]?.net || op.netAmount || op.amount,
            due: `Corte TED ${homeSettings.schedule.tedCutoff}`,
            action: "Liberar",
            op,
            profiles: ["gestao", "operacao"],
          },
        ];
      if (op.status === "Pronta para formalizar")
        return [
          {
            id: op.id,
            kind: "Formalização",
            severity: "watch",
            title: `Enviar formalização de ${op.cedent}`,
            detail: `Aditivo ${op.aditivoNumber} · pacote pronto para assinatura`,
            amount: op.amount,
            due: "Hoje",
            action: "Formalizar",
            op,
            profiles: ["operacao"],
          },
        ];
      if (isSlower(op))
        return [
          {
            id: op.id,
            kind: "Ritmo",
            severity: "watch",
            title: `${op.cedent} mais lenta que o padrão`,
            detail: `${stageName(op.stage)} · ${op.nextAction}`,
            amount: op.amount,
            due: `há ${op.waitingFor}`,
            action: "Abrir",
            op,
            profiles: ["operacao", "gestao"],
          },
        ];
      return [];
    }),
    ...(releasesToPay.length
      ? [
          {
            id: "tk-releases",
            kind: "Financeiro",
            severity: "serious" as Severity,
            title: `${releasesToPay.length} pagamento(s) de liberação a fazer`,
            detail: releasesToPay
              .map(t => t.counterparty)
              .slice(0, 3)
              .join(", "),
            amount: releasesToPay.reduce((s, t) => s + t.amount, 0),
            due: `Corte TED ${homeSettings.schedule.tedCutoff}`,
            action: "Pagar",
            go: "finance" as const,
            profiles: ["gestao", "operacao"] as HomeProfile[],
          },
        ]
      : []),
    ...(overduePayables.length
      ? [
          {
            id: "tk-payables",
            kind: "Financeiro",
            severity: "serious" as Severity,
            title: `${overduePayables.length} conta(s) a pagar vencida(s)`,
            detail: overduePayables
              .map(t => t.description)
              .slice(0, 3)
              .join(", "),
            amount: overduePayables.reduce((s, t) => s + t.amount, 0),
            due: `Desde ${brDate(overduePayables.map(t => t.dueDate).sort()[0])}`,
            action: "Ver no financeiro",
            go: "finance" as const,
            profiles: ["gestao", "operacao"] as HomeProfile[],
          },
        ]
      : []),
    ...(overdueTitles.length
      ? [
          {
            id: "tk-overdue",
            kind: "Carteira",
            severity: "serious" as Severity,
            title: `${overdueTitles.length} título(s) vencido(s) sem liquidação`,
            detail: `Mais antigo desde ${brDate(overdueTitles.map(t => t.dueDate).sort()[0])} · acionar cobrança ou recompra`,
            amount: overdueTotal,
            due: "Hoje",
            action: "Ver carteira",
            profiles: ["risco", "gestao"] as HomeProfile[],
          },
        ]
      : []),
    ...(dueToday.count
      ? [
          {
            id: "tk-today",
            kind: "Carteira",
            severity: "watch" as Severity,
            title: `${dueToday.count} título(s) vencem hoje`,
            detail: dueToday.titles
              .map(t => t.debtorName)
              .slice(0, 3)
              .join(", "),
            amount: dueToday.amount,
            due: "Até 17h",
            action: "Acompanhar",
            profiles: ["risco", "operacao"] as HomeProfile[],
          },
        ]
      : []),
    ...(pend.pendingCount
      ? [
          {
            id: "tk-pend",
            kind: "Cedentes",
            severity: "watch" as Severity,
            title: `${pend.pendingCount} pendência(s) de cedentes a cobrar`,
            detail: "Tarifas, custas e despesas em aberto na conta gráfica",
            amount: pend.pendingAmount,
            due: "Próxima operação",
            action: "Ver pendências",
            profiles: ["risco", "operacao"] as HomeProfile[],
          },
        ]
      : []),
    ...(pend.creditCount
      ? [
          {
            id: "tk-cred",
            kind: "Cedentes",
            severity: "info" as Severity,
            title: `${pend.creditCount} crédito(s) de cedentes a devolver ou compensar`,
            detail: "Saldos credores de liquidação e conciliação",
            amount: pend.creditAmount,
            due: "Próxima operação",
            action: "Ver créditos",
            profiles: ["operacao"] as HomeProfile[],
          },
        ]
      : []),
  ]
    .filter(n => n.profiles.includes(profile))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/* marcos do dia: comitê, remessa, corte TED e conciliação com o que falta em cada um */
export function buildMilestones({
  blockedOps,
  fromReleased,
  ready,
  readyAmount,
  dueToday,
  pend,
}: {
  blockedOps: Operation[];
  fromReleased: PortfolioTitle[];
  ready: Operation[];
  readyAmount: number;
  dueToday: AgendaDay;
  pend: SettlementPending;
}): Milestone[] {
  return [
    {
      time: homeSettings.schedule.committee,
      title: "Comitê de crédito",
      detail: blockedOps.length
        ? `${blockedOps.length} operação(ões) com decisão pendente · ${compact(blockedOps.reduce((s, op) => s + op.amount, 0))}`
        : "Nenhuma decisão pendente",
      count: blockedOps.length,
    },
    {
      time: homeSettings.schedule.collectionFile,
      title: "Remessa de cobrança",
      detail: fromReleased.length
        ? `${fromReleased.length} título(s) de operações liberadas para registrar`
        : "Nenhum título novo para registrar",
      count: fromReleased.length,
    },
    {
      time: homeSettings.schedule.tedCutoff,
      title: "Corte de liberação TED",
      detail: ready.length
        ? `${ready.length} operação(ões) · ${compact(readyAmount)} prontos para pagar`
        : "Nenhuma liberação pronta",
      count: ready.length,
    },
    {
      time: homeSettings.schedule.reconciliation,
      title: "Conciliação do dia",
      detail: `${dueToday.count} vencimento(s) de hoje e ${pend.pendingCount + pend.creditCount} ajuste(s) de cedentes`,
      count: dueToday.count + pend.pendingCount + pend.creditCount,
    },
  ];
}

/* carteira e pendências: faixas de atraso agrupadas + conta gráfica dos cedentes */
export function buildCollectionRows(agingBuckets: AgingBucket[], pend: SettlementPending): CollectionRow[] {
  return [
    { label: "A vencer", count: agingBuckets[0].count, amount: agingBuckets[0].amount, tone: "ok", unit: "títulos" },
    {
      label: "Vencidos até 30 dias",
      count: agingBuckets.slice(1, 4).reduce((s, b) => s + b.count, 0),
      amount: agingBuckets.slice(1, 4).reduce((s, b) => s + b.amount, 0),
      tone: "watch",
      unit: "títulos",
    },
    {
      label: "Vencidos há mais de 30 dias",
      count: agingBuckets.slice(4).reduce((s, b) => s + b.count, 0),
      amount: agingBuckets.slice(4).reduce((s, b) => s + b.amount, 0),
      tone: "serious",
      unit: "títulos",
    },
    {
      label: "Pendências de cedentes",
      count: pend.pendingCount,
      amount: pend.pendingAmount,
      tone: "watch",
      unit: "lançamentos",
    },
    {
      label: "Créditos a devolver",
      count: pend.creditCount,
      amount: pend.creditAmount,
      tone: "neutral",
      unit: "lançamentos",
    },
  ];
}

/* linhas da tabela de concentração nas três abas (cedentes, sacados, veículos) */
export function buildConcentrationRows(
  cedExp: CedentExposure[],
  debExp: DebtorExposure[],
  vehExp: VehicleExposure[],
): { cedRows: Row[]; debRows: Row[]; vehRows: Row[] } {
  const cedRows: Row[] = cedExp.map(c => ({
    key: c.document,
    name: c.name,
    extra: `${c.count} título(s)${c.score ? ` · score ${c.score}` : ""}${c.pipeline ? ` · ${compact(c.pipeline)} em andamento` : ""}`,
    exposure: c.exposure,
    share: c.share,
    used: c.used,
    overdue: c.overdue,
  }));
  const debRows: Row[] = debExp.map(d => ({
    key: d.document,
    name: d.name,
    extra: `${d.count} título(s)${d.score ? ` · score ${d.score}` : ""}`,
    exposure: d.exposure,
    share: d.share,
    used: (d.share / homeSettings.debtorConcentrationCap) * 100,
    overdue: d.overdue,
  }));
  const vehTotal = vehExp.reduce((s, v) => s + v.total, 0);
  const vehRows: Row[] = vehExp.map(v => ({
    key: v.name,
    name: v.name,
    extra: `${v.institution} · ${v.count} operação(ões)`,
    exposure: v.total,
    share: vehTotal ? (v.total / vehTotal) * 100 : 0,
    used: v.total ? (v.active / v.total) * 100 : 0,
    overdue: v.blocked,
  }));
  return { cedRows, debRows, vehRows };
}
