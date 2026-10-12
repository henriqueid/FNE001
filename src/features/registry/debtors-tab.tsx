"use client";

/**
 * Aba Sacados do Cadastro: origem do registro (sistema, integração ou digitação),
 * score e exposição na carteira de cada sacado.
 */
import { digits } from "@/src/domain/commercial/calendar";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { partyToDebtor, type Party } from "@/src/domain/registry/parties";
import { searchRegistryParties } from "@/src/app/registry-client";
import type { RegistryPartySearchItem } from "@/src/server/registry/repository";
import { compact } from "@/src/features/finance/finance-ui";
import { SearchIcon } from "@/src/ui/icons";
import { useEffect, useMemo, useState } from "react";
import { scoreTone } from "./registry-format";

type Props = {
  debtors: Debtor[];
  operations: Operation[];
  onEditDocument: (document: string) => void;
  onEditParty: (party: Party) => void;
};
type DebtorRow = {
  debtor: Debtor;
  party?: Party;
  openAmount: number;
  cedentCount: number;
  status?: Party["status"];
};
const pageSize = 50;

export function DebtorsTab({ debtors, operations, onEditDocument, onEditParty }: Props) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [remote, setRemote] = useState<RegistryPartySearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const titles = useMemo(() => portfolioTitles(operations), [operations]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setQuery(q.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    searchRegistryParties({ role: "sacado", query, limit: pageSize, offset })
      .then(result => {
        if (cancelled) return;
        setRemote(current => (offset ? [...current, ...result.items] : result.items));
        setTotal(result.total);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível consultar os sacados no banco.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, query]);

  const shownDebtors = useMemo(() => {
    const rows = new Map<string, DebtorRow>();
    debtors
      .filter(d => !query || `${d.name} ${d.document} ${d.city}`.toLowerCase().includes(query.toLowerCase()))
      .forEach(debtor => {
        const titlesForDebtor = titles.filter(title => digits(title.debtorDocument) === digits(debtor.document));
        rows.set(digits(debtor.document), {
          debtor,
          openAmount: titlesForDebtor.reduce((sum, title) => sum + title.amount, 0),
          cedentCount: new Set(titlesForDebtor.map(title => digits(title.ownerDocument))).size,
        });
      });
    remote.forEach(item => {
      rows.set(digits(item.party.document), {
        debtor: partyToDebtor(item.party),
        party: item.party,
        openAmount: item.openAmount,
        cedentCount: item.cedentCount,
        status: item.party.status,
      });
    });
    return [...rows.values()];
  }, [debtors, query, remote, titles]);

  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Sacados</h2>
          <p>{total.toLocaleString("pt-BR")} cadastrado(s) · sistema, integração ou digitação da operação</p>
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
            {shownDebtors.map(({ debtor, party, openAmount, cedentCount, status }) => {
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
                    {status === "Inativo" && <span className="fn-chip warn">Inativo</span>}
                  </td>
                  <td className="num">
                    <b className={scoreTone(debtor.score ?? 0)}>{debtor.score ?? "—"}</b>
                  </td>
                  <td className="num">{openAmount ? compact(openAmount) : "—"}</td>
                  <td className="num">{cedentCount || "—"}</td>
                  <td className="num">
                    {debtor.averageDelayDays !== undefined ? `${debtor.averageDelayDays} d` : "—"}
                  </td>
                  <td className="actions">
                    <button
                      className="fn-btn small ghost"
                      onClick={() => (party ? onEditParty(party) : onEditDocument(debtor.document))}
                    >
                      Cadastro
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="fn-empty">{error}</p>}
      {!error && !loading && !shownDebtors.length && <p className="fn-empty">Nenhum sacado encontrado.</p>}
      {remote.length < total && (
        <div className="fn-card-actions">
          <button
            className="fn-btn ghost"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError("");
              setOffset(current => current + pageSize);
            }}
          >
            {loading ? "Carregando…" : `Carregar mais (${remote.length} de ${total.toLocaleString("pt-BR")})`}
          </button>
        </div>
      )}
    </section>
  );
}
