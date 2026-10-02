"use client";

/**
 * Peças visuais do Comercial: avatar, medidor de meta, gráfico de receita × meta e utilitários de formulário.
 */
import { monthLabel, monthShort } from "@/src/domain/commercial/calendar";
import { type repMetrics } from "@/src/domain/commercial/rules";
import { type CommitteeStatus, type SalesRep } from "@/src/domain/commercial/types";
import { compact, money } from "@/src/features/finance/finance-ui";
import { useElementWidth } from "@/src/ui/use-element-width";
import { useState } from "react";

export type Toast = { tone: "success" | "error"; text: string } | null;

export type Period = "mes" | "anterior" | "90d" | "ano" | "custom";

export const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

export const num = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export const inputMoney = (v: number) => (v ? v.toFixed(2).replace(".", ",") : "");

export function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Avatar({ rep, small }: { rep?: SalesRep; small?: boolean }) {
  return (
    <span
      className={`cm-avatar ${small ? "small" : ""} ${rep?.kind === "Agente autônomo" ? "agent" : ""}`}
      title={rep?.name}
    >
      {rep?.initials ?? "?"}
    </span>
  );
}

export function Meter({ value, goalLabel }: { value: number; goalLabel?: string }) {
  const tone = value >= 100 ? "ok" : value >= 80 ? "mid" : "low";
  return (
    <div className="cm-meter" title={goalLabel}>
      <div>
        <i className={tone} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <b>{pct(value)}</b>
    </div>
  );
}

export const committeeTone = (s: CommitteeStatus) =>
  s === "Aprovado" ? "ok" : s === "Aprovado com ressalvas" ? "warn" : s === "Reprovado" ? "bad" : "";

export function RevenueChart({ data }: { data: { month: string; revenue: number; goal: number; partial: boolean }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [svgRef, measured] = useElementWidth<SVGSVGElement>(640);
  const W = Math.max(320, measured),
    H = W > 900 ? 240 : 200,
    P = { l: 56, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.goal))) * 1.1;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
  return (
    <div className="cm-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Receita por mês comparada à meta"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={P.l - 8} y={y(t) + 3} textAnchor="end" className="axis">
              {compact(t).replace("R$ ", "")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          // par de barras finas: meta (cinza) e receita (tinta), como no restante do STRATO
          const thin = Math.max(3, Math.min(6, bw * 0.06)),
            gap = 4,
            cx = P.l + i * bw + bw / 2;
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)}>
              <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" />
              <rect
                x={cx - thin - gap / 2}
                y={y(d.goal)}
                width={thin}
                height={y(0) - y(d.goal)}
                rx={thin / 2}
                className="goal-bar"
              />
              <rect
                x={cx + gap / 2}
                y={y(d.revenue)}
                width={thin}
                height={Math.max(0, y(0) - y(d.revenue))}
                rx={thin / 2}
                className={`bar ${d.partial ? "partial" : ""} ${hover === i ? "hover" : ""}`}
              />
              <text x={cx} y={H - 8} textAnchor="middle" className="axis">
                {monthShort(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="cm-chart-legend">
        <span>
          <i className="sw bar" /> Receita
        </span>
        <span>
          <i className="sw goal-bar" /> Meta
        </span>
        <span>
          <i className="sw partial" /> Mês em andamento
        </span>
      </div>
      {hover !== null && (
        <div className="cm-tip" style={{ left: `${((P.l + (hover + 0.5) * bw) / W) * 100}%` }}>
          <b>{monthLabel(data[hover].month)}</b>
          <span>Receita {money(data[hover].revenue)}</span>
          <span>Meta {money(data[hover].goal)}</span>
          <span>{pct(data[hover].goal ? (data[hover].revenue / data[hover].goal) * 100 : 0)} da meta</span>
        </div>
      )}
    </div>
  );
}

export type Metrics = ReturnType<typeof repMetrics>;
