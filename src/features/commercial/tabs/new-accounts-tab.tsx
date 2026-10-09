"use client";

/**
 * Contas novas e ativação (1ª operação dentro da janela).
 */
import { daysBetween, digits, inRange } from "@/src/domain/commercial/calendar";
import { firstDealDate } from "@/src/domain/commercial/rules";
import { type CommercialState, type Committee, type Deal } from "@/src/domain/commercial/types";
import { Avatar, type Metrics, committeeTone, pct } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";

export function NewAccountsTab({
  state,
  deals,
  metrics,
  from,
  to,
  today,
  repFilter,
  onCommittee,
}: {
  state: CommercialState;
  deals: Deal[];
  metrics: Metrics;
  from: string;
  to: string;
  today: string;
  repFilter: string;
  onCommittee: (p: Partial<Committee>) => void;
}) {
  const list = state.links
    .filter(
      l => l.origin !== "Carteira transferida" && inRange(l.since, from, to) && (!repFilter || l.repId === repFilter),
    )
    .sort((a, b) => b.since.localeCompare(a.since));
  return (
    <>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Contas novas por comercial</h2>
            <p>
              Clientes vinculados no período · uma conta nova é ativada quando faz a 1ª operação em até{" "}
              {state.rules.newAccountWindow} dias
            </p>
          </div>
        </header>
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Comercial</th>
                <th className="num">Contas novas</th>
                <th className="num">Ativadas</th>
                <th className="num">Taxa de ativação</th>
                <th className="num">Dias até a 1ª operação</th>
                <th className="num">Receita das contas novas</th>
                <th className="num">Bônus previsto</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const mine = list.filter(l => l.repId === m.rep.id);
                const act = mine.map(l => ({ l, f: firstDealDate(deals, l.document) })).filter(x => x.f);
                const avg = act.length ? act.reduce((s, x) => s + daysBetween(x.l.since, x.f!), 0) / act.length : 0;
                const rev = deals
                  .filter(d => mine.some(l => digits(l.document) === digits(d.document)) && inRange(d.date, from, to))
                  .reduce((s, d) => s + d.revenue, 0);
                return (
                  <tr key={m.rep.id}>
                    <td>
                      <div className="cm-rep">
                        <Avatar rep={m.rep} small />
                        <b>{m.rep.name}</b>
                      </div>
                    </td>
                    <td className="num">{mine.length}</td>
                    <td className="num">{act.length}</td>
                    <td className="num">{mine.length ? pct((act.length / mine.length) * 100) : "—"}</td>
                    <td className="num">{act.length ? `${avg.toFixed(0)} dias` : "—"}</td>
                    <td className="num">{money(rev)}</td>
                    <td className="num">{money(m.activated.length * state.rules.newAccountBonus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Contas novas no período</h2>
            <p>
              {list.length} cliente(s) · {br(from)} a {br(to)}
            </p>
          </div>
        </header>
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Comercial</th>
                <th>Origem</th>
                <th>Vínculo</th>
                <th>Comitê</th>
                <th className="num">Limite</th>
                <th>1ª operação</th>
                <th className="num">Volume no período</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {list.map(l => {
                const first = firstDealDate(deals, l.document);
                const c = state.committees
                  .filter(
                    x => (x.document && digits(x.document) === digits(l.document)) || x.clientName === l.clientName,
                  )
                  .sort((a, b) => b.date.localeCompare(a.date))[0];
                const vol = deals
                  .filter(d => digits(d.document) === digits(l.document) && inRange(d.date, from, to))
                  .reduce((s, d) => s + d.face, 0);
                const waiting = daysBetween(l.since, today);
                return (
                  <tr key={l.id}>
                    <td>
                      <b>{l.clientName}</b>
                      <small>
                        {l.document} · {l.segment}
                      </small>
                    </td>
                    <td>{state.reps.find(r => r.id === l.repId)?.name}</td>
                    <td>
                      <small>{l.origin}</small>
                    </td>
                    <td className="date">{br(l.since)}</td>
                    <td>
                      {c ? (
                        <span className={`fn-chip ${committeeTone(c.status)}`}>
                          {c.status}
                          {c.status === "Em pauta" ? ` · ${br(c.date).slice(0, 5)}` : ""}
                        </span>
                      ) : (
                        <button
                          className="fn-btn small ghost"
                          onClick={() =>
                            onCommittee({
                              clientName: l.clientName,
                              document: l.document,
                              repId: l.repId,
                              request: "Limite inicial",
                            })
                          }
                        >
                          Enviar ao comitê
                        </button>
                      )}
                    </td>
                    <td className="num">{l.approvedLimit ? compact(l.approvedLimit) : "—"}</td>
                    <td>
                      {first ? (
                        <>
                          {br(first)}
                          <small>{daysBetween(l.since, first)} dias após o vínculo</small>
                        </>
                      ) : (
                        <small>Aguardando · {waiting} dia(s)</small>
                      )}
                    </td>
                    <td className="num">{compact(vol)}</td>
                    <td>
                      {first ? (
                        daysBetween(l.since, first) <= state.rules.newAccountWindow ? (
                          <span className="fn-chip ok">Ativada</span>
                        ) : (
                          <span className="fn-chip">Fora da janela</span>
                        )
                      ) : waiting > 15 ? (
                        <span className="fn-chip warn">Sem operar</span>
                      ) : (
                        <span className="fn-chip">Em onboarding</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <div className="fn-empty">Nenhuma conta nova no período.</div>}
      </section>
    </>
  );
}
