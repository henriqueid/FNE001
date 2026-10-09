"use client";
/**
 * Carteira e pendências: barras de títulos por situação e lançamentos da conta gráfica dos cedentes.
 */
import { compact, int } from "@/src/features/home/widgets";

export type CollectionRow = { label: string; count: number; amount: number; tone: string; unit: string };

export function Collection({ rows }: { rows: CollectionRow[] }) {
  const max = Math.max(...rows.map(r => r.amount), 1);
  return (
    <ul className="vg-hbars wide">
      {rows.map(r => (
        <li key={r.label}>
          <span>
            {r.label}
            <small>
              {int.format(r.count)} {r.unit}
            </small>
          </span>
          <div className="vg-track">
            <i className={`tone-${r.tone}`} style={{ width: `${(r.amount / max) * 100}%` }} />
          </div>
          <b>{compact(r.amount)}</b>
        </li>
      ))}
    </ul>
  );
}
