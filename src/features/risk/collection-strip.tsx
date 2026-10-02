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

export function CollectionStrip({ now, previous }: { now: Month; previous: Month }) {
  const n = (v: number) => String(Math.round(v));
  return (
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
  );
}
