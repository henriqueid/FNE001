"use client";
/**
 * Grade de indicadores de mercado usada em todas as telas: rótulo, valor, leitura curta,
 * tom (bom/ruim) e a fonte de cada número (aparece ao passar o mouse e para leitores de tela).
 * Números que dependem de parâmetro informado à mão levam a etiqueta "informado".
 */
import { useId } from "react";

export type Indicator = {
  label: string;
  value: string;
  caption?: string;
  tone?: "good" | "bad" | "";
  source: string;
  manual?: boolean;
};

function Tile({ item }: { item: Indicator }) {
  const id = useId();
  return (
    <div className={`lx-ind ${item.tone ?? ""}`} title={`Fonte: ${item.source}`} aria-describedby={id}>
      <span className="lx-label">
        {item.label}
        {item.manual && <em className="lx-manual">informado</em>}
      </span>
      <strong>{item.value}</strong>
      {item.caption && <small>{item.caption}</small>}
      <span id={id} className="lx-sr">
        Fonte: {item.source}
      </span>
    </div>
  );
}

export function IndicatorGrid({ items, columns = 4 }: { items: Indicator[]; columns?: number }) {
  return (
    <div className="lx-ind-grid" style={{ "--cols": columns } as React.CSSProperties}>
      {items.map(item => (
        <Tile key={item.label} item={item} />
      ))}
    </div>
  );
}

export const fmtPct = (v: number, digits = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(digits).replace(".", ",")}%`;
export const fmtDays = (v: number) => `${Math.round(v)} dia${Math.round(v) === 1 ? "" : "s"}`;
export const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60),
    min = Math.round(m % 60);
  return h ? `${h}h${min ? ` ${String(min).padStart(2, "0")}min` : ""}` : `${min} min`;
};
