"use client";
/**
 * Composição da receita do período: gauge deságio × tarifas, taxa efetiva e valor liberado.
 */
import { periodLabels, type HomePeriod } from "@/src/domain/home/settings";
import { compact, DotLegend, Empty, Gauge, pct } from "@/src/features/home/widgets";

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
    { label: "Deságio", value: discount },
    { label: "Tarifas e ad valorem", value: fees },
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
          <Gauge
            value={discount}
            total={total}
            left={compact(discount)}
            right={compact(fees)}
            center={pct((discount / total) * 100, 0)}
            caption="deságio · tarifas"
          />
          <DotLegend
            items={[
              { label: mix[0].label, tone: "ink" },
              { label: mix[1].label, tone: "gray" },
            ]}
          />
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
