"use client";
/**
 * Cobrança do mês contra o mês anterior: liquidez no prazo, liquidado até D+5,
 * prorrogações, recompras e protestos.
 */
import { type collectionMonth } from "@/src/domain/risk/portfolio-dynamics";
import { compact, pct } from "@/src/features/home/widgets";

type Month = ReturnType<typeof collectionMonth>;

function Item({
  label,
  value,
  prev,
  format,
  higherIsBetter,
}: {
  label: string;
  value: number;
  prev: number;
  format: (v: number) => string;
  higherIsBetter: boolean;
}) {
  const diff = value - prev;
  const good = diff === 0 ? null : diff > 0 === higherIsBetter;
  return (
    <div className="lx-coll-item">
      <span className="lx-label">{label}</span>
      <strong>{format(value)}</strong>
      <small className={good === null ? "" : good ? "up" : "down"}>
        {diff === 0 ? "igual ao mês anterior" : `${diff > 0 ? "▲" : "▼"} antes ${format(prev)}`}
      </small>
    </div>
  );
}

export function CollectionStrip({ now, previous, history = [] }: { now: Month; previous: Month; history?: Month[] }) {
  const n = (v: number) => String(Math.round(v));
  return (
    <>
      <div className="lx-coll">
        <Item
          label="Liquidez no prazo"
          value={now.onTimeRate}
          prev={previous.onTimeRate}
          format={v => pct(v, 1)}
          higherIsBetter
        />
        <Item
          label="Liquidado até D+5"
          value={now.upTo5Rate}
          prev={previous.upTo5Rate}
          format={v => pct(v, 1)}
          higherIsBetter
        />
        <Item
          label="Prorrogações"
          value={now.extended}
          prev={previous.extended}
          format={compact}
          higherIsBetter={false}
        />
        <Item
          label="Recompras"
          value={now.repurchased}
          prev={previous.repurchased}
          format={compact}
          higherIsBetter={false}
        />
        <Item label="Protestos" value={now.protests} prev={previous.protests} format={n} higherIsBetter={false} />
        <Item
          label="Vencido > 30 dias"
          value={now.openBalance ? (now.overdue30 / now.openBalance) * 100 : 0}
          prev={previous.openBalance ? (previous.overdue30 / previous.openBalance) * 100 : 0}
          format={v => pct(v, 1)}
          higherIsBetter={false}
        />
      </div>
      {history.length > 1 && <CollectionTrend rows={history} />}
    </>
  );
}

function CollectionTrend({ rows }: { rows: Month[] }) {
  const W = 900;
  const H = 92;
  const L = 16;
  const R = 16;
  const x = (index: number) => L + (index / Math.max(1, rows.length - 1)) * (W - L - R);
  const overdue = rows.map(row => (row.openBalance ? (row.overdue30 / row.openBalance) * 100 : 0));
  const values = [...rows.map(row => row.onTimeRate), ...overdue];
  const low = Math.max(0, Math.floor(Math.min(...values) / 10) * 10 - 5);
  const high = Math.min(100, Math.ceil(Math.max(...values) / 10) * 10 + 5);
  const y = (value: number) => 8 + (1 - (value - low) / Math.max(1, high - low)) * 54;
  const path = (series: number[]) =>
    series.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const label = (month: string) =>
    new Date(`${month}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return (
    <div className="lx-collection-trend">
      <span className="lx-label">Tendência · 6 meses</span>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tendência de liquidez e vencido acima de 30 dias">
        <path d={path(rows.map(row => row.onTimeRate))} className="liquidity" />
        <path d={path(overdue)} className="overdue" />
        {rows.map((row, index) => (
          <g key={row.month}>
            <title>{`${label(row.month)}: liquidez ${pct(row.onTimeRate, 1)}, vencido acima de 30 dias ${pct(overdue[index], 1)}`}</title>
            <circle cx={x(index)} cy={y(row.onTimeRate)} r="3" className="liquidity" />
            <circle cx={x(index)} cy={y(overdue[index])} r="3" className="overdue" />
            <text x={x(index)} y={H - 6} textAnchor="middle">
              {label(row.month)}
            </text>
          </g>
        ))}
      </svg>
      <div className="lx-collection-legend">
        <span className="liquidity">Liquidez no prazo</span>
        <span className="overdue">Vencido &gt; 30 dias</span>
      </div>
    </div>
  );
}
