"use client";

/**
 * Aba Cedentes do Cadastro: crédito (score, limite do comitê, uso), comercial responsável,
 * carteira em aberto e operações de cada cedente. A linha expande com relacionamento,
 * comitês e atalhos para Carteira e Comercial.
 */
import { useRegistry } from "@/src/app/registry-context";
import { digits } from "@/src/domain/commercial/calendar";
import { type ClientLink } from "@/src/domain/commercial/types";
import { type Operation } from "@/src/domain/core/types";
import { todayIso } from "@/src/domain/finance/ledger";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { type ClientRecord } from "@/src/domain/registry/registry";
import { br, compact } from "@/src/features/finance/finance-ui";
import { type AppView } from "@/src/features/shell/shell-context";
import { SearchIcon } from "@/src/ui/icons";
import { Fragment, useMemo, useState } from "react";
import { scoreTone } from "./registry-format";

type Props = {
  operations: Operation[];
  onOpenOperation: (operation: Operation) => void;
  onNavigate: (view: AppView) => void;
  onEdit: (document: string) => void;
  onTransfer: (link: ClientLink) => void;
  onLink: (record: ClientRecord) => void;
  repFilter: string;
};

export function CedentsTab({ operations, onOpenOperation, onNavigate, onEdit, onTransfer, onLink, repFilter }: Props) {
  const { records, commercial } = useRegistry();
  const today = todayIso();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const titles = useMemo(() => portfolioTitles(operations), [operations]);
  const openOps = (document: string) =>
    operations.filter(
      op =>
        digits(op.document) === digits(document) && op.status !== "Cancelada" && op.status !== "Liberada ao financeiro",
    );
  const carteira = (document: string) => {
    const mine = titles.filter(t => digits(t.ownerDocument) === digits(document));
    return {
      open: mine.reduce((s, t) => s + t.amount, 0),
      overdue: mine.filter(t => t.dueDate < today).reduce((s, t) => s + t.amount, 0),
    };
  };
  const shown = records.filter(
    r =>
      (!repFilter || (repFilter === "none" ? !r.rep : r.rep?.id === repFilter)) &&
      (!q ||
        `${r.name} ${r.document} ${r.rep?.name ?? ""} ${r.link?.city ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const totalLimit = records.reduce((s, r) => s + r.cedent.creditLimit, 0);
  const totalUsed = records.reduce((s, r) => s + r.cedent.usedLimit, 0);

  return (
    <>
      <div className="fn-kpis">
        <div>
          <span>Cedentes</span>
          <strong>{records.length}</strong>
          <small>{records.filter(r => r.status === "Em onboarding").length} em onboarding</small>
        </div>
        <div>
          <span>Com comercial</span>
          <strong className={records.some(r => !r.rep) ? "warn" : "good"}>{records.filter(r => r.rep).length}</strong>
          <small>
            {records.filter(r => !r.rep).length
              ? `${records.filter(r => !r.rep).length} sem responsável`
              : "todos vinculados"}
          </small>
        </div>
        <div>
          <span>Limite aprovado</span>
          <strong>{compact(totalLimit)}</strong>
          <small>definido pelo comitê</small>
        </div>
        <div>
          <span>Limite usado</span>
          <strong>{totalLimit ? `${Math.round((totalUsed / totalLimit) * 100)}%` : "—"}</strong>
          <small>{compact(totalUsed)} utilizado</small>
        </div>
        <div>
          <span>Carteira em aberto</span>
          <strong>{compact(titles.reduce((s, t) => s + t.amount, 0))}</strong>
          <small>{titles.length} título(s)</small>
        </div>
        <div>
          <span>Operações em andamento</span>
          <strong>
            {operations.filter(op => op.status !== "Cancelada" && op.status !== "Liberada ao financeiro").length}
          </strong>
          <small>com comercial gravado na criação</small>
        </div>
      </div>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Cedentes</h2>
            <p>Clique na linha para ver vínculo, transferências, comitês e operações</p>
          </div>
          <div className="fn-head-actions">
            <label className="cm-search">
              <SearchIcon />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar cedente, CNPJ, comercial, cidade"
                aria-label="Buscar cedente"
              />
            </label>
          </div>
        </header>
        <div className="fn-table-scroll">
          <table className="fn-table rg-table">
            <thead>
              <tr>
                <th>Cedente</th>
                <th>Comercial responsável</th>
                <th className="num">Score</th>
                <th className="num">Limite aprovado</th>
                <th className="num">Usado</th>
                <th className="num">Carteira em aberto</th>
                <th className="num">Em andamento</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(record => {
                const c = carteira(record.document);
                const ops = openOps(record.document);
                const usage = record.cedent.creditLimit ? record.cedent.usedLimit / record.cedent.creditLimit : 0;
                const committees = commercial.committees.filter(
                  x => (x.document && digits(x.document) === digits(record.document)) || x.clientName === record.name,
                );
                return (
                  <Fragment key={record.document}>
                    <tr className="cm-click" onClick={() => setOpen(open === record.document ? null : record.document)}>
                      <td>
                        <b>{record.name}</b>
                        <small>
                          {record.document} · {record.cedent.publicStatus}
                        </small>
                      </td>
                      <td>
                        {record.rep ? (
                          <div className="cm-rep">
                            <span className={`cm-avatar small ${record.rep.kind === "Agente autônomo" ? "agent" : ""}`}>
                              {record.rep.initials}
                            </span>
                            <div>
                              <b>{record.rep.name}</b>
                              <small>
                                desde {br(record.link?.since)} · {record.link?.origin}
                              </small>
                            </div>
                          </div>
                        ) : (
                          <span className="fn-chip warn">Sem comercial</span>
                        )}
                      </td>
                      <td className="num">
                        <b className={scoreTone(record.cedent.score)}>{record.cedent.score || "—"}</b>
                      </td>
                      <td className="num">
                        {record.cedent.creditLimit ? compact(record.cedent.creditLimit) : "—"}
                        <small>{record.limitSource === "Comitê" ? "comitê" : "cadastro"}</small>
                      </td>
                      <td className="num">
                        <span className={usage >= 0.9 ? "bad" : usage >= 0.75 ? "warn" : ""}>
                          {record.cedent.creditLimit ? `${Math.round(usage * 100)}%` : "—"}
                        </span>
                        <small>{compact(record.cedent.usedLimit)}</small>
                      </td>
                      <td className="num">
                        {c.open ? compact(c.open) : "—"}
                        {c.overdue > 0 && <small className="bad">{compact(c.overdue)} vencido</small>}
                      </td>
                      <td className="num">{ops.length || "—"}</td>
                      <td>
                        {record.status === "Ativo" ? (
                          <span className="fn-chip ok">Ativo</span>
                        ) : record.status === "Em onboarding" ? (
                          <span className="fn-chip">Em onboarding</span>
                        ) : record.status === "Inativo" ? (
                          <span className="fn-chip muted">Inativo</span>
                        ) : (
                          <span className="fn-chip warn">Sem comercial</span>
                        )}
                      </td>
                      <td className="actions" onClick={e => e.stopPropagation()}>
                        <button className="fn-btn small ghost" onClick={() => onEdit(record.document)}>
                          Cadastro
                        </button>
                        {record.link ? (
                          <button className="fn-btn small ghost" onClick={() => onTransfer(record.link!)}>
                            Transferir
                          </button>
                        ) : (
                          <button className="fn-btn small primary" onClick={() => onLink(record)}>
                            Vincular comercial
                          </button>
                        )}
                      </td>
                    </tr>
                    {open === record.document && (
                      <tr className="cm-expand">
                        <td colSpan={9}>
                          <div className="rg-detail">
                            <div>
                              <h3>Relacionamento</h3>
                              {record.link ? (
                                <ul className="rg-list">
                                  <li>
                                    <span>Comercial</span>
                                    <b>{record.rep?.name ?? "—"}</b>
                                  </li>
                                  <li>
                                    <span>Vínculo</span>
                                    <b>
                                      {br(record.link.since)} · {record.link.origin}
                                    </b>
                                  </li>
                                  <li>
                                    <span>Segmento</span>
                                    <b>
                                      {record.link.segment} · {record.link.city}
                                    </b>
                                  </li>
                                  {record.link.transfers.map((t, i) => (
                                    <li key={i}>
                                      <span>Transferência {br(t.at)}</span>
                                      <b>
                                        {commercial.reps.find(r => r.id === t.from)?.initials} →{" "}
                                        {commercial.reps.find(r => r.id === t.to)?.initials} · {t.reason}
                                      </b>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="fn-note">
                                  Sem comercial: operações novas deste cedente não geram comissão até o vínculo.
                                </p>
                              )}
                            </div>
                            <div>
                              <h3>Crédito</h3>
                              <ul className="rg-list">
                                {(record.cedent.scoreReasons ?? []).slice(0, 4).map(reason => (
                                  <li key={reason}>
                                    <span>•</span>
                                    <b>{reason}</b>
                                  </li>
                                ))}
                                {committees.slice(-3).map(x => (
                                  <li key={x.id}>
                                    <span>Comitê {br(x.decidedAt ?? x.date)}</span>
                                    <b>
                                      {x.request} · {x.status}
                                      {x.approved ? ` · ${compact(x.approved)}` : ""}
                                    </b>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h3>Operações</h3>
                              {operations.filter(op => digits(op.document) === digits(record.document)).length ? (
                                <ul className="rg-list">
                                  {operations
                                    .filter(op => digits(op.document) === digits(record.document))
                                    .slice(0, 5)
                                    .map(op => (
                                      <li key={op.id}>
                                        <button
                                          type="button"
                                          className="hd-inline-link"
                                          onClick={() => onOpenOperation(op)}
                                        >
                                          Aditivo {op.aditivoNumber}
                                        </button>
                                        <b>
                                          {op.status} · {compact(op.amount)}
                                        </b>
                                      </li>
                                    ))}
                                </ul>
                              ) : (
                                <p className="fn-note">Nenhuma operação no protótipo.</p>
                              )}
                              <div className="rg-links">
                                <button className="fn-btn small ghost" onClick={() => onNavigate("portfolio")}>
                                  Ver na Carteira
                                </button>
                                <button className="fn-btn small ghost" onClick={() => onNavigate("commercial")}>
                                  Ver no Comercial
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fn-note">
          O limite aprovado é atualizado pela decisão do comitê (Comercial › Comitês). A operação grava o comercial
          responsável quando nasce; transferir o cliente só muda as operações seguintes.
        </p>
      </section>
    </>
  );
}
