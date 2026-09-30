"use client";
/**
 * Carteira por atraso: total em aberto, vencidos e barras por faixa de atraso.
 */
import { type aging } from "@/src/domain/home/metrics";
import { AlertIcon } from "@/src/ui/icons";
import { compact, int, pct } from "@/src/features/home/widgets";

export function Aging({ buckets, total }: { buckets: ReturnType<typeof aging>; total: number }) {
  const overdue = buckets.slice(1);
  const overdueTotal = overdue.reduce((s, b) => s + b.amount, 0);
  const max = Math.max(...overdue.map(b => b.amount), 1);
  const over30 = overdue.slice(3).reduce((s, b) => s + b.amount, 0);
  return (
    <div className="vg-aging">
      <div className="vg-stats two">
        <div>
          <small>Carteira em aberto</small>
          <strong>{compact(total)}</strong>
          <em>
            {compact(buckets[0].amount)} a vencer · {int.format(buckets[0].count)} títulos
          </em>
        </div>
        <div>
          <small>Vencidos</small>
          <strong className={overdueTotal ? "bad" : "good"}>{compact(overdueTotal)}</strong>
          <em>{pct(total ? (overdueTotal / total) * 100 : 0, 1)} da carteira</em>
        </div>
      </div>
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
