"use client";
/**
 * Carteira por atraso: gauge a vencer × vencidos, barras por faixa de atraso e nota de provisão.
 */
import { type aging } from "@/src/domain/home/metrics";
import { AlertIcon } from "@/src/ui/icons";
import { compact, DotLegend, Gauge, int, pct } from "@/src/features/home/widgets";

export function Aging({ buckets, total }: { buckets: ReturnType<typeof aging>; total: number }) {
  const overdue = buckets.slice(1);
  const overdueTotal = overdue.reduce((s, b) => s + b.amount, 0);
  const max = Math.max(...overdue.map(b => b.amount), 1);
  const over30 = overdue.slice(3).reduce((s, b) => s + b.amount, 0);
  return (
    <div className="vg-aging">
      <Gauge
        value={buckets[0].amount}
        total={total}
        left={compact(buckets[0].amount)}
        right={compact(overdueTotal)}
        center={compact(total)}
        caption={`${pct(total ? (overdueTotal / total) * 100 : 0, 1)} vencido`}
      />
      <DotLegend
        items={[
          { label: `A vencer · ${int.format(buckets[0].count)} títulos`, tone: "ink" },
          { label: "Vencidos", tone: "gray" },
        ]}
      />
      <ul className="vg-hbars">
        {overdue.map((b, k) => (
          <li key={b.label} title={`${b.label}: ${compact(b.amount)} em ${b.count} título(s)`}>
            <span>{b.label}</span>
            <div className="vg-track">
              <i className={`ord-${k}`} style={{ width: `${(b.amount / max) * 100}%` }} />
            </div>
            <b>{b.amount ? compact(b.amount) : "—"}</b>
            <small>{b.count} tít.</small>
          </li>
        ))}
      </ul>
      {over30 > 0 && (
        <p className="vg-note">
          <AlertIcon />{" "}
          <span>
            <b>{compact(over30)}</b> vencidos há mais de 30 dias: candidatos a provisão, recompra ou jurídico.
          </span>
        </p>
      )}
    </div>
  );
}
