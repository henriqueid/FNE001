"use client";
/**
 * Faixa de quatro KPIs da visão geral, com um conjunto diferente para cada perfil
 * (Gestão, Operação, Risco e cobrança).
 */
import type { HomeMetrics } from "./use-home-metrics";
import { compact, Delta, int, Kpi, type KpiProps, pct } from "./widgets";

import { homeSettings, type HomeProfile } from "@/src/domain/home/settings";

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
        value: compact(cur.volume),
        delta: <Delta value={cur.volume} previous={prev.volume} label={labels.compare} />,
        progress: { value: volumePct, label: `${pct(volumePct, 0)} da meta de ${compact(target)}` },
      },
      {
        label: "Receita",
        value: compact(cur.revenue),
        delta: <Delta value={cur.revenue} previous={prev.revenue} label={labels.compare} />,
        hint: cur.volume ? `${pct((cur.revenue / cur.volume) * 100, 2)} sobre o volume` : "sem volume no período",
      },
      {
        label: "Taxa média efetiva",
        value: cur.count ? `${pct(cur.rate, 2)} a.m.` : "—",
        delta:
          prev.count && cur.count ? (
            <Delta value={cur.rate} previous={prev.rate} mode="points" label={labels.compare} />
          ) : undefined,
        hint: "Ponderada pelo valor de face",
      },
      {
        label: "Caixa livre",
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
        value: String(cur.count),
        delta: <Delta value={cur.count} previous={prev.count} label={labels.compare} />,
        hint: `${cur.cedents} cedente(s) · ${compact(cur.volume)}`,
      },
      {
        label: "Prontas para liberar",
        value: compact(readyAmount),
        tone: ready.length ? "good" : "",
        hint: `${ready.length} operação(ões) · corte TED ${homeSettings.schedule.tedCutoff}`,
      },
      {
        label: "Intervenções abertas",
        value: String(interventions.length),
        tone: blockedOps.length ? "bad" : "",
        hint: `${blockedOps.length} com bloqueio · ${active.length} em andamento`,
      },
      {
        label: `Liberadas ${labels.range}`,
        value: compact(cur.released),
        hint: `${cur.releasedCount} operação(ões) enviadas ao financeiro`,
      },
    ],
    risco: [
      {
        label: "Carteira em aberto",
        value: compact(portfolioTotal),
        hint: `${int.format(titles.length)} títulos · ${cedExp.length} cedentes`,
      },
      {
        label: "Inadimplência",
        value: pct(overdueRatio, 1),
        tone: overdueRatio > 5 ? "bad" : "",
        hint: `${compact(overdueTotal)} vencidos em ${overdueTitles.length} títulos`,
      },
      {
        label: "Vence nos próximos 5 dias",
        value: compact(agenda.slice(0, 5).reduce((s, d) => s + d.amount, 0)),
        hint: `Hoje ${compact(dueToday.amount)} · ${agenda.slice(0, 5).reduce((s, d) => s + d.count, 0)} título(s)`,
      },
      {
        label: "Maior sacado",
        value: pct(debExp[0]?.share ?? 0),
        tone: (debExp[0]?.share ?? 0) > homeSettings.debtorConcentrationCap ? "bad" : "",
        hint: `${debExp[0]?.name.split(" ").slice(0, 3).join(" ") ?? "—"} · teto ${homeSettings.debtorConcentrationCap}%`,
      },
    ],
  };
}

export function HomeKpis({
  metrics,
  profile,
  onGoOperations,
  onGoFinance,
}: {
  metrics: HomeMetrics;
  profile: HomeProfile;
  onGoOperations: () => void;
  onGoFinance: () => void;
}) {
  // cada indicador abre o módulo de onde vem o número (no perfil Risco os números já são desta tela)
  const target: Record<HomeProfile, (() => void)[]> = {
    gestao: [onGoOperations, onGoOperations, onGoOperations, onGoFinance],
    operacao: [onGoOperations, onGoOperations, onGoOperations, onGoFinance],
    risco: [],
  };
  return (
    <div className="vg-kpis">
      {kpiSets(metrics)[profile].map((kpi, i) => (
        <Kpi key={kpi.label} {...kpi} onOpen={target[profile][i]} />
      ))}
    </div>
  );
}
