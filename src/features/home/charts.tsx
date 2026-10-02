"use client";

/**
 * Gráfico SVG de originação × ritmo da meta e escalas compartilhadas com o bloco de caixa.
 */
import { periodLabels, type HomePeriod } from "@/src/domain/home/settings";
import { compact, DotLegend, Tip } from "./widgets";
import { ActivityIcon } from "@/src/ui/icons";
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
  const thin = Math.max(2, Math.min(5, band * 0.16));
  const gap = Math.max(2, Math.min(6, band * 0.12));
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
                {/* par de barras finas: ritmo da meta (cinza) e realizado (tinta) */}
                <rect
                  x={cx - thin - gap / 2}
                  y={y(pace)}
                  width={thin}
                  height={y(0) - y(pace)}
                  rx={thin / 2}
                  className={`bar pace-bar${future[i] ? " future" : ""}`}
                />
                {!future[i] && (
                  <rect
                    x={cx + gap / 2}
                    y={y(0) - h}
                    width={thin}
                    height={h}
                    rx={thin / 2}
                    className={`bar${hover === i ? " on" : ""}`}
                  />
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
      <DotLegend
        items={[
          { label: "Originado (face)", tone: "ink" },
          { label: `Ritmo da meta · ${compact(pace)} por intervalo`, tone: "gray" },
        ]}
      />
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
