"use client";
/**
 * Concentração e limites: tabela de exposição por cedente, sacado ou veículo.
 */
import { useState } from "react";
import { compact, Empty, pct, Segmented } from "@/src/features/home/widgets";

export type Row = {
  key: string;
  name: string;
  extra: string;
  exposure: number;
  share: number;
  used: number;
  overdue: number;
};

export function Concentration({ cedents, debtors, vehicles }: { cedents: Row[]; debtors: Row[]; vehicles: Row[] }) {
  const [tab, setTab] = useState<"cedentes" | "sacados" | "veiculos">("cedentes");
  const rows = (tab === "cedentes" ? cedents : tab === "sacados" ? debtors : vehicles).slice(0, 6);
  const top = rows.slice(0, 5).reduce((s, r) => s + r.share, 0);
  const maxShare = Math.max(...rows.map(r => r.share), 1);
  return (
    <>
      <div className="vg-card-tools">
        <Segmented
          label="Tipo de concentração"
          value={tab}
          onChange={setTab}
          options={[
            { id: "cedentes", label: "Cedentes" },
            { id: "sacados", label: "Sacados" },
            { id: "veiculos", label: "Veículos" },
          ]}
        />
        <small>
          {tab === "veiculos" ? "Operações em andamento e liberadas" : `Top 5 concentram ${pct(top)} da carteira`}
        </small>
      </div>
      <div className="vg-table vg-conc">
        <div className="vg-tr head">
          <span>{tab === "veiculos" ? "Veículo" : tab === "cedentes" ? "Cedente" : "Sacado"}</span>
          <span>{tab === "veiculos" ? "Volume" : "Exposição"}</span>
          <span>Participação</span>
          <span>{tab === "cedentes" ? "Limite usado" : tab === "sacados" ? "Uso do teto" : "Em andamento"}</span>
          <span>{tab === "veiculos" ? "Bloqueadas" : "Vencidos"}</span>
        </div>
        {rows.map(r => (
          <div className="vg-tr" key={r.key}>
            <span className="name">
              <b>{r.name}</b>
              <small>{r.extra}</small>
            </span>
            <span className="num">{compact(r.exposure)}</span>
            <span className="share">
              <div className="vg-track thin">
                <i style={{ width: `${(r.share / maxShare) * 100}%` }} />
              </div>
              <b>{pct(r.share)}</b>
            </span>
            {Number.isNaN(r.used) ? (
              <span className="muted">sem limite</span>
            ) : (
              <span
                className={`limit ${tab !== "veiculos" && r.used >= 90 ? "critical" : tab !== "veiculos" && r.used >= 75 ? "watch" : ""}`}
              >
                <div className="vg-track thin">
                  <i style={{ width: `${Math.min(100, r.used)}%` }} />
                </div>
                <b>{pct(r.used, 0)}</b>
              </span>
            )}
            {tab === "veiculos" ? (
              <span className={`num ${r.overdue ? "bad" : "muted"}`}>{r.overdue || "—"}</span>
            ) : (
              <span className={`num ${r.overdue > 0 ? "bad" : "muted"}`}>
                {r.overdue > 0 ? compact(r.overdue) : "—"}
              </span>
            )}
          </div>
        ))}
        {rows.length === 0 && <Empty>Sem dados para este recorte.</Empty>}
      </div>
    </>
  );
}
