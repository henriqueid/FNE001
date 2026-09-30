"use client";

/**
 * Gráficos SVG da Visão geral (originação × ritmo da meta e caixa projetado).
 */
import { homeSettings, periodLabels, type HomePeriod } from "@/src/domain/home/settings";
import { compact, pct, Tip } from "./widgets";
import { ActivityIcon, ArrowIcon } from "@/src/ui/icons";
import { useElementSize } from "@/src/ui/use-element-width";
import { useState } from "react";

export const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
};

export const axisMoney = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0).replace(".", ",")} mi`
    : v >= 1_000
      ? `${Math.round(v / 1_000)} mil`
      : `${Math.round(v)}`;

export function TrendChart({
  values,
  revenue,
  labels,
  future,
  target,
  period,
  onWiderPeriod,
  count,
}: {
  values: number[];
  revenue: number[];
  labels: string[];
  future: boolean[];
  target: number;
  period: HomePeriod;
  onWiderPeriod?: () => void;
  count: number;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>({ width: 640, height: 260 });
  const [hover, setHover] = useState<number | null>(null);
  const empty = values.every(v => v === 0);
  const pace = target / values.length;
  const max = niceMax(Math.max(...values, pace));
  const W = Math.max(300, size.width),
    H = Math.max(240, Math.min(440, size.height || 260)),
    L = 56,
    R = 12,
    T = 22,
    B = 30;
  const band = (W - L - R) / values.length;
  const barW = Math.min(28, band * 0.56);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.5, 1].map(t => t * max);
  const peak = values.indexOf(Math.max(...values));
  if (empty)
    return (
      <div className="vg-chart-empty">
        <ActivityIcon />
        <strong>Nenhuma operação originada {periodLabels[period].range}</strong>
        <span>A meta do período é {compact(target)}. As operações novas aparecem aqui assim que entram.</span>
        {onWiderPeriod && (
          <button className="vg-btn" onClick={onWiderPeriod}>
            Ver o mês
          </button>
        )}
      </div>
    );
  const paceRight = peak < values.length / 2;
  return (
    <div className="vg-trend">
      <div className="vg-chart fill" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label="Volume originado por intervalo contra o ritmo da meta"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 10} y={y(t) + 4} className="tick" textAnchor="end">
                {axisMoney(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = L + band * i + band / 2;
            const h = Math.max(v ? 3 : 0, y(0) - y(v));
            return (
              <g
                key={labels[i]}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${labels[i]}: ${future[i] ? "a realizar" : compact(v)}`}
              >
                <rect x={cx - band / 2} y={T} width={band} height={H - T - B} className="hit" />
                {future[i] ? (
                  <rect x={cx - barW / 2} y={y(0) - 4} width={barW} height={4} rx={2} className="bar future" />
                ) : (
                  v > 0 && (
                    <path
                      d={`M${cx - barW / 2},${y(0)} V${y(0) - h + 4} Q${cx - barW / 2},${y(0) - h} ${cx - barW / 2 + 4},${y(0) - h} H${cx + barW / 2 - 4} Q${cx + barW / 2},${y(0) - h} ${cx + barW / 2},${y(0) - h + 4} V${y(0)} Z`}
                      className={`bar ${hover === i ? "on" : ""}`}
                    />
                  )
                )}
                {i === peak && v > 0 && hover === null && W >= 520 && (
                  <text x={cx} y={y(v) - 8} className="value" textAnchor="middle">
                    {compact(v)}
                  </text>
                )}
                <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                  {labels[i].split(" ")[0]}
                </text>
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={y(pace)} y2={y(pace)} className="pace" />
          <text
            x={paceRight ? W - R : L + 6}
            y={y(pace) - 6}
            className="pace-label"
            textAnchor={paceRight ? "end" : "start"}
          >
            Ritmo da meta · {compact(pace)}
          </text>
        </svg>
        {hover !== null && (
          <Tip x={Math.min(W - 180, L + band * hover + band / 2 + 12)} y={20}>
            <b>{labels[hover]}</b>
            {future[hover] ? (
              <span>A realizar</span>
            ) : (
              <>
                <span>Volume {compact(values[hover])}</span>
                <span>Receita {compact(revenue[hover])}</span>
              </>
            )}
          </Tip>
        )}
      </div>
      <div className="vg-legend">
        <span>
          <i className="sw bar" />
          Volume originado (face)
        </span>
        <span>
          <i className="sw pace" />
          Ritmo necessário para a meta
        </span>
      </div>
      <div className="vg-stats four compact vg-trend-stats">
        <div>
          <small>Originado</small>
          <strong>{compact(values.reduce((a, v) => a + v, 0))}</strong>
          <em>{count} operação(ões)</em>
        </div>
        <div>
          <small>Falta para a meta</small>
          <strong>{compact(Math.max(0, target - values.reduce((a, v) => a + v, 0)))}</strong>
          <em>meta {compact(target)}</em>
        </div>
        <div>
          <small>Ticket médio</small>
          <strong>{count ? compact(values.reduce((a, v) => a + v, 0) / count) : "—"}</strong>
          <em>por operação</em>
        </div>
        <div>
          <small>Melhor intervalo</small>
          <strong>{labels[peak]?.split(" ")[0] ?? "—"}</strong>
          <em>{compact(values[peak] ?? 0)}</em>
        </div>
      </div>
    </div>
  );
}

export function CashChart({
  series,
  capacity,
  outflowToday,
  inflow30,
  balance,
  minimum,
  onGoFinance,
}: {
  series: { base: number[]; conservative: number[]; optimistic: number[] };
  capacity: number;
  outflowToday: number;
  inflow30: number;
  balance: number;
  minimum: number;
  onGoFinance: () => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, size] = useElementSize<HTMLDivElement>({ width: 640, height: 220 });
  const all = [...series.base, ...series.conservative, ...series.optimistic, minimum];
  const max = niceMax(Math.max(...all));
  const min = Math.min(0, Math.min(...all));
  const W = Math.max(300, size.width),
    H = 220,
    L = 56,
    R = 12,
    T = 14,
    B = 28;
  const x = (i: number) => L + (i * (W - L - R)) / 30;
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map(t => min + t * (max - min));
  const i = hover ?? 30;
  return (
    <div className="vg-cash">
      <div className="vg-stats three">
        <div>
          <small>Saldo em bancos</small>
          <strong>{compact(balance)}</strong>
          <em>Saídas previstas hoje {compact(outflowToday)}</em>
        </div>
        <div>
          <small>Capacidade de compra · 7 dias</small>
          <strong className={capacity > 0 ? "good" : "bad"}>{compact(capacity)}</strong>
          <em>Entradas em 30 dias {compact(inflow30)}</em>
        </div>
        <div>
          <small>{hover === null ? "Saldo projetado em 30 dias" : `Saldo projetado no dia +${i}`}</small>
          <strong>{compact(series.base[i])}</strong>
          <em>
            faixa {compact(series.conservative[i])} a {compact(series.optimistic[i])}
          </em>
        </div>
      </div>
      <div className="vg-chart" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label="Projeção de caixa em 30 dias"
          onMouseMove={e => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(30, Math.round((px - L) / ((W - L - R) / 30)))));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 10} y={y(t) + 4} className="tick" textAnchor="end">
                {axisMoney(t)}
              </text>
            </g>
          ))}
          {[0, 7, 14, 21, 30].map(d => (
            <text
              key={d}
              x={x(d)}
              y={H - 8}
              className="tick"
              textAnchor={d === 0 ? "start" : d === 30 ? "end" : "middle"}
            >
              {d === 0 ? "Hoje" : `+${d} dias`}
            </text>
          ))}
          <path
            d={`${path(series.optimistic)} ${series.conservative.map((_, k) => `L${x(30 - k).toFixed(1)},${y(series.conservative[30 - k]).toFixed(1)}`).join(" ")} Z`}
            className="band"
          />
          <line x1={L} x2={W - R} y1={y(minimum)} y2={y(minimum)} className="minimum" />
          <text x={W - R} y={y(minimum) - 6} className="min-label" textAnchor="end">
            Saldo mínimo {compact(minimum)}
          </text>
          <path d={path(series.base)} className="line" />
          <circle cx={x(i)} cy={y(series.base[i])} r={5} className="dot" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />}
        </svg>
      </div>
      <div className="vg-legend">
        <span>
          <i className="sw line" />
          Cenário base ({pct(homeSettings.recovery.base * 100, 0)} dos vencimentos)
        </span>
        <span>
          <i className="sw band" />
          Faixa conservador–otimista
        </span>
        <span>
          <i className="sw min" />
          Saldo mínimo
        </span>
        <button className="vg-link" onClick={onGoFinance}>
          Abrir financeiro <ArrowIcon />
        </button>
      </div>
    </div>
  );
}
