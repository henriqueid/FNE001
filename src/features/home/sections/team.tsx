"use client";
/**
 * Equipe e produtividade: originação por responsável e ritmo das operações em andamento.
 */
import { type teamRows } from "@/src/domain/home/metrics";
import { periodLabels, type HomePeriod } from "@/src/domain/home/settings";
import { compact, duration, Empty, pct } from "@/src/features/home/widgets";

export function Team({ rows, period }: { rows: ReturnType<typeof teamRows>; period: HomePeriod }) {
  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  if (!rows.length) return <Empty>Nenhuma operação atribuída.</Empty>;
  return (
    <div className="vg-table vg-team">
      <div className="vg-tr head">
        <span>Responsável</span>
        <span>Operações</span>
        <span>Volume</span>
        <span>Receita</span>
        <span>Ritmo atual</span>
        <span>Em andamento</span>
      </div>
      {rows.map(r => {
        const ratio = r.paced ? r.elapsed / r.standard : NaN;
        return (
          <div className="vg-tr" key={r.name}>
            <span className="name person">
              <i>{r.initials}</i>
              <b>{r.name}</b>
            </span>
            <span className="num">{r.ops}</span>
            <span className="num">
              {r.volume ? compact(r.volume) : "—"}
              {totalVolume > 0 && r.volume > 0 && <small>{pct((r.volume / totalVolume) * 100, 0)} do total</small>}
            </span>
            <span className="num">
              {r.revenue ? compact(r.revenue) : "—"}
              {r.volume > 0 && <small>{pct((r.revenue / r.volume) * 100, 2)} do volume</small>}
            </span>
            <span className={Number.isNaN(ratio) ? "muted" : ratio > 1.15 ? "bad" : ratio < 0.85 ? "good" : ""}>
              {Number.isNaN(ratio) ? "sem histórico" : duration(r.elapsed / r.paced)}
              {!Number.isNaN(ratio) && (
                <small>
                  {ratio > 1.15 ? "acima do padrão" : ratio < 0.85 ? "abaixo do padrão" : "no padrão"} · padrão{" "}
                  {duration(r.standard / r.paced)}
                </small>
              )}
            </span>
            <span className="num">
              {r.open}
              {r.blocked > 0 && <small className="bad">{r.blocked} bloqueada(s)</small>}
            </span>
          </div>
        );
      })}
      <div className="vg-tr total">
        <span className="name">
          <b>Equipe</b>
        </span>
        <span className="num">{rows.reduce((s, r) => s + r.ops, 0)}</span>
        <span className="num">{compact(totalVolume)}</span>
        <span className="num">
          {compact(totalRevenue)}
          {totalVolume > 0 && <small>{pct((totalRevenue / totalVolume) * 100, 2)} do volume</small>}
        </span>
        <span>{periodLabels[period].range}</span>
        <span className="num">{rows.reduce((s, r) => s + r.open, 0)}</span>
      </div>
    </div>
  );
}
