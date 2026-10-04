"use client";

/**
 * Camadas de decisão da Visão Geral. Reúnem números que antes ficavam espalhados
 * entre Operações, Financeiro e Risco, sem duplicar as telas de detalhe.
 */
import type { HomeMetrics } from "@/src/features/home/use-home-metrics";
import { axisMoney, niceMax } from "@/src/features/home/charts";
import { compact, pct } from "@/src/features/home/widgets";
import { fmtMinutes, fmtPct, IndicatorGrid } from "@/src/features/indicators/indicator-grid";

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

export function ManagementIntelligence({ metrics }: { metrics: HomeMetrics }) {
  const { economics, liquidity, market, risk, limitHeadroom, portfolioTotal } = metrics;
  const adjustedResult = economics.result - market.provision;
  const worseningShare = portfolioTotal ? (risk.cedentQuality.worseningExposure / portfolioTotal) * 100 : 0;

  return (
    <IndicatorGrid
      items={[
        {
          label: "Resultado líquido",
          value: compact(economics.result),
          caption: economics.revenue ? `margem ${fmtPct(economics.margin)}` : "sem receita reconhecida no período",
          tone: economics.result < 0 ? "bad" : economics.result > 0 ? "good" : "",
          source: "Receitas menos despesas reconhecidas no DRE gerencial do período",
        },
        {
          label: "Resultado após PDD",
          value: compact(adjustedResult),
          caption: `resultado ${compact(economics.result)} − PDD ${compact(market.provision)}`,
          tone: adjustedResult < 0 ? "bad" : adjustedResult > 0 ? "good" : "",
          source: "Resultado gerencial do período menos a provisão estimada da carteira na posição atual",
        },
        {
          label: "Capacidade operacional",
          value: compact(liquidity.operatingCapacity),
          caption: "antes de atingir o caixa mínimo nos próximos 7 dias",
          tone: liquidity.operatingCapacity > 0 ? "good" : "bad",
          source: "Menor saldo do cenário base em 7 dias menos o caixa mínimo configurado",
        },
        {
          label: "Menor saldo projetado",
          value: compact(liquidity.minimumProjectedValue),
          caption: `em ${liquidity.minimumProjectedDate.slice(8, 10)}/${liquidity.minimumProjectedDate.slice(5, 7)}`,
          tone: liquidity.fundingGap > 0 ? "bad" : "",
          source: "Menor fechamento diário do cenário-base projetado para os próximos 60 dias",
        },
        {
          label: "Necessidade de funding",
          value: liquidity.fundingGap ? compact(liquidity.fundingGap) : "Sem déficit",
          caption: "contra o caixa mínimo configurado",
          tone: liquidity.fundingGap > 0 ? "bad" : "good",
          source: "Diferença negativa entre o menor saldo projetado e o caixa mínimo",
        },
        {
          label: "Limite disponível",
          value: compact(limitHeadroom),
          caption: "cedentes com limite cadastrado, após operações em andamento",
          source: "Soma do limite menos utilizado e pipeline de cada cedente, sem valores negativos",
        },
        {
          label: "Exposição deteriorando",
          value: compact(risk.cedentQuality.worseningExposure),
          caption: `${fmtPct(worseningShare)} da carteira em cedentes piorando`,
          tone: risk.cedentQuality.worseningExposure > 0 ? "bad" : "good",
          source: "Exposição atual dos cedentes cujo score interno piorou acima do corte da política",
        },
        {
          label: "Giro sobre saldo",
          value: `${economics.turnover.toFixed(2).replace(".", ",")}×`,
          caption: "volume comprado ÷ saldo bancário atual",
          source: "Volume originado no período dividido pelo saldo bancário atual; leitura operacional",
        },
      ]}
    />
  );
}

export function AutomationIntelligence({ metrics }: { metrics: HomeMetrics }) {
  const p = metrics.automation;
  const decided = p.approvedExceptions + p.rejectedExceptions;
  const leadingStop = p.topStops[0];
  return (
    <>
      <IndicatorGrid
        items={[
          {
            label: "Sem intervenção",
            value: fmtPct(p.untouchedRate),
            caption: `${p.activeCount} operação(ões) em andamento`,
            tone: p.untouchedRate >= 70 ? "good" : p.activeCount ? "bad" : "",
            source: "Operações em andamento sem bloqueios e com no máximo um alerta relevante",
          },
          {
            label: "Entrada até disponibilidade",
            value: p.availabilitySamples ? fmtMinutes(p.availabilityMinutes) : "Coleta iniciada",
            caption: p.availabilitySamples
              ? `${p.availabilitySamples} operação(ões) com ciclo completo`
              : "novas operações passam a registrar o ciclo completo",
            source: "Tempo entre a entrada técnica da operação e seu envio ao financeiro",
          },
          {
            label: "Tempo atual da esteira",
            value: p.cycleMinutes ? fmtMinutes(p.cycleMinutes) : "—",
            caption: p.standardMinutes
              ? `padrão dos clientes ${fmtMinutes(p.standardMinutes)} · cobertura ${fmtPct(p.cycleCoverage, 0)}`
              : "coletando histórico para o ciclo completo",
            tone: p.standardMinutes && p.cycleMinutes > p.standardMinutes ? "bad" : "",
            source: "Tempo médio na etapa atual das operações com histórico comparável",
          },
          {
            label: "Conversão até liberar",
            value: fmtPct(p.conversion),
            caption: `${p.releasedCount} liberada(s) · ${p.cancelledCount} cancelada(s)`,
            source: "Operações liberadas ao financeiro divididas pelas operações não canceladas",
          },
          {
            label: "Operações com exceção",
            value: fmtPct(p.exceptionRate),
            caption: `${p.exceptionOperations} de ${p.evaluatedOperations} operação(ões) avaliadas`,
            tone: p.exceptionOperations ? "bad" : "good",
            source: "Operações com ao menos uma regra em Exceção ou Reprovado no motor",
          },
          {
            label: "Exceções decididas",
            value: String(decided),
            caption: `${p.approvedExceptions} aprovada(s) · ${p.rejectedExceptions} rejeitada(s)`,
            source: "Overrides e rejeições humanas registrados sobre exceções do motor",
          },
          {
            label: "Regras executadas",
            value: String(p.evaluations),
            caption: leadingStop ? `principal parada: ${leadingStop.rule}` : "nenhuma regra impeditiva registrada",
            source: "Avaliações congeladas do Motor Universal de Elegibilidade nas operações",
          },
        ]}
        columns={4}
      />
      {p.topStops.length > 0 && (
        <div className="vg-stop-rules">
          <span>Regras que mais interrompem o fluxo</span>
          {p.topStops.slice(0, 3).map(stop => (
            <div key={stop.rule}>
              <b>{stop.rule}</b>
              <small>
                {stop.operations} operação(ões) · {stop.count} ocorrência(s)
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function PortfolioEvolution({ rows }: { rows: HomeMetrics["portfolioHistory"] }) {
  if (rows.length < 2)
    return <p className="vg-history-empty">Histórico mensal ainda insuficiente para comparar a carteira.</p>;
  const W = 920;
  const H = 250;
  const L = 62;
  const R = 22;
  const T = 20;
  const B = 34;
  const max = niceMax(Math.max(...rows.flatMap(row => [row.balance, row.overdue30, row.provision]), 1));
  const x = (index: number) => L + (index / Math.max(1, rows.length - 1)) * (W - L - R);
  const y = (value: number) => T + (1 - value / max) * (H - T - B);
  const path = (pick: (row: (typeof rows)[number]) => number) =>
    rows.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(pick(row)).toFixed(1)}`).join(" ");
  const latest = rows[rows.length - 1];
  const overdueRate = latest.balance ? (latest.overdue30 / latest.balance) * 100 : 0;

  return (
    <div className="vg-portfolio-history">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Evolução mensal da carteira, vencido acima de 30 dias e PDD"
      >
        {[0, 0.5, 1].map(tick => (
          <g key={tick}>
            <line x1={L} x2={W - R} y1={y(tick * max)} y2={y(tick * max)} className="grid" />
            <text x={L - 10} y={y(tick * max) + 4} textAnchor="end" className="tick">
              {axisMoney(tick * max)}
            </text>
          </g>
        ))}
        <path d={path(row => row.balance)} className="history-line balance" />
        <path d={path(row => row.overdue30)} className="history-line overdue" />
        <path d={path(row => row.provision)} className="history-line provision" />
        {rows.map((row, index) => (
          <g key={row.month}>
            <title>{`${monthName(row.month)}: carteira ${compact(row.balance)}, vencido >30 ${compact(row.overdue30)}, PDD ${compact(row.provision)}, liquidez ${pct(row.onTimeRate)}`}</title>
            <circle cx={x(index)} cy={y(row.balance)} r="4" className="history-point balance" />
            <circle cx={x(index)} cy={y(row.overdue30)} r="3" className="history-point overdue" />
            <circle cx={x(index)} cy={y(row.provision)} r="3" className="history-point provision" />
            <text x={x(index)} y={H - 8} textAnchor="middle" className="tick">
              {monthName(row.month)}
            </text>
          </g>
        ))}
      </svg>
      <div className="vg-history-summary">
        <span>
          <i className="balance" /> Carteira <b>{compact(latest.balance)}</b>
        </span>
        <span>
          <i className="overdue" /> Vencido &gt; 30{" "}
          <b>
            {compact(latest.overdue30)} · {fmtPct(overdueRate)}
          </b>
        </span>
        <span>
          <i className="provision" /> PDD <b>{compact(latest.provision)}</b>
        </span>
        <span>
          Liquidez no prazo <b>{fmtPct(latest.onTimeRate)}</b>
        </span>
      </div>
    </div>
  );
}
