"use client";

/**
 * Módulo Carteira: títulos adquiridos (carteira anterior + operações liberadas), atraso por faixa e qualidade
 * da carteira por cedente e comercial. Ponte entre Operação (origem dos títulos), Cadastro (cedente e limite),
 * Comercial (carteira por comercial e estorno de recompra) e Tesouraria (liquidação, próxima fase).
 */
import type { StateCommit } from "@/src/ui/confirmed-state";
import { useRegistry } from "@/src/app/registry-context";
import { digits } from "@/src/domain/commercial/calendar";
import { type Debtor } from "@/src/domain/core/types";
import { type AppView } from "@/src/features/shell/shell-context";
import { useMemo, useState } from "react";
import { repAt } from "@/src/domain/commercial/rules";
import { todayIso } from "@/src/domain/finance/ledger";
import { aging, daysBetween } from "@/src/domain/home/metrics";
import { portfolioByRep } from "@/src/domain/registry/registry";
import { portfolioBalance, portfolioDisplayStatus, type PortfolioState } from "@/src/domain/portfolio/model";
import { buildCollectionQueue } from "@/src/domain/portfolio/collection";
import {
  ArrowIcon,
  BellIcon,
  ClockIcon,
  ListIcon,
  SearchIcon,
  UsersIcon,
  WalletIcon,
  BriefcaseLineIcon,
} from "@/src/ui/icons";
import { ModuleTabs } from "@/src/ui/module-tabs";
import { compact } from "@/src/features/finance/finance-ui";
import { PortfolioTitleGrid } from "./portfolio-title-grid";
import { portfolioIndicators } from "@/src/domain/indicators/portfolio";
import { fmtDays, fmtPct, IndicatorGrid } from "@/src/features/indicators/indicator-grid";
import { useQualityPolicy } from "@/src/features/risk/use-quality-policy";
import { CollectionCenter } from "./collection-center";
import type { PortfolioFocus, PortfolioSituation, PortfolioTab } from "./portfolio-navigation";
import { scoreChipTone, scoreClassification } from "@/src/features/registry/registry-format";
import { SettlementPanel } from "./settlement-panel";
import type { FinanceState } from "@/src/domain/finance/model";
import type { ReceivableCommand } from "@/src/server/portfolio/financial-commands";

type Props = {
  portfolio: PortfolioState;
  onPortfolio: StateCommit<PortfolioState>;
  companyScope: string;
  onNavigate: (view: AppView) => void;
  focus?: PortfolioFocus;
  debtors: Debtor[];
  finance?: FinanceState;
  onSettlement?: (command: ReceivableCommand) => Promise<void>;
};

export default function PortfolioModule({
  portfolio,
  onPortfolio,
  companyScope,
  onNavigate,
  focus,
  debtors,
  finance,
  onSettlement,
}: Props) {
  const { commercial, cedents } = useRegistry();
  const { policy } = useQualityPolicy();
  const today = todayIso();
  const [tab, setTab] = useState<PortfolioTab>(focus?.tab ?? "cobranca");
  const [situation, setSituation] = useState<PortfolioSituation>(focus?.situation ?? "todos");
  const [repFilter, setRepFilter] = useState("");
  const [q, setQ] = useState(focus?.query ?? "");

  const all = useMemo(
    () =>
      portfolio.titles
        .filter(title => companyScope === "Consolidado" || title.company === companyScope)
        .map(title => {
          const cedent = cedents.find(item => digits(item.document) === digits(title.ownerDocument));
          const debtor = debtors.find(item => digits(item.document) === digits(title.debtorDocument));
          return {
            ...title,
            amount: portfolioBalance(title),
            reference: title.documentNumber,
            source: title.source === "Operação liberada" ? ("Operação liberada" as const) : ("Carteira" as const),
            originLabel: title.importSource ?? title.source,
            vehicle: title.company,
            displayStatus: portfolioDisplayStatus(title, today),
            cedentScore: cedent?.score,
            cedentClassification: scoreClassification(cedent?.score),
            debtorScore: debtor?.score,
            debtorClassification: scoreClassification(debtor?.score),
          };
        }),
    [cedents, companyScope, debtors, portfolio, today],
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
  const collectionActions = buildCollectionQueue(openScoped, today);
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
  const scopedIds = new Set(scoped.map(t => t.id));
  const ind = portfolioIndicators(
    portfolio.titles.filter(t => scopedIds.has(t.id)),
    today,
    policy.indicators.provisionBands,
  );
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
      {all.some(title => title.positionReviewRequired) && (
        <p role="alert" className="fn-warning">
          Há títulos com divergência entre a posição importada e os recebimentos locais. Valores anteriores foram
          preservados; novas movimentações desses títulos ficam bloqueadas até a conciliação do arquivo de origem.
        </p>
      )}
      {finance && onSettlement && (
        <SettlementPanel
          portfolio={{
            ...portfolio,
            titles: portfolio.titles.filter(title => companyScope === "Consolidado" || title.company === companyScope),
          }}
          finance={finance}
          onCommand={onSettlement}
        />
      )}
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
      <ModuleTabs
        label="Seções da carteira"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "cobranca",
            label: "Central de cobrança",
            icon: <BellIcon />,
            count: collectionActions.filter(action => action.priority === "critica" || action.priority === "alta")
              .length,
            tone: "alert",
          },
          { id: "titulos", label: "Títulos", icon: <ListIcon />, count: openScoped.length, tone: "neutral" },
          { id: "cedentes", label: "Por cedente", icon: <UsersIcon />, count: byCedent.length, tone: "neutral" },
          { id: "comerciais", label: "Por comercial", icon: <BriefcaseLineIcon /> },
          {
            id: "aging",
            label: "Atraso",
            icon: <ClockIcon />,
            count: openScoped.filter(t => t.late > 0).length,
            tone: "alert",
          },
        ]}
      />
      {tab === "cobranca" ? (
        <CollectionCenter
          rows={openScoped}
          today={today}
          portfolio={portfolio}
          onPortfolio={onPortfolio}
          repName={repName}
        />
      ) : (
        <>
          <section className="pf-foundation" aria-label="Estado da carteira">
            <div>
              <span>BASE OPERACIONAL</span>
              <b>
                {(portfolio.historicalTitleCount ?? portfolio.titles.length).toLocaleString("pt-BR")} títulos
                controlados
              </b>
              <small>
                {portfolio.titles.length.toLocaleString("pt-BR")} em aberto
                {portfolio.positionDate
                  ? ` · posição ${new Date(`${portfolio.positionDate}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : ""}
              </small>
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

          <section className="fn-card lx-ind-card">
            <header className="fn-card-head">
              <div>
                <h2>Indicadores da carteira</h2>
                <p>Posição de hoje · PDD pelas faixas da política de risco · passe o mouse para ver a fonte</p>
              </div>
            </header>
            <IndicatorGrid
              columns={5}
              items={[
                {
                  label: "Prazo médio remanescente",
                  value: fmtDays(ind.remainingTerm),
                  caption: ind.originalTerm
                    ? `prazo médio na compra: ${fmtDays(ind.originalTerm)}`
                    : "ponderado pelo saldo a vencer",
                  source: "Dias até o vencimento dos títulos a vencer, ponderados pelo saldo",
                },
                {
                  label: "Vencido > 30 dias",
                  value: compact(ind.overdue30),
                  caption: `${fmtPct(ind.total ? (ind.overdue30 / ind.total) * 100 : 0)} · > 60: ${compact(ind.overdue60)} · > 90: ${compact(ind.overdue90)}`,
                  tone: ind.overdue30 > 0 ? "bad" : "good",
                  source: "Saldo dos títulos em aberto pela data de vencimento",
                },
                {
                  label: "PDD estimada",
                  value: compact(ind.provision),
                  caption: `${fmtPct(ind.total ? (ind.provision / ind.total) * 100 : 0)} da carteira`,
                  source: "Saldo vencido de cada título × % de provisão da faixa de atraso (política de risco)",
                },
                {
                  label: "Liquidez no vencimento",
                  value: fmtPct(ind.onTimeRate),
                  caption: "dos títulos já pagos",
                  source: "Valor pago até o vencimento original ÷ valor pago",
                },
                {
                  label: "10 maiores sacados",
                  value: fmtPct(ind.top10DebtorShare),
                  caption: "do saldo em aberto",
                  source: "Saldo em aberto agrupado por sacado",
                },
                {
                  label: "Recomprado",
                  value: compact(ind.repurchased),
                  caption: "acumulado nos títulos da carteira",
                  source: "Valor recomprado registrado nos títulos",
                },
                {
                  label: "Prorrogados",
                  value: String(ind.extended.length),
                  caption: compact(ind.extended.reduce((s, t) => s + portfolioBalance(t), 0)),
                  source: "Títulos com vencimento alterado ou situação Prorrogado",
                },
                {
                  label: "Cartório e protesto",
                  value: String(ind.inNotary.length),
                  caption: compact(ind.inNotary.reduce((s, t) => s + portfolioBalance(t), 0)),
                  tone: ind.inNotary.length ? "bad" : "",
                  source: "Títulos em cartório ou protestados",
                },
              ]}
            />
          </section>
        </>
      )}

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
                  ] as [PortfolioSituation, string][]
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
          <PortfolioTitleGrid rows={shown} repName={repName} portfolio={portfolio} onPortfolio={onPortfolio} />
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
                  <th>Classificação</th>
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
                      <td>
                        <span className={`fn-chip ${scoreChipTone(ced?.score)}`}>
                          {scoreClassification(ced?.score)}
                          {ced?.score ? ` · ${ced.score}` : ""}
                        </span>
                      </td>
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
          <h2>Cobrança bancária e próximas rotinas</h2>
          <p>
            Remessa e retorno CNAB 400 Itaú e Bradesco ficam no Financeiro, sujeitos ao convênio homologado. Crédito a
            identificar, transmissão de protesto/negativação e conta gráfica completa ainda dependem de implantação.
          </p>
        </div>
        <div className="ds-today-links">
          <button type="button" onClick={() => onNavigate("finance")}>
            <span>
              <b>Remessa e confirmação de cobrança</b>
              <small>Abrir Financeiro › Cobrança</small>
            </span>
            <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}
