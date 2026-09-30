"use client";
/**
 * Agenda de vencimentos: hoje, próximos 5 dias úteis, maior dia e colunas por dia.
 */
import { type maturityAgenda } from "@/src/domain/home/metrics";
import { compact } from "@/src/features/home/widgets";

export function MaturityAgenda({ days }: { days: ReturnType<typeof maturityAgenda> }) {
  const max = Math.max(...days.map(d => d.amount), 1);
  const today = days[0];
  const next5 = days.slice(0, 5);
  const peak = [...days].sort((a, b) => b.amount - a.amount)[0];
  return (
    <div className="vg-maturity">
      <div className="vg-stats three">
        <div>
          <small>Vence hoje</small>
          <strong>{compact(today.amount)}</strong>
          <em>{today.count} título(s)</em>
        </div>
        <div>
          <small>Próximos 5 dias úteis</small>
          <strong>{compact(next5.reduce((s, d) => s + d.amount, 0))}</strong>
          <em>{next5.reduce((s, d) => s + d.count, 0)} título(s)</em>
        </div>
        <div>
          <small>Maior dia</small>
          <strong>{peak.amount ? compact(peak.amount) : "—"}</strong>
          <em>{peak.amount ? `${peak.label} ${peak.short}` : "sem vencimentos"}</em>
        </div>
      </div>
      <div className="vg-cols">
        {days.map((d, i) => (
          <div
            key={d.date}
            className="vg-col"
            title={`${d.label} ${d.short}: ${d.count ? `${compact(d.amount)} · ${d.titles.map(t => t.debtorName.split(" ")[0]).join(", ")}` : "sem vencimentos"}`}
          >
            <div className="vg-col-wrap">
              {d.amount > 0 && (
                <i style={{ height: `${Math.max(4, (d.amount / max) * 100)}%` }} className={i === 0 ? "today" : ""} />
              )}
            </div>
            <small>{d.label}</small>
            <em>{d.short}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
