"use client";

/**
 * Módulo Carteira: títulos adquiridos (carteira anterior + operações liberadas), atraso por faixa e qualidade
 * da carteira por cedente e comercial. Ponte entre Operação (origem dos títulos), Cadastro (cedente e limite),
 * Comercial (carteira por comercial e estorno de recompra) e Tesouraria (liquidação, próxima fase).
 */
import { useRegistry } from "@/src/app/registry-context";
import { digits } from "@/src/domain/commercial/calendar";
import { type AppView } from "@/src/features/shell/shell-context";
import { useMemo, useState } from "react";
import { repAt } from "@/src/domain/commercial/rules";
import { todayIso } from "@/src/domain/finance/ledger";
import { aging, daysBetween } from "@/src/domain/home/metrics";
import { portfolioByRep } from "@/src/domain/registry/registry";
import { portfolioBalance, portfolioDisplayStatus, type PortfolioState } from "@/src/domain/portfolio/model";
import { ArrowIcon, SearchIcon, WalletIcon } from "@/src/ui/icons";
import { compact } from "@/src/features/finance/finance-ui";
import { PortfolioTitleGrid } from "./portfolio-title-grid";

type Tab = "titulos" | "cedentes" | "comerciais" | "aging";
type Situation = "todos" | "avencer" | "vencidos" | "d30";
type Props = {
  portfolio: PortfolioState;
  onPortfolio: (state: PortfolioState) => void;
  companyScope: string;
  onNavigate: (view: AppView) => void;
};

export default function PortfolioModule({ portfolio, onPortfolio, companyScope, onNavigate }: Props) {
  const { commercial, cedents } = useRegistry();
  const today = todayIso();
  const [tab, setTab] = useState<Tab>("titulos");
  const [situation, setSituation] = useState<Situation>("todos");
  const [repFilter, setRepFilter] = useState("");
  const [q, setQ] = useState("");

  const all = useMemo(
    () =>
      portfolio.titles
        .filter(title => companyScope === "Consolidado" || title.company === companyScope)
        .map(title => ({
          ...title,
          amount: portfolioBalance(title),
          reference: title.documentNumber,
          source: title.source === "Operação liberada" ? ("Operação liberada" as const) : ("Carteira" as const),
          originLabel: title.importSource ?? title.source,
          vehicle: title.company,
          displayStatus: portfolioDisplayStatus(title, today),
        })),
    [companyScope, portfolio, today],
  );
  const withRep = useMemo(
    () =>
      all.map(t => ({ ...t, late: daysBetween(t.dueDate, today), repId: repAt(commercial, t.ownerDocument, today) })),
    [all, commercial, today],
  );
  const scoped = withRep.filter(t => !repFilter || t.repId === repFilter);
  const openScoped = scoped.filter(
    t => t.status !== "Pago" && t.status !== "Recomprado" && t.status !== "Cancelado" && t.amount > 0,
  );
  const shown = scoped
    .filter(
      t =>
        (situation === "todos" ||
          (situation === "avencer"
            ? openScoped.includes(t) && t.late <= 0
            : situation === "vencidos"
              ? openScoped.includes(t) && t.late > 0
              : openScoped.includes(t) && t.late > 30)) &&
        (!q ||
          `${t.ownerName} ${t.debtorName} ${t.reference} ${t.ownerDocument} ${t.debtorDocument} ${t.proposal ?? ""} ${t.aditivoNumber ?? ""} ${t.borderoNumber ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    )
    .sort((a, b) => b.late - a.late || a.dueDate.localeCompare(b.dueDate));
  const sum = (list: { amount: number }[]) => list.reduce((s, t) => s + t.amount, 0);
  const open = sum(openScoped);
  const overdue = sum(openScoped.filter(t => t.late > 0));
  const overdue30 = sum(openScoped.filter(t => t.late > 30));
  const next7 = sum(openScoped.filter(t => t.late <= 0 && t.late >= -7));
  const events = (commercial.carteiraEvents ?? []).filter(
    e => !repFilter || repAt(commercial, e.document, e.date) === repFilter,
  );
  const repName = (id?: string) => commercial.reps.find(r => r.id === id)?.name ?? "Sem comercial";
  const buckets = aging(openScoped, today);
  const maxBucket = Math.max(1, ...buckets.map(b => b.amount));

  const byCedent = Object.values(
    openScoped.reduce<
      Record<string, { document: string; name: string; repId?: string; open: number; overdue: number; count: number }>
    >((acc, t) => {
      const key = digits(t.ownerDocument);
      acc[key] ??= { document: t.ownerDocument, name: t.ownerName, repId: t.repId, open: 0, overdue: 0, count: 0 };
      acc[key].open += t.amount;
      acc[key].count += 1;
      if (t.late > 0) acc[key].overdue += t.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b.open - a.open);
  const byRep = portfolioByRep(
    openScoped.map(title => ({ ...title, source: title.source })),
    commercial,
    today,
  )
    .filter(r => !repFilter || r.repId === repFilter)
    .sort((a, b) => b.open - a.open);

  return (
    <div className="page-wrap fn-page pf-page">
      <div className="fn-heading">
        <div>
          <span className="hd-eyebrow">
            <WalletIcon /> CARTEIRA E COBRANÇA
          </span>
          <h1>Carteira</h1>
          <p>
            Central operacional dos títulos adquiridos. Liberações entram automaticamente, preservam a origem e
            permanecem disponíveis após recarregar a página.
          </p>
        </div>
        <div className="fn-heading-actions">
          <label className="company-scope">
            <span>COMERCIAL</span>
            <select value={repFilter} onChange={e => setRepFilter(e.target.value)}>
              <option value="">Todos os comerciais</option>
              {commercial.reps.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <nav className="fn-tabs" aria-label="Seções da carteira">
        {(
          [
            ["titulos", "Títulos"],
            ["cedentes", "Por cedente"],
            ["comerciais", "Por comercial"],
            ["aging", "Atraso"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <section className="pf-foundation" aria-label="Estado da carteira">
        <div>
          <span>BASE OPERACIONAL</span>
          <b>{portfolio.titles.length} títulos controlados</b>
          <small>Dados históricos e novas operações na mesma estrutura</small>
        </div>
        <div>
          <span>EMPRESA ATIVA</span>
          <b>{companyScope}</b>
          <small>
            {openScoped.length} título(s) em aberto · {scoped.length} no histórico
          </small>
        </div>
        <div>
          <span>RASTREABILIDADE</span>
          <b>Origem preservada</b>
          <small>Proposta, aditivo, borderô e campos importados</small>
        </div>
      </section>
      <div className="fn-kpis">
        <div>
          <span>Carteira em aberto</span>
          <strong>{compact(open)}</strong>
          <small>{openScoped.length} título(s)</small>
        </div>
        <div>
          <span>Vence em 7 dias</span>
          <strong>{compact(next7)}</strong>
          <small>{openScoped.filter(t => t.late <= 0 && t.late >= -7).length} título(s)</small>
        </div>
        <div>
          <span>Vencido</span>
          <strong className={overdue ? "bad" : ""}>{compact(overdue)}</strong>
          <small>{open ? `${((overdue / open) * 100).toFixed(1).replace(".", ",")}% da carteira` : "—"}</small>
        </div>
        <div>
          <span>Vencido &gt; 30 dias</span>
          <strong className={overdue30 ? "bad" : ""}>{compact(overdue30)}</strong>
          <small>candidatos a provisão ou recompra</small>
        </div>
        <div>
          <span>Recompras</span>
          <strong>{compact(sum(events))}</strong>
          <small>{events.length} evento(s) · estornam comissão</small>
        </div>
        <div>
          <span>Cedentes</span>
          <strong>{byCedent.length}</strong>
          <small>{byCedent.filter(c => c.overdue > 0).length} com vencidos</small>
        </div>
      </div>

      {tab === "titulos" && (
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Central de títulos</h2>
              <p>Posição operacional em aberto · mais atrasados primeiro</p>
            </div>
            <div className="fn-head-actions">
              <div className="fn-seg" role="group" aria-label="Situação">
                {(
                  [
                    ["todos", "Todos"],
                    ["avencer", "A vencer"],
                    ["vencidos", "Vencidos"],
                    ["d30", "> 30 dias"],
                  ] as [Situation, string][]
                ).map(([id, label]) => (
                  <button key={id} className={situation === id ? "active" : ""} onClick={() => setSituation(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="cm-search">
                <SearchIcon />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Cedente, sacado, aditivo, CNPJ"
                  aria-label="Buscar título"
                />
              </label>
            </div>
          </header>
          <PortfolioTitleGrid
            rows={shown.slice(0, 200)}
            repName={repName}
            portfolio={portfolio}
            onPortfolio={onPortfolio}
          />
          {shown.length === 0 && <p className="fn-note">Nenhum título neste filtro.</p>}
        </section>
      )}

      {tab === "cedentes" && (
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Por cedente</h2>
              <p>Exposição, atraso e uso do limite aprovado no Cadastro</p>
            </div>
          </header>
          <div className="fn-table-scroll">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Cedente</th>
                  <th>Comercial</th>
                  <th className="num">Em aberto</th>
                  <th className="num">Vencido</th>
                  <th className="num">% vencido</th>
                  <th className="num">Limite usado</th>
                  <th className="num">Títulos</th>
                </tr>
              </thead>
              <tbody>
                {byCedent.map(c => {
                  const ced = cedents.find(x => digits(x.document) === digits(c.document));
                  const use = ced?.creditLimit ? ced.usedLimit / ced.creditLimit : 0;
                  return (
                    <tr key={c.document}>
                      <td>
                        <b>{c.name}</b>
                        <small>{c.document}</small>
                      </td>
                      <td>{repName(c.repId)}</td>
                      <td className="num">{compact(c.open)}</td>
                      <td className="num">
                        <span className={c.overdue ? "bad" : ""}>{c.overdue ? compact(c.overdue) : "—"}</span>
                      </td>
                      <td className="num">{((c.overdue / c.open) * 100).toFixed(1).replace(".", ",")}%</td>
                      <td className="num">
                        <span className={use >= 0.9 ? "bad" : use >= 0.75 ? "warn" : ""}>
                          {ced?.creditLimit ? `${Math.round(use * 100)}%` : "—"}
                        </span>
                      </td>
                      <td className="num">{c.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "comerciais" && (
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Por comercial</h2>
              <p>Qualidade da carteira que cada comercial trouxe · recompras estornam a comissão no mês do evento</p>
            </div>
            <button className="fn-btn ghost" onClick={() => onNavigate("commercial")}>
              Abrir Comercial <ArrowIcon />
            </button>
          </header>
          <div className="fn-table-scroll">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Comercial</th>
                  <th className="num">Clientes</th>
                  <th className="num">Em aberto</th>
                  <th className="num">Vencido</th>
                  <th className="num">Vencido &gt; 30d</th>
                  <th className="num">Recompras</th>
                </tr>
              </thead>
              <tbody>
                {byRep.map(r => {
                  const ev = (commercial.carteiraEvents ?? []).filter(
                    e => repAt(commercial, e.document, e.date) === r.repId,
                  );
                  return (
                    <tr key={r.repId}>
                      <td>
                        <b>{repName(r.repId)}</b>
                      </td>
                      <td className="num">{r.clients}</td>
                      <td className="num">{compact(r.open)}</td>
                      <td className="num">
                        <span className={r.overdue ? "bad" : ""}>{r.overdue ? compact(r.overdue) : "—"}</span>
                      </td>
                      <td className="num">
                        <span className={r.overdue30 ? "bad" : ""}>{r.overdue30 ? compact(r.overdue30) : "—"}</span>
                      </td>
                      <td className="num">{ev.length ? `${compact(sum(ev))} · ${ev.length}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "aging" && (
        <section className="fn-card">
          <header className="fn-card-head">
            <div>
              <h2>Atraso por faixa</h2>
              <p>Valor em aberto por dias de atraso</p>
            </div>
          </header>
          <div className="pf-aging">
            {buckets.map(b => (
              <div key={b.label} className={`pf-bucket ${b.tone}`}>
                <span>{b.label}</span>
                <div className="pf-bar">
                  <i style={{ width: `${Math.max(b.amount ? 2 : 0, (b.amount / maxBucket) * 100)}%` }} />
                </div>
                <b>{b.amount ? compact(b.amount) : "—"}</b>
                <small>{b.count} tít.</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ds-card ds-today pf-next">
        <div>
          <h2>Próximas entregas da Carteira</h2>
          <p>
            Remessa e retorno CNAB por banco, crédito a identificar, régua de cobrança, protesto, prorrogação e conta
            gráfica do cedente.
          </p>
        </div>
        <div className="ds-today-links">
          <button type="button" onClick={() => onNavigate("finance")}>
            <span>
              <b>Remessa e confirmação de cobrança</b>
              <small>Hoje em Financeiro › Liberações de operações</small>
            </span>
            <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}
