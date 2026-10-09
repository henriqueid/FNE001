"use client";

/**
 * Comerciais e carteira de clientes, com dados de crédito do Cadastro e títulos da Carteira.
 */
import { daysBetween, digits } from "@/src/domain/commercial/calendar";
import { type ClientLink, type CommercialState, type Deal, type SalesRep } from "@/src/domain/commercial/types";
import { type Cedent } from "@/src/domain/core/types";
import { addDays } from "@/src/domain/finance/ledger";
import { type PortfolioTitle } from "@/src/domain/home/metrics";
import { type RepPortfolio } from "@/src/domain/registry/registry";
import { Avatar, Meter, type Metrics } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { type AppView } from "@/src/features/shell/shell-context";
import { PlusIcon, SearchIcon } from "@/src/ui/icons";
import { useState } from "react";

export function CarteiraTab({
  repPortfolio,
  cedents,
  titles,
  onNavigate,
  state,
  deals,
  metrics,
  repFilter,
  setRepFilter,
  today,
  onEdit,
  onNew,
  onTransfer,
}: {
  repPortfolio: RepPortfolio[];
  cedents: Cedent[];
  titles: PortfolioTitle[];
  onNavigate?: (view: AppView) => void;
  state: CommercialState;
  deals: Deal[];
  metrics: Metrics;
  repFilter: string;
  setRepFilter: (v: string) => void;
  today: string;
  onEdit: (r: SalesRep) => void;
  onNew: () => void;
  onTransfer: (l: ClientLink) => void;
}) {
  const [q, setQ] = useState("");
  const selected = repFilter ? state.reps.find(r => r.id === repFilter) : undefined;
  const links = state.links.filter(
    l =>
      (!repFilter || l.repId === repFilter) &&
      (!q || `${l.clientName} ${l.document} ${l.city} ${l.segment}`.toLowerCase().includes(q.toLowerCase())),
  );
  const d90 = addDays(today, -89);
  return (
    <>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Comerciais</h2>
            <p>Clique em um comercial para ver a carteira dele</p>
          </div>
          <button className="fn-btn primary" onClick={onNew}>
            <PlusIcon /> Novo comercial
          </button>
        </header>
        <div className="cm-reps">
          {metrics.map(m => (
            <button
              key={m.rep.id}
              className={`cm-rep-card ${repFilter === m.rep.id ? "active" : ""} ${m.rep.active ? "" : "inactive"}`}
              onClick={() => setRepFilter(repFilter === m.rep.id ? "" : m.rep.id)}
            >
              <header>
                <Avatar rep={m.rep} />
                <div>
                  <b>{m.rep.name}</b>
                  <small>
                    {m.rep.role} · {m.rep.region}
                  </small>
                </div>
                {m.rep.kind === "Agente autônomo" && <span className="fn-chip">Agente · {m.rep.flatRate}%</span>}
              </header>
              <dl>
                <div>
                  <dt>Clientes</dt>
                  <dd>{m.portfolio}</dd>
                </div>
                <div>
                  <dt>Receita no período</dt>
                  <dd>{compact(m.revenue)}</dd>
                </div>
                <div>
                  <dt>Carteira em aberto</dt>
                  <dd>{compact(repPortfolio.find(p => p.repId === m.rep.id)?.open ?? 0)}</dd>
                </div>
                <div>
                  <dt>Vencido &gt; 30d</dt>
                  <dd className={(repPortfolio.find(p => p.repId === m.rep.id)?.overdue30 ?? 0) > 0 ? "bad" : ""}>
                    {compact(repPortfolio.find(p => p.repId === m.rep.id)?.overdue30 ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt>Meta mensal</dt>
                  <dd>{compact(m.rep.monthlyGoal)}</dd>
                </div>
                <div>
                  <dt>Pipeline</dt>
                  <dd>{compact(m.pipeline)}</dd>
                </div>
              </dl>
              <Meter value={m.attainment} goalLabel={`Meta do período ${money(m.goal)}`} />
            </button>
          ))}
        </div>
      </section>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>{selected ? `Carteira de ${selected.name}` : "Carteira de clientes vinculados"}</h2>
            <p>
              {links.length} cliente(s) · limite e score do Cadastro · títulos em aberto da Carteira · volume e receita
              dos últimos 90 dias
            </p>
          </div>
          <div className="fn-head-actions">
            <label className="cm-search">
              <SearchIcon />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente, CNPJ, cidade" />
            </label>
            {selected && (
              <button className="fn-btn ghost" onClick={() => onEdit(selected)}>
                Editar comercial
              </button>
            )}
          </div>
        </header>
        {selected && (
          <div className="cm-rep-detail">
            <span>{selected.email}</span>
            <span>{selected.phone}</span>
            <span>
              {selected.kind}
              {selected.flatRate ? ` · ${selected.flatRate}% fixo` : " · faixas por meta"}
            </span>
            <span>Desde {br(selected.since)}</span>
          </div>
        )}
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Cliente</th>
                {!repFilter && <th>Comercial</th>}
                <th>Vínculo</th>
                <th>Situação</th>
                <th className="num">Limite · usado</th>
                <th className="num">Carteira em aberto</th>
                <th className="num">Última operação</th>
                <th className="num">Volume 90d</th>
                <th className="num">Receita 90d</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.map(l => {
                const mine = deals.filter(d => digits(d.document) === digits(l.document));
                const last = mine.at(-1)?.date;
                const recent = mine.filter(d => d.date >= d90);
                const idleDays = last ? daysBetween(last, today) : undefined;
                return (
                  <tr key={l.id}>
                    <td>
                      <b>{l.clientName}</b>
                      <small>
                        {l.document} · {l.segment} · {l.city}
                      </small>
                    </td>
                    {!repFilter && (
                      <td>
                        <div className="cm-rep">
                          <Avatar rep={state.reps.find(r => r.id === l.repId)} small />
                          <span>{state.reps.find(r => r.id === l.repId)?.name}</span>
                        </div>
                      </td>
                    )}
                    <td>
                      {br(l.since)}
                      <small>
                        {l.origin}
                        {l.transfers.length
                          ? ` · transferido de ${state.reps.find(r => r.id === l.transfers.at(-1)!.from)?.initials}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      {l.status === "Em onboarding" ? (
                        <span className="fn-chip">Em onboarding</span>
                      ) : idleDays !== undefined && idleDays > 30 ? (
                        <span className="fn-chip warn">Sem operar há {idleDays}d</span>
                      ) : (
                        <span className="fn-chip ok">Ativo</span>
                      )}
                    </td>
                    {(() => {
                      const ced = cedents.find(c => digits(c.document) === digits(l.document));
                      const open = titles.filter(t => digits(t.ownerDocument) === digits(l.document));
                      const openSum = open.reduce((s, t) => s + t.amount, 0);
                      const late = open.filter(t => t.dueDate < today).reduce((s, t) => s + t.amount, 0);
                      return (
                        <>
                          <td className="num">
                            {l.approvedLimit ? compact(l.approvedLimit) : "—"}
                            <small>
                              {ced && l.approvedLimit
                                ? `${Math.round((ced.usedLimit / l.approvedLimit) * 100)}% usado · score ${ced.score}`
                                : "aguardando comitê"}
                            </small>
                          </td>
                          <td className="num">
                            {openSum ? compact(openSum) : "—"}
                            {late > 0 && <small className="bad">{compact(late)} vencido</small>}
                          </td>
                        </>
                      );
                    })()}
                    <td className="num">{last ? br(last) : "—"}</td>
                    <td className="num">{compact(recent.reduce((s, d) => s + d.face, 0))}</td>
                    <td className="num">
                      <b>{money(recent.reduce((s, d) => s + d.revenue, 0))}</b>
                    </td>
                    <td className="actions">
                      <button className="fn-btn small ghost" onClick={() => onTransfer(l)}>
                        Transferir
                      </button>
                      {onNavigate && (
                        <button className="fn-btn small ghost" onClick={() => onNavigate("registry")}>
                          Cadastro
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
