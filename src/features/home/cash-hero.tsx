"use client";
/**
 * Bloco principal da Visão geral: saldo em bancos hoje em número grande e a linha do tempo
 * (30 dias realizados + 60 projetados). Em cima, as linhas de saldo dos cenários; embaixo,
 * barras finas de entradas (para cima) e saídas (para baixo) por dia. A queda de hoje
 * (liberações prontas e em formalização) vem marcada. Régua para escolher o intervalo e
 * cartão com entradas, saídas e variação do intervalo.
 */
import { type PointerEvent as ReactPointerEvent, type KeyboardEvent, useRef, useState } from "react";
import { axisMoney, niceMax } from "./charts";
import { compact, IconSquare, TextTabs } from "./widgets";
import { ExpandIcon } from "@/src/ui/icons";
import { useElementSize } from "@/src/ui/use-element-width";

type Scenario = "base" | "conservative" | "optimistic";
type Horizon = "7" | "30" | "60";

export type CashTimeline = {
  dates: string[];
  todayIndex: number;
  base: number[];
  conservative: number[];
  optimistic: number[];
  inflow: number[];
  outflow: number[];
  readyOut: number;
  formalizationOut: number;
};

const scenarioLabel: Record<Scenario, string> = {
  base: "Cenário base",
  conservative: "Conservador",
  optimistic: "Otimista",
};

const wholeMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const monthShort = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/** Caminho suave (Catmull-Rom → Bézier) pelos pontos. */
function smooth(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function CashHero({
  timeline,
  balance,
  minimum,
  onGoFinance,
}: {
  timeline: CashTimeline;
  balance: number;
  minimum: number;
  onGoFinance: () => void;
}) {
  const t = timeline;
  const n = t.dates.length;
  const today = Math.max(0, t.todayIndex);
  const [scenario, setScenario] = useState<Scenario>("base");
  const [horizon, setHorizon] = useState<Horizon>("30");
  const [range, setRange] = useState<[number, number]>([today, Math.min(n - 1, today + 30)]);
  const [hover, setHover] = useState<number | null>(null);
  const [chartRef, size] = useElementSize<HTMLDivElement>({ width: 1100, height: 300 });
  const drag = useRef<{ mode: "start" | "end" | "move"; origin: number; from: [number, number] } | null>(null);

  const series = t[scenario];
  const W = Math.max(320, size.width),
    H = 320,
    R = 58,
    T = 18,
    B = 30,
    L = 0;
  // zona das linhas (saldo) em cima e zona das barras (entradas/saídas) embaixo
  const lineBottom = T + (H - T - B) * 0.64;
  const flowTop = lineBottom + 18,
    flowBase = flowTop + (H - B - flowTop) * 0.62,
    flowBottom = H - B - 2;
  const band = (W - L - R) / n;
  const barW = Math.max(1.4, Math.min(5, band * 0.42));
  const data = [...t.base, ...t.conservative.slice(today), ...t.optimistic.slice(today)];
  // o saldo mínimo só entra na escala quando está perto dos dados; senão as barras ficariam achatadas
  const showMinimum = minimum >= Math.min(...data) * 0.8;
  const all = showMinimum ? [...data, minimum] : data;
  const top = niceMax(Math.max(...all) * 1.02);
  const low = Math.max(0, Math.min(...all) * 0.9);
  const step = niceMax((top - low) / 4);
  const floor = Math.floor(low / step) * step;
  const y = (v: number) => T + (1 - (v - floor) / (top - floor)) * (lineBottom - T);
  const flowMax = niceMax(Math.max(1, ...t.inflow, ...t.outflow));
  const up = (v: number) => (v / flowMax) * (flowBase - flowTop);
  const down = (v: number) => Math.min(flowBottom - flowBase - 1, (v / flowMax) * (flowBase - flowTop));
  const x = (i: number) => L + band * i + band / 2;
  const ticks: number[] = [];
  for (let v = floor; v <= top + step / 2; v += step) ticks.push(v);
  const [a, b] = range;
  const end = hover ?? b;
  const endChange = series[today] ? ((series[end] - series[today]) / series[today]) * 100 : 0;
  const inflow = t.inflow.slice(a, b + 1).reduce((s, v) => s + v, 0);
  const outflow = t.outflow.slice(a, b + 1).reduce((s, v) => s + v, 0);
  const change = series[a] ? ((series[b] - series[a]) / series[a]) * 100 : 0;

  const chooseHorizon = (h: Horizon) => {
    setHorizon(h);
    setRange([today, Math.min(n - 1, today + Number(h))]);
  };

  /* régua de seleção */
  const BW = W - R;
  const bx = (i: number) => (i / (n - 1)) * BW;
  const indexAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, Math.min(r.width, BW)))) * (n - 1));
  };
  const onBrushDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const i = indexAt(e.clientX, e.currentTarget);
    const near = (k: number) => Math.abs(bx(k) - bx(i)) <= Math.max(10, band);
    const mode = near(a) ? "start" : near(b) ? "end" : i > a && i < b ? "move" : null;
    if (!mode) {
      const half = Math.round((b - a) / 2);
      const s = Math.max(0, Math.min(n - 1 - (b - a), i - half));
      setRange([s, s + (b - a)]);
      return;
    }
    drag.current = { mode, origin: i, from: [a, b] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBrushMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const i = indexAt(e.clientX, e.currentTarget);
    const [s, f] = d.from;
    if (d.mode === "start") setRange([Math.min(i, f - 1), f]);
    else if (d.mode === "end") setRange([s, Math.max(i, s + 1)]);
    else {
      const delta = Math.max(-s, Math.min(n - 1 - f, i - d.origin));
      setRange([s + delta, f + delta]);
    }
  };
  const handleKey = (edge: 0 | 1) => (e: KeyboardEvent<SVGGElement>) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    setRange(([s, f]) =>
      edge === 0 ? [Math.max(0, Math.min(f - 1, s + dir)), f] : [s, Math.min(n - 1, Math.max(s + 1, f + dir))],
    );
  };

  // rótulos do eixo X: início de cada mês e "Hoje"
  const xLabels = t.dates
    .map((d, i) => ({
      i,
      text: i === today ? "Hoje" : d.endsWith("-01") && Math.abs(i - today) > 4 ? monthShort(d) : "",
    }))
    .filter(l => l.text);

  const calloutIndex = hover ?? b;
  const calloutLeft = Math.min(W - R - 230, Math.max(0, x(calloutIndex) + 14));
  const calloutTop = Math.max(4, y(Math.max(series[calloutIndex], t.optimistic[calloutIndex] ?? 0)) - 86);
  // marcação da queda de hoje (liberações) e de D+2 (formalização)
  const marks = [
    { value: t.readyOut, label: "liberações prontas (hoje)" },
    { value: t.formalizationOut, label: "em formalização (D+2)" },
  ].filter(m => m.value > 0);
  const markX = x(Math.min(n - 1, today + 2)) + 10;
  const markY = y(Math.min(...series.slice(today, today + 3))) + 34;

  return (
    <section className="lx-hero" aria-label="Caixa realizado e projetado">
      <div className="lx-hero-top">
        <div className="lx-hero-left">
          <span className="lx-label">Caixa · realizado e projetado</span>
          <div className="lx-radios" role="radiogroup" aria-label="Cenário de recebimento da carteira">
            {(Object.keys(scenarioLabel) as Scenario[]).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scenario === s}
                className={scenario === s ? "on" : ""}
                onClick={() => setScenario(s)}
              >
                <i />
                {scenarioLabel[s]}
              </button>
            ))}
            <span className="lx-radio-static" title={showMinimum ? undefined : "Abaixo da escala do gráfico"}>
              <i />
              Saldo mínimo {compact(minimum)}
            </span>
          </div>
        </div>
        <div className="lx-hero-figure">
          <strong>{wholeMoney.format(balance)}</strong>
          <small>Saldo em bancos hoje</small>
          <span className="lx-hero-sub">
            {end < today ? "Saldo em" : end === today ? "Hoje, após liberações:" : "Projetado em"} {ddmm(t.dates[end])}
            {end > today ? ` (${scenarioLabel[scenario].toLowerCase()})` : ""} <b>{compact(series[end])}</b>
            {end !== today && (
              <em className={endChange >= 0 ? "up" : "down"} title="Variação em relação a hoje">
                {endChange >= 0 ? "+" : "−"}
                {Math.abs(endChange).toFixed(1).replace(".", ",")}% vs. hoje
              </em>
            )}
          </span>
        </div>
        <div className="lx-hero-right">
          <div className="lx-squares">
            <IconSquare label="Abrir financeiro" icon={<ExpandIcon />} onClick={onGoFinance} />
          </div>
          <TextTabs
            label="Horizonte"
            value={horizon}
            onChange={chooseHorizon}
            options={[
              { id: "7", label: "Semana" },
              { id: "30", label: "Mês" },
              { id: "60", label: "Bimestre" },
            ]}
          />
        </div>
      </div>

      <div className="lx-hero-chart" ref={chartRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`Saldo diário de ${ddmm(t.dates[0])} a ${ddmm(t.dates[n - 1])}, ${scenarioLabel[scenario].toLowerCase()}`}
          onMouseMove={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            if (px > W - R) return setHover(null);
            setHover(Math.max(0, Math.min(n - 1, Math.floor((px - L) / band))));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map(v => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
              <text x={W - 4} y={y(v) + 4} textAnchor="end" className="tick">
                {axisMoney(v)}
              </text>
            </g>
          ))}
          {b > a && (
            <rect x={x(a) - band / 2} y={T} width={x(b) - x(a) + band} height={flowBottom - T} className="sel" />
          )}
          <line x1={L} x2={W - R} y1={flowBase} y2={flowBase} className="base" />
          {t.dates.map((d, i) => {
            const cls = `${i >= a && i <= b ? " on" : ""}${i < today ? " past" : ""}${hover === i ? " hover" : ""}`;
            const hIn = Math.max(2, up(t.inflow[i]));
            const hOut = down(t.outflow[i]);
            return (
              <g key={d}>
                <rect x={x(i) - barW / 2} y={flowBase - hIn} width={barW} height={hIn} className={`bar in${cls}`} />
                {hOut > 0 && (
                  <rect x={x(i) - barW / 2} y={flowBase + 1} width={barW} height={hOut} className={`bar out${cls}`} />
                )}
              </g>
            );
          })}
          <path
            d={smooth(t.optimistic.slice(today).map((v, k) => [x(today + k), y(v)]))}
            className={`ln alt${scenario === "optimistic" ? " lead" : ""}`}
          />
          <path
            d={smooth(t.conservative.slice(today).map((v, k) => [x(today + k), y(v)]))}
            className={`ln alt${scenario === "conservative" ? " lead" : ""}`}
          />
          <path
            d={smooth(t.base.map((v, i) => [x(i), y(v)]))}
            className={`ln main${scenario === "base" ? " lead" : ""}`}
          />
          {showMinimum && <line x1={L} x2={W - R} y1={y(minimum)} y2={y(minimum)} className="min" />}
          <text x={W - 4} y={flowBase - up(flowMax) + 10} textAnchor="end" className="tick flow-label">
            entradas
          </text>
          <text x={W - 4} y={flowBase + 14} textAnchor="end" className="tick flow-label">
            saídas
          </text>
          <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} className="today" />
          {marks.length > 0 && (
            <g className="mark">
              <line x1={x(today) + 3} x2={markX - 4} y1={markY - 14} y2={markY - 4} />
              {marks.map((m, k) => (
                <text key={m.label} x={markX} y={markY + k * 15}>
                  −{compact(m.value)} {m.label}
                </text>
              ))}
            </g>
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />}
          {xLabels.map(l => (
            <text key={l.i} x={x(l.i)} y={H - 8} textAnchor="middle" className="tick">
              {l.text}
            </text>
          ))}
        </svg>
        <div className="lx-callout" style={{ left: calloutLeft, top: calloutTop }} role="status">
          {hover === null ? (
            <>
              <div>
                <b>{compact(inflow)}</b>
                <span className={`lx-pill ${change >= 0 ? "up" : "down"}`}>
                  {change >= 0 ? "+" : "−"}
                  {Math.abs(change).toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <small>
                entradas de {ddmm(t.dates[a])} a {ddmm(t.dates[b])} · saídas {compact(outflow)} · % = variação do saldo
                no intervalo
              </small>
            </>
          ) : (
            <>
              <div>
                <b>{compact(series[hover])}</b>
                <span className="lx-pill neutral">{ddmm(t.dates[hover])}</span>
              </div>
              <small>
                entradas {compact(t.inflow[hover])} · saídas {compact(t.outflow[hover])}
              </small>
            </>
          )}
        </div>
      </div>

      <svg
        className="lx-brush"
        viewBox={`0 0 ${W} 36`}
        width={W}
        height={36}
        onPointerDown={onBrushDown}
        onPointerMove={onBrushMove}
        onPointerUp={() => (drag.current = null)}
        aria-label="Régua de seleção do intervalo"
      >
        <rect x={0} y={4} width={BW} height={28} rx={8} className="track" />
        <path
          d={`M0,32 ${series.map((v, i) => `L${bx(i).toFixed(1)},${(32 - ((v - floor) / (top - floor)) * 24).toFixed(1)}`).join(" ")} L${BW},32 Z`}
          className="mini"
        />
        <rect x={bx(a)} y={4} width={Math.max(2, bx(b) - bx(a))} height={28} className="window" />
        {([a, b] as const).map((k, edge) => (
          <g
            key={edge}
            role="slider"
            tabIndex={0}
            aria-label={edge === 0 ? "Início do intervalo" : "Fim do intervalo"}
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={k}
            aria-valuetext={ddmm(t.dates[k])}
            onKeyDown={handleKey(edge as 0 | 1)}
            className="handle"
          >
            <rect x={bx(k) - 6} y={4} width={12} height={28} className="hit" />
            <line x1={bx(k)} x2={bx(k)} y1={10} y2={26} />
          </g>
        ))}
      </svg>
    </section>
  );
}
