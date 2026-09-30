"use client";

/**
 * Negócios realizados, por operação ou por cliente, com exportação.
 */
import { commercialToCsv } from "@/src/domain/commercial/actions";
import { digits } from "@/src/domain/commercial/calendar";
import { type CommercialState, type Deal } from "@/src/domain/commercial/types";
import { type Operation } from "@/src/domain/core/types";
import { downloadCsv, pct } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { SearchIcon } from "@/src/ui/icons";
import { useState } from "react";

export function DealsTab({
  deals,
  state,
  from,
  to,
  operations,
  onOpenOperation,
}: {
  deals: Deal[];
  state: CommercialState;
  from: string;
  to: string;
  operations: Operation[];
  onOpenOperation: (op: Operation) => void;
}) {
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<"negocio" | "cliente">("negocio");
  const list = deals
    .filter(d => !q || `${d.clientName} ${d.document} ${d.bordero}`.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .reverse();
  const repName = (id: string) => state.reps.find(r => r.id === id)?.name ?? "—";
  const total = {
    face: list.reduce((s, d) => s + d.face, 0),
    revenue: list.reduce((s, d) => s + d.revenue, 0),
    discount: list.reduce((s, d) => s + d.discount, 0),
    fees: list.reduce((s, d) => s + d.fees, 0),
  };
  const byClient = Object.values(
    list.reduce<
      Record<
        string,
        { name: string; document: string; repId: string; n: number; face: number; revenue: number; last: string }
      >
    >((acc, d) => {
      const k = digits(d.document);
      const a = acc[k] ?? {
        name: d.clientName,
        document: d.document,
        repId: d.repId,
        n: 0,
        face: 0,
        revenue: 0,
        last: d.date,
      };
      a.n++;
      a.face += d.face;
      a.revenue += d.revenue;
      if (d.date > a.last) a.last = d.date;
      acc[k] = a;
      return acc;
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue);
  const exportCsv = () =>
    downloadCsv(
      `negocios-${from}-a-${to}.csv`,
      commercialToCsv([
        [
          "data",
          "bordero",
          "cliente",
          "cnpj",
          "comercial",
          "veiculo",
          "titulos",
          "valor_face",
          "desagio",
          "tarifas",
          "receita",
          "taxa_am",
        ],
        ...list.map(d => [
          d.date,
          d.bordero,
          d.clientName,
          d.document,
          repName(d.repId),
          d.vehicle,
          d.titles,
          d.face,
          d.discount,
          d.fees,
          d.revenue,
          d.rate,
        ]),
      ]),
    );
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Negócios realizados</h2>
          <p>
            Operações efetivadas dos clientes vinculados · {br(from)} a {br(to)}
          </p>
        </div>
        <div className="fn-head-actions">
          <div className="fn-seg">
            <button className={groupBy === "negocio" ? "active" : ""} onClick={() => setGroupBy("negocio")}>
              Por operação
            </button>
            <button className={groupBy === "cliente" ? "active" : ""} onClick={() => setGroupBy("cliente")}>
              Por cliente
            </button>
          </div>
          <label className="cm-search">
            <SearchIcon />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cliente, CNPJ ou borderô" />
          </label>
          <button className="fn-btn ghost" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </header>
      <div className="cm-summary">
        <div>
          <span>Operações</span>
          <b>{list.length}</b>
        </div>
        <div>
          <span>Volume (face)</span>
          <b>{money(total.face)}</b>
        </div>
        <div>
          <span>Deságio</span>
          <b>{money(total.discount)}</b>
        </div>
        <div>
          <span>Tarifas</span>
          <b>{money(total.fees)}</b>
        </div>
        <div>
          <span>Receita</span>
          <b>{money(total.revenue)}</b>
        </div>
        <div>
          <span>Receita / volume</span>
          <b>{pct(total.face ? (total.revenue / total.face) * 100 : 0)}</b>
        </div>
      </div>
      <div className="fn-table-scroll">
        <table className="fn-table">
          {groupBy === "negocio" ? (
            <>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Borderô</th>
                  <th>Cliente</th>
                  <th>Comercial</th>
                  <th>Veículo</th>
                  <th className="num">Títulos</th>
                  <th className="num">Valor de face</th>
                  <th className="num">Deságio</th>
                  <th className="num">Tarifas</th>
                  <th className="num">Receita</th>
                  <th className="num">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {list.map(d => {
                  const op = d.operationId ? operations.find(o => o.id === d.operationId) : undefined;
                  return (
                    <tr key={d.id} className={op ? "cm-click" : ""} onClick={() => op && onOpenOperation(op)}>
                      <td className="date">{br(d.date)}</td>
                      <td>
                        {d.bordero}
                        {d.live && <span className="fn-chip ok cm-live">Operação do workspace</span>}
                      </td>
                      <td>
                        <b>{d.clientName}</b>
                        <small>{d.document}</small>
                      </td>
                      <td>{repName(d.repId)}</td>
                      <td>
                        <small>{d.vehicle}</small>
                      </td>
                      <td className="num">{d.titles}</td>
                      <td className="num">{money(d.face)}</td>
                      <td className="num">{money(d.discount)}</td>
                      <td className="num">{money(d.fees)}</td>
                      <td className="num">
                        <b>{money(d.revenue)}</b>
                        {d.repurchased ? <small className="bad">recompra {compact(d.repurchased)}</small> : null}
                      </td>
                      <td className="num">{d.rate.toFixed(2).replace(".", ",")}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Comercial</th>
                  <th className="num">Operações</th>
                  <th className="num">Volume</th>
                  <th className="num">Receita</th>
                  <th className="num">Última</th>
                </tr>
              </thead>
              <tbody>
                {byClient.map(c => (
                  <tr key={c.document}>
                    <td>
                      <b>{c.name}</b>
                      <small>{c.document}</small>
                    </td>
                    <td>{repName(c.repId)}</td>
                    <td className="num">{c.n}</td>
                    <td className="num">{money(c.face)}</td>
                    <td className="num">
                      <b>{money(c.revenue)}</b>
                    </td>
                    <td className="num">{br(c.last)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          <tfoot>
            <tr>
              <td colSpan={groupBy === "negocio" ? 6 : 3}>Total</td>
              <td className="num">{money(total.face)}</td>
              {groupBy === "negocio" && (
                <>
                  <td className="num">{money(total.discount)}</td>
                  <td className="num">{money(total.fees)}</td>
                </>
              )}
              <td className="num">
                <b>{money(total.revenue)}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {!list.length && <div className="fn-empty">Nenhum negócio no período.</div>}
    </section>
  );
}
