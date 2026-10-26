"use client";

/**
 * Pauta e histórico de comitês.
 */
import { inRange } from "@/src/domain/commercial/calendar";
import { dossierReadiness } from "@/src/domain/commercial/actions";
import { type CommercialState, type Committee, type Prospect } from "@/src/domain/commercial/types";
import { committeeTone, pct } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { SearchIcon } from "@/src/ui/icons";
import { Fragment, useState } from "react";

export function CommitteesTab({
  state,
  pauta,
  repFilter,
  from,
  to,
  onDecide,
  onOpenDossier,
  canDecide,
}: {
  state: CommercialState;
  pauta: Committee[];
  repFilter: string;
  from: string;
  to: string;
  onDecide: (c: Committee) => void;
  onOpenDossier: (p: Prospect) => void;
  canDecide: boolean;
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
          <span className="fn-chip">Entrada exclusiva pela etapa Proposta do funil</span>
        </header>
        <div className="cm-pauta">
          {pauta.map(c => {
            const candidates = state.prospects.filter(item =>
              c.prospectId ? item.id === c.prospectId : item.name === c.clientName,
            );
            const prospect = candidates.length === 1 ? candidates[0] : undefined;
            const dossier = prospect?.dossier;
            const readiness = prospect ? dossierReadiness(prospect) : null;
            return (
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
                {dossier && (
                  <div className="cm-committee-technical">
                    <div>
                      <span>Faturamento mensal</span>
                      <b>{money(dossier.monthlyRevenue)}</b>
                    </div>
                    <div>
                      <span>Limite solicitado</span>
                      <b>{money(dossier.requestedLimit)}</b>
                    </div>
                    <div>
                      <span>Taxa proposta</span>
                      <b>{String(dossier.proposedRate).replace(".", ",")}% a.m.</b>
                    </div>
                    <div>
                      <span>Prazo médio</span>
                      <b>{dossier.averageTermDays} dias</b>
                    </div>
                    <div>
                      <span>Sacados</span>
                      <b>{dossier.debtorCount}</b>
                    </div>
                    <div>
                      <span>Maior concentração</span>
                      <b>{dossier.largestDebtorPercent}%</b>
                    </div>
                    <div>
                      <span>Recebível</span>
                      <b>{dossier.receivableType}</b>
                    </div>
                    <div>
                      <span>Prontidão documental</span>
                      <b>{readiness?.percent ?? 0}%</b>
                    </div>
                    <div className={dossier.hasRestrictiveIssues ? "bad" : "ok"}>
                      <span>Restrições declaradas</span>
                      <b>{dossier.hasRestrictiveIssues ? dossier.restrictiveIssues || "Sim" : "Não"}</b>
                    </div>
                  </div>
                )}
                <footer>
                  {prospect && (
                    <button className="fn-btn ghost small" onClick={() => onOpenDossier(prospect)}>
                      Ver dossiê
                    </button>
                  )}
                  {canDecide ? (
                    <button className="fn-btn primary small" onClick={() => onDecide(c)}>
                      Registrar decisão
                    </button>
                  ) : (
                    <span className="fn-chip warn">Aguardando alçada de risco</span>
                  )}
                </footer>
              </article>
            );
          })}
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
