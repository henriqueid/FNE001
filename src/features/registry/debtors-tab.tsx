"use client";

/**
 * Aba Sacados do Cadastro: origem do registro (sistema, integração ou digitação),
 * score e exposição na carteira de cada sacado.
 */
import { digits } from "@/src/domain/commercial/calendar";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { compact } from "@/src/features/finance/finance-ui";
import { SearchIcon } from "@/src/ui/icons";
import { useMemo, useState } from "react";
import { scoreTone } from "./registry-format";

type Props = { debtors: Debtor[]; operations: Operation[]; onEdit: (document: string) => void };

export function DebtorsTab({ debtors, operations, onEdit }: Props) {
  const [q, setQ] = useState("");
  const titles = useMemo(() => portfolioTitles(operations), [operations]);
  const debtorExposure = (debtor: Debtor) => {
    const mine = titles.filter(t => digits(t.debtorDocument) === digits(debtor.document));
    return {
      open: mine.reduce((s, t) => s + t.amount, 0),
      cedents: new Set(mine.map(t => digits(t.ownerDocument))).size,
    };
  };
  const shownDebtors = debtors.filter(
    d => !q || `${d.name} ${d.document} ${d.city}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Sacados</h2>
          <p>Cadastrados pelo sistema, por integração ou na digitação da operação</p>
        </div>
        <div className="fn-head-actions">
          <label className="cm-search">
            <SearchIcon />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar sacado, CNPJ, cidade"
              aria-label="Buscar sacado"
            />
          </label>
        </div>
      </header>
      <div className="fn-table-scroll">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Sacado</th>
              <th>Cidade</th>
              <th>Origem</th>
              <th className="num">Score</th>
              <th className="num">Em aberto na carteira</th>
              <th className="num">Cedentes</th>
              <th className="num">Atraso médio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shownDebtors.map(debtor => {
              const e = debtorExposure(debtor);
              return (
                <tr key={debtor.id}>
                  <td>
                    <b>{debtor.name}</b>
                    <small>
                      {debtor.document}
                      {debtor.groupName ? ` · grupo ${debtor.groupName}` : ""}
                    </small>
                  </td>
                  <td>
                    {debtor.city}/{debtor.state}
                  </td>
                  <td>
                    {debtor.source === "Cadastro manual" ? (
                      <span className="fn-chip warn">Provisório · digitação</span>
                    ) : (
                      <span className="fn-chip">{debtor.source}</span>
                    )}
                  </td>
                  <td className="num">
                    <b className={scoreTone(debtor.score ?? 0)}>{debtor.score ?? "—"}</b>
                  </td>
                  <td className="num">{e.open ? compact(e.open) : "—"}</td>
                  <td className="num">{e.cedents || "—"}</td>
                  <td className="num">
                    {debtor.averageDelayDays !== undefined ? `${debtor.averageDelayDays} d` : "—"}
                  </td>
                  <td className="actions">
                    <button className="fn-btn small ghost" onClick={() => onEdit(debtor.document)}>
                      Cadastro
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
