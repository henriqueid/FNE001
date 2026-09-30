"use client";

/**
 * Agenda de visitas, pendências de registro e histórico.
 */
import { inRange } from "@/src/domain/commercial/calendar";
import { type CommercialState, type Visit } from "@/src/domain/commercial/types";
import { addDays } from "@/src/domain/finance/ledger";
import { Avatar, pct } from "@/src/features/commercial/commercial-ui";
import { br } from "@/src/features/finance/finance-ui";
import { PlusIcon } from "@/src/ui/icons";

export function VisitsTab({
  state,
  from,
  to,
  today,
  repFilter,
  onNew,
  onRecord,
}: {
  state: CommercialState;
  from: string;
  to: string;
  today: string;
  repFilter: string;
  onNew: () => void;
  onRecord: (v: Visit) => void;
}) {
  const mine = state.visits.filter(v => !repFilter || v.repId === repFilter);
  const overdue = mine.filter(v => v.status === "Agendada" && v.date < today);
  const upcoming = mine.filter(v => v.status === "Agendada" && v.date >= today);
  const history = mine
    .filter(v => v.status !== "Agendada" && inRange(v.date, from, to))
    .slice()
    .reverse();
  const done = history.filter(v => v.status === "Realizada").length;
  const byDay = upcoming.reduce<Record<string, Visit[]>>((acc, v) => {
    (acc[v.date] ??= []).push(v);
    return acc;
  }, {});
  const rep = (id: string) => state.reps.find(r => r.id === id);
  const dayLabel = (d: string) =>
    d === today
      ? "Hoje"
      : d === addDays(today, 1)
        ? "Amanhã"
        : new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).format(
            new Date(`${d}T12:00:00`),
          );
  const Row = ({ v }: { v: Visit }) => (
    <li>
      <span className="cm-time">{v.time}</span>
      <Avatar rep={rep(v.repId)} small />
      <div>
        <b>{v.target}</b>
        <small>
          {v.kind} · {v.address} · {rep(v.repId)?.name}
        </small>
      </div>
      <button className="fn-btn small ghost" onClick={() => onRecord(v)}>
        Registrar
      </button>
    </li>
  );
  return (
    <>
      <div className="cm-summary cm-summary-cards">
        <div>
          <span>Realizadas no período</span>
          <b>{done}</b>
        </div>
        <div>
          <span>Taxa de realização</span>
          <b>{history.length ? pct((done / history.length) * 100) : "—"}</b>
        </div>
        <div>
          <span>Agendadas</span>
          <b>{upcoming.length}</b>
        </div>
        <div>
          <span>Sem registro</span>
          <b className={overdue.length ? "bad" : ""}>{overdue.length}</b>
        </div>
        <div>
          <span>Prospecção / relacionamento</span>
          <b>
            {history.filter(v => v.status === "Realizada" && v.kind === "Prospecção").length} /{" "}
            {history.filter(v => v.status === "Realizada" && v.kind !== "Prospecção").length}
          </b>
        </div>
      </div>
      <div className="cm-grid">
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Agenda</h2>
              <p>Próximas visitas agendadas</p>
            </div>
            <button className="fn-btn primary" onClick={onNew}>
              <PlusIcon /> Agendar visita
            </button>
          </header>
          {overdue.length > 0 && (
            <>
              <h4 className="cm-day bad">Sem registro ({overdue.length})</h4>
              <ul className="cm-agenda">
                {overdue.map(v => (
                  <Row key={v.id} v={v} />
                ))}
              </ul>
            </>
          )}
          {Object.entries(byDay).map(([d, vs]) => (
            <div key={d}>
              <h4 className="cm-day">
                {dayLabel(d)} · {br(d)}
              </h4>
              <ul className="cm-agenda">
                {vs.map(v => (
                  <Row key={v.id} v={v} />
                ))}
              </ul>
            </div>
          ))}
          {!upcoming.length && !overdue.length && <div className="fn-empty">Nenhuma visita agendada.</div>}
        </section>
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Histórico de visitas</h2>
              <p>
                {br(from)} a {br(to)}
              </p>
            </div>
          </header>
          <ul className="cm-history">
            {history.map(v => (
              <li key={v.id} className={v.status === "Realizada" ? "" : "muted"}>
                <span className="date">{br(v.date).slice(0, 5)}</span>
                <div>
                  <b>{v.target}</b>
                  <small>
                    {v.kind} · {rep(v.repId)?.name}
                  </small>
                  {v.outcome && (
                    <p>
                      {v.outcome}
                      {v.nextStep ? ` · próximo passo: ${v.nextStep}` : ""}
                    </p>
                  )}
                  {v.notes && <p>{v.notes}</p>}
                </div>
                <span className={`fn-chip ${v.status === "Realizada" ? "ok" : "muted"}`}>{v.status}</span>
              </li>
            ))}
          </ul>
          {!history.length && <div className="fn-empty">Nenhuma visita registrada no período.</div>}
        </section>
      </div>
    </>
  );
}
