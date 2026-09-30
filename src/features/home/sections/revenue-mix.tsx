"use client";
/**
 * Composição da receita do período: deságio × tarifas, taxa efetiva e valor liberado.
 */
import { periodLabels, type HomePeriod } from "@/src/domain/home/settings";
import { compact, Empty, pct } from "@/src/features/home/widgets";

export function RevenueMix({
  discount,
  fees,
  volume,
  rate,
  count,
  releasedValue,
  period,
}: {
  discount: number;
  fees: number;
  volume: number;
  rate: number;
  count: number;
  releasedValue: number;
  period: HomePeriod;
}) {
  const total = discount + fees;
  const mix = [
    { label: "Deságio", value: discount, tone: "c1" },
    { label: "Tarifas e ad valorem", value: fees, tone: "c2" },
  ];
  return (
    <div className="vg-revenue">
      <div className="vg-hero-sm">
        <small>Receita {periodLabels[period].range}</small>
        <strong>{compact(total)}</strong>
        <em>
          {count} operação(ões) · {pct(volume ? (total / volume) * 100 : 0, 2)} sobre o volume
        </em>
      </div>
      {total > 0 ? (
        <>
          <div className="vg-stack" role="img" aria-label="Composição da receita">
            {mix
              .filter(m => m.value > 0)
              .map(m => (
                <i
                  key={m.label}
                  className={m.tone}
                  style={{ width: `${(m.value / total) * 100}%` }}
                  title={`${m.label}: ${compact(m.value)}`}
                />
              ))}
          </div>
          <ul className="vg-legend-list">
            {mix.map(m => (
              <li key={m.label}>
                <i className={`sw ${m.tone}`} />
                <span>{m.label}</span>
                <b>{compact(m.value)}</b>
                <small>{pct(total ? (m.value / total) * 100 : 0, 0)}</small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty>Sem receita {periodLabels[period].range}.</Empty>
      )}
      <div className="vg-stats two compact">
        <div>
          <small>Taxa efetiva média</small>
          <strong>{count ? `${pct(rate, 2)} a.m.` : "—"}</strong>
        </div>
        <div>
          <small>Liberado ao financeiro</small>
          <strong>{compact(releasedValue)}</strong>
        </div>
      </div>
    </div>
  );
}
