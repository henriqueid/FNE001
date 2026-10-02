"use client";
/**
 * Inadimplência por safra: para cada mês de aquisição, % do valor comprado vencido há mais
 * de 30 dias conforme os meses passam. A safra mais recente fica em tinta; as anteriores, em cinza.
 */
import { type vintages } from "@/src/domain/risk/portfolio-dynamics";
import { compact, DotLegend, pct } from "@/src/features/home/widgets";

const monthName = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

export function VintageChart({ rows }: { rows: ReturnType<typeof vintages> }) {
  const cohorts = rows.filter(r => r.curve.length > 0);
  const maxMob = Math.max(1, ...cohorts.map(c => c.curve.length));
  const maxY = Math.max(1, ...cohorts.flatMap(c => c.curve)) * 1.15;
  const W = 520,
    H = 200,
    L = 34,
    R = 64,
    T = 10,
    B = 24;
  const x = (k: number) => L + (k / Math.max(1, maxMob - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);
  const newest = cohorts[cohorts.length - 1];
  return (
    <div className="lx-vintage">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Vencido há mais de 30 dias por safra e meses desde a aquisição"
      >
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t * maxY)} y2={y(t * maxY)} className="grid" />
            <text x={L - 6} y={y(t * maxY) + 4} textAnchor="end" className="tick">
              {pct(t * maxY, 0)}
            </text>
          </g>
        ))}
        {Array.from({ length: maxMob }, (_, k) => (
          <text key={k} x={x(k)} y={H - 6} textAnchor="middle" className="tick">
            M+{k + 1}
          </text>
        ))}
        {cohorts.map(c => {
          const lead = c === newest;
          const d = c.curve.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const lastV = c.curve[c.curve.length - 1];
          return (
            <g key={c.month} className={lead ? "lead" : ""}>
              <path d={d} className="ln" />
              {c.curve.map((v, k) => (
                <circle key={k} cx={x(k)} cy={y(v)} r={lead ? 3 : 2} className="pt" />
              ))}
              <text x={x(c.curve.length - 1) + 6} y={y(lastV) + 4} className="lbl">
                {monthName(c.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <DotLegend
        items={[
          {
            label: `Safra mais recente (${newest ? monthName(newest.month) : "—"}, ${compact(newest?.face ?? 0)})`,
            tone: "ink",
          },
          { label: "Safras anteriores", tone: "gray" },
        ]}
      />
    </div>
  );
}
