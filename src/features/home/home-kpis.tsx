"use client";
/**
 * Faixa de quatro KPIs da visão geral, com um conjunto diferente para cada perfil
 * (Gestão, Operação, Risco e cobrança).
 */
import type { HomeMetrics } from "./use-home-metrics";
import { compact, Delta, int, Kpi, type KpiProps, pct } from "./widgets";

import { homeSettings, type HomeProfile } from "@/src/domain/home/settings";
import { ActivityIcon, AlertIcon, CheckIcon, ClockIcon, ShieldIcon, SparkIcon, WalletIcon } from "@/src/ui/icons";

function kpiSets({
  labels,
  cur,
  prev,
  target,
  volumePct,
  freeCash,
  bankBalance,
  minimumCash,
  readyAmount,
  ready,
  interventions,
  blockedOps,
  active,
  portfolioTotal,
  titles,
  cedExp,
  overdueRatio,
  overdueTotal,
  overdueTitles,
  agenda,
  dueToday,
  debExp,
}: HomeMetrics): Record<HomeProfile, KpiProps[]> {
  return {
    gestao: [
      {
        label: "Volume originado",
        icon: <ActivityIcon />,
        value: compact(cur.volume),
        delta: <Delta value={cur.volume} previous={prev.volume} label={labels.compare} />,
        progress: { value: volumePct, label: `${pct(volumePct, 0)} da meta de ${compact(target)}` },
      },
      {
        label: "Receita",
        icon: <SparkIcon />,
        value: compact(cur.revenue),
        delta: <Delta value={cur.revenue} previous={prev.revenue} label={labels.compare} />,
        hint: cur.volume ? `${pct((cur.revenue / cur.volume) * 100, 2)} sobre o volume` : "sem volume no período",
      },
      {
        label: "Taxa média efetiva",
        icon: <ClockIcon />,
        value: cur.count ? `${pct(cur.rate, 2)} a.m.` : "—",
        delta:
          prev.count && cur.count ? (
            <Delta value={cur.rate} previous={prev.rate} mode="points" label={labels.compare} />
          ) : undefined,
        hint: "Ponderada pelo valor de face",
      },
      {
        label: "Caixa livre",
        icon: <WalletIcon />,
        value: compact(freeCash),
        hint: `Saldo ${compact(bankBalance)} − mínimo ${compact(minimumCash)}`,
        progress: {
          value: readyAmount ? Math.min(100, (freeCash / readyAmount) * 25) : 100,
          label: readyAmount
            ? `Cobre ${(freeCash / readyAmount).toFixed(1).replace(".", ",")}× as liberações prontas`
            : "Sem liberações prontas",
          tone: freeCash < readyAmount ? "bad" : "good",
        },
      },
    ],
    operacao: [
      {
        label: `Operações ${labels.range}`,
        icon: <ActivityIcon />,
        value: String(cur.count),
        delta: <Delta value={cur.count} previous={prev.count} label={labels.compare} />,
        hint: `${cur.cedents} cedente(s) · ${compact(cur.volume)}`,
      },
      {
        label: "Prontas para liberar",
        icon: <CheckIcon />,
        value: compact(readyAmount),
        tone: ready.length ? "good" : "",
        hint: `${ready.length} operação(ões) · corte TED ${homeSettings.schedule.tedCutoff}`,
      },
      {
        label: "Intervenções abertas",
        icon: <AlertIcon />,
        value: String(interventions.length),
        tone: blockedOps.length ? "bad" : "",
        hint: `${blockedOps.length} com bloqueio · ${active.length} em andamento`,
      },
      {
        label: `Liberadas ${labels.range}`,
        icon: <WalletIcon />,
        value: compact(cur.released),
        hint: `${cur.releasedCount} operação(ões) enviadas ao financeiro`,
      },
    ],
    risco: [
      {
        label: "Carteira em aberto",
        icon: <WalletIcon />,
        value: compact(portfolioTotal),
        hint: `${int.format(titles.length)} títulos · ${cedExp.length} cedentes`,
      },
      {
        label: "Inadimplência",
        icon: <AlertIcon />,
        value: pct(overdueRatio, 1),
        tone: overdueRatio > 5 ? "bad" : "",
        hint: `${compact(overdueTotal)} vencidos em ${overdueTitles.length} títulos`,
      },
      {
        label: "Vence nos próximos 5 dias",
        icon: <ClockIcon />,
        value: compact(agenda.slice(0, 5).reduce((s, d) => s + d.amount, 0)),
        hint: `Hoje ${compact(dueToday.amount)} · ${agenda.slice(0, 5).reduce((s, d) => s + d.count, 0)} título(s)`,
      },
      {
        label: "Maior sacado",
        icon: <ShieldIcon />,
        value: pct(debExp[0]?.share ?? 0),
        tone: (debExp[0]?.share ?? 0) > homeSettings.debtorConcentrationCap ? "bad" : "",
        hint: `${debExp[0]?.name.split(" ").slice(0, 3).join(" ") ?? "—"} · teto ${homeSettings.debtorConcentrationCap}%`,
      },
    ],
  };
}

export function HomeKpis({ metrics, profile }: { metrics: HomeMetrics; profile: HomeProfile }) {
  return (
    <div className="vg-kpis">
      {kpiSets(metrics)[profile].map(kpi => (
        <Kpi key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
