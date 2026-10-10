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
  positionDay,
  previousPositionDay,
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
  market,
  risk,
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
        label: "Receita na posição",
        value: compact(positionDay.revenue),
        delta: <Delta value={positionDay.revenue} previous={previousPositionDay.revenue} label="vs. dia anterior" />,
        hint: `${pct(positionDay.volume ? (positionDay.revenue / positionDay.volume) * 100 : 0, 2)} sobre o volume`,
      },
      {
        label: "Operações na posição",
        value: String(positionDay.count),
        delta: <Delta value={positionDay.count} previous={previousPositionDay.count} label="vs. dia anterior" />,
        hint: `${positionDay.cedents} cedente(s) · ${compact(positionDay.volume)}`,
      },
      {
        label: "Prontas para liberar",
        value: compact(readyAmount),
        tone: ready.length ? "good" : "",
        hint: `${ready.length} operação(ões) · corte TED ${homeSettings.schedule.tedCutoff}`,
      },
      {
        label: "Ritmo operacional",
        value: blockedOps.length ? `${blockedOps.length} bloqueada(s)` : `${active.length} em andamento`,
        tone: blockedOps.length ? "bad" : "good",
        hint: `${interventions.length} intervenção(ões) aberta(s)`,
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
        label: "PDD estimada",
        value: compact(market.provision),
        hint: `Vencido > 30: ${compact(market.overdue30)} · > 90: ${compact(market.overdue90)}`,
      },
      {
        label: "Cedentes piorando",
        value: String(risk.cedentQuality.worsening.length),
        tone: risk.cedentQuality.worsening.length ? "bad" : "",
        hint: `${compact(risk.cedentQuality.worseningExposure)} em exposição · ${risk.cedentQuality.improving.length} melhorando`,
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
