"use client";

/**
 * Pauta e histórico de comitês.
 */
import { inRange } from "@/src/domain/commercial/calendar";
import { type CommercialState, type Committee } from "@/src/domain/commercial/types";
import { committeeTone, pct } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { PlusIcon, SearchIcon } from "@/src/ui/icons";
import { Fragment, useState } from "react";

export function CommitteesTab({
  state,
  pauta,
  repFilter,
  from,
  to,
  onNew,
  onDecide,
}: {
  state: CommercialState;
  pauta: Committee[];
  repFilter: string;
  from: string;
  to: string;
  onNew: () => void;
  onDecide: (c: Committee) => void;
}) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const history = state.committees
    .filter(
      c =>
        c.status !== "Em pauta" &&
        (!repFilter || c.repId === repFilter) &&
        inRange(c.decidedAt ?? c.date, from, to) &&
        (!status || c.status === status) &&
        (!q || c.clientName.toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) => (b.decidedAt ?? b.date).localeCompare(a.decidedAt ?? a.date));
  const decided = history.length;
  const approved = history.filter(c => c.status === "Aprovado" || c.status === "Aprovado com ressalvas");
  const requested = approved.reduce((s, c) => s + c.requested, 0),
    granted = approved.reduce((s, c) => s + (c.approved ?? 0), 0);
  const rep = (id: string) => state.reps.find(r => r.id === id);
  return (
    <>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Pauta do comitê</h2>
            <p>{pauta.length} pedido(s) aguardando decisão</p>
          </div>
          <button className="fn-btn primary" onClick={onNew}>
            <PlusIcon /> Enviar pedido ao comitê
          </button>
        </header>
        <div className="cm-pauta">
          {pauta.map(c => (
            <article key={c.id}>
              <header>
                <div>
                  <b>{c.clientName}</b>
                  <small>
                    {c.request} · {rep(c.repId)?.name} · reunião de {br(c.date)}
                  </small>
                </div>
                <strong>
                  {c.request === "Taxa especial"
                    ? `${String(c.rate ?? "").replace(".", ",")}% a.m.`
                    : money(c.requested)}
                </strong>
              </header>
              <div className="cm-opinion">
                <span>Comercial</span>
                <p>{c.commercialOpinion}</p>
              </div>
              {c.riskOpinion ? (
                <div className={`cm-opinion ${/desfavor/i.test(c.riskOpinion) ? "bad" : ""}`}>
                  <span>Risco</span>
                  <p>{c.riskOpinion}</p>
                </div>
              ) : (
                <div className="cm-opinion muted">
                  <span>Risco</span>
                  <p>Parecer pendente</p>
                </div>
              )}
              <footer>
                <button className="fn-btn primary small" onClick={() => onDecide(c)}>
                  Registrar decisão
                </button>
              </footer>
            </article>
          ))}
          {!pauta.length && <div className="fn-empty">Nenhum pedido em pauta.</div>}
        </div>
      </section>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Histórico de comitês</h2>
            <p>
              {br(from)} a {br(to)} · clique numa linha para ver a trilha
            </p>
          </div>
          <div className="fn-head-actions">
            <select className="cm-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Todas as decisões</option>
              <option>Aprovado</option>
              <option>Aprovado com ressalvas</option>
              <option>Reprovado</option>
            </select>
            <label className="cm-search">
              <SearchIcon />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cliente" />
            </label>
          </div>
        </header>
        <div className="cm-summary">
          <div>
            <span>Decisões</span>
            <b>{decided}</b>
          </div>
          <div>
            <span>Aprovação</span>
            <b>{decided ? pct((approved.length / decided) * 100) : "—"}</b>
          </div>
          <div>
            <span>Com ressalvas</span>
            <b>{history.filter(c => c.status === "Aprovado com ressalvas").length}</b>
          </div>
          <div>
            <span>Reprovados</span>
            <b>{history.filter(c => c.status === "Reprovado").length}</b>
          </div>
          <div>
            <span>Aprovado / solicitado</span>
            <b>{requested ? pct((granted / requested) * 100) : "—"}</b>
          </div>
        </div>
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Comercial</th>
                <th>Pedido</th>
                <th className="num">Solicitado</th>
                <th className="num">Aprovado</th>
                <th className="num">Taxa</th>
                <th>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {history.map(c => (
                <Fragment key={c.id}>
                  <tr className="cm-click" onClick={() => setOpen(open === c.id ? null : c.id)}>
                    <td className="date">{br(c.decidedAt ?? c.date)}</td>
                    <td>
                      <b>{c.clientName}</b>
                    </td>
                    <td>{rep(c.repId)?.name}</td>
                    <td>{c.request}</td>
                    <td className="num">{c.requested ? compact(c.requested) : "—"}</td>
                    <td className="num">{c.approved ? compact(c.approved) : "—"}</td>
                    <td className="num">{c.rate ? `${c.rate.toFixed(2).replace(".", ",")}%` : "—"}</td>
                    <td>
                      <span className={`fn-chip ${committeeTone(c.status)}`}>{c.status}</span>
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="cm-expand">
                      <td colSpan={8}>
                        <div className="cm-opinions">
                          <div>
                            <span>Parecer comercial</span>
                            <p>{c.commercialOpinion}</p>
                          </div>
                          {c.riskOpinion && (
                            <div>
                              <span>Parecer de risco</span>
                              <p>{c.riskOpinion}</p>
                            </div>
                          )}
                          {c.conditions && (
                            <div>
                              <span>{c.status === "Reprovado" ? "Motivo" : "Condições e ressalvas"}</span>
                              <p>{c.conditions}</p>
                            </div>
                          )}
                          <div>
                            <span>Participantes</span>
                            <p>{c.members.join(", ")}</p>
                          </div>
                        </div>
                        <ol className="cm-trail">
                          {c.history.map((h, i) => (
                            <li key={i}>
                              <b>{h.action}</b> · {h.detail}
                              <small>
                                {h.at.includes("-") ? br(h.at) : h.at} · {h.by}
                              </small>
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!history.length && <div className="fn-empty">Nenhuma decisão no período.</div>}
      </section>
    </>
  );
}
