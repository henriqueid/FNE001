"use client";

/**
 * Módulo Comercial: filtros de comercial e período, abas e painel com ranking, gráfico, alertas e funil.
 * O estado vive no app (vínculo com Cadastro, Operação e Carteira) e chega por props.
 */
import { pressable } from "@/src/ui/a11y";
import { CommissionsTab } from "@/src/features/commercial/tabs/commissions-tab";
import { CommitteesTab } from "@/src/features/commercial/tabs/committees-tab";
import { DealsTab } from "@/src/features/commercial/tabs/deals-tab";
import { FunnelTab } from "@/src/features/commercial/tabs/funnel-tab";
import { NewAccountsTab } from "@/src/features/commercial/tabs/new-accounts-tab";
import { CarteiraTab } from "@/src/features/commercial/tabs/portfolio-tab";
import { VisitsTab } from "@/src/features/commercial/tabs/visits-tab";
import { Avatar, Meter, type Period, RevenueChart, type Toast, pct } from "./commercial-ui";

import { useCedents } from "@/src/app/registry-context";
import { daysBetween, digits, inRange, monthEnd, monthOf, round2, shiftMonth } from "@/src/domain/commercial/calendar";
import { computeCommission, firstDealDate, liveDeals, repMetrics } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";
import {
  type CResult,
  type ClientLink,
  type CommercialState,
  type Committee,
  type OpFinancials,
  type Prospect,
  type SalesRep,
  type Visit,
  funnelStages,
} from "@/src/domain/commercial/types";
import { type Operation } from "@/src/domain/core/types";
import { addDays, todayIso } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import { portfolioTitles } from "@/src/domain/home/metrics";
import { portfolioByRep } from "@/src/domain/registry/registry";
import { ConvertModal, LostModal, ProspectModal, TransferModal } from "@/src/features/commercial/modals/client-modals";
import { CommitteeModal } from "@/src/features/commercial/modals/committee-modal";
import { RepModal } from "@/src/features/commercial/modals/rep-modal";
import { RulesModal } from "@/src/features/commercial/modals/rules-modal";
import { VisitModal } from "@/src/features/commercial/modals/visit-modal";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { type AppView } from "@/src/features/shell/shell-context";
import { AlertIcon, CheckIcon, ClockIcon, CloseIcon } from "@/src/ui/icons";
import { useMemo, useState } from "react";

export function BriefcaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

export type Tab = "painel" | "comerciais" | "negocios" | "contas" | "visitas" | "funil" | "comites" | "comissoes";
export type Props = {
  state: CommercialState;
  onState: (s: CommercialState) => void;
  operations: Operation[];
  financials: OpFinancials;
  finance: FinanceState;
  onFinance: (s: FinanceState) => void;
  onOpenOperation: (op: Operation) => void;
  onNavigate?: (view: AppView) => void;
};

export default function CommercialModule({
  state,
  onState,
  operations,
  financials,
  finance,
  onFinance,
  onOpenOperation,
  onNavigate,
}: Props) {
  const today = todayIso();
  // O estado comercial vive no app (vínculo único com Cadastro, Operação e Carteira).
  const setState = onState;
  const cedents = useCedents();
  const titles = useMemo(() => portfolioTitles(operations), [operations]);
  const repPortfolio = useMemo(() => portfolioByRep(titles, state, today), [titles, state, today]);

  const [tab, setTab] = useState<Tab>("painel");
  const [toast, setToast] = useState<Toast>(null);
  const [period, setPeriod] = useState<Period>("mes");
  const [custom, setCustom] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const [repFilter, setRepFilter] = useState("");
  const [modal, setModal] = useState<
    | null
    | { type: "visit"; visit?: Visit }
    | { type: "committee"; committee?: Committee; preset?: Partial<Committee> }
    | { type: "rep"; rep?: SalesRep }
    | { type: "rules" }
    | { type: "transfer"; link: ClientLink }
    | { type: "prospect" }
    | { type: "convert"; prospect: Prospect }
    | { type: "lost"; prospect: Prospect }
  >(null);

  const apply = (r: CResult) => {
    if (r.error) {
      setToast({ tone: "error", text: r.error });
      return false;
    }
    setState(r.state);
    if (r.message) setToast({ tone: "success", text: r.message });
    return true;
  };
  const { from, to } = useMemo(() => {
    const m = monthOf(today);
    if (period === "mes") return { from: `${m}-01`, to: today };
    if (period === "anterior") return { from: `${shiftMonth(m, -1)}-01`, to: monthEnd(shiftMonth(m, -1)) };
    if (period === "90d") return { from: addDays(today, -89), to: today };
    if (period === "ano") return { from: `${today.slice(0, 4)}-01-01`, to: today };
    return custom;
  }, [period, custom, today]);
  const live = useMemo(() => liveDeals(state, operations, financials, today), [state, operations, financials, today]);
  const deals = useMemo(
    () => [...state.deals, ...live].sort((a, b) => a.date.localeCompare(b.date)),
    [state.deals, live],
  );
  const metrics = useMemo(() => repMetrics(state, deals, from, to, today), [state, deals, from, to, today]);
  const shown = metrics.filter(m => !repFilter || m.rep.id === repFilter);
  const repName = (id: string) => state.reps.find(r => r.id === id)?.name ?? "—";
  const repOf = (id: string) => state.reps.find(r => r.id === id);
  const sum = <K extends keyof (typeof metrics)[number]>(k: K) =>
    shown.reduce((s, m) => s + (typeof m[k] === "number" ? (m[k] as number) : 0), 0);
  const periodDeals = deals.filter(d => inRange(d.date, from, to) && (!repFilter || d.repId === repFilter));
  const commissionInRange = useMemo(() => {
    let total = 0,
      m = monthOf(from);
    while (m <= monthOf(to)) {
      const closed = state.closings[m];
      total += (closed ? closed.lines : computeCommission(state, deals, m))
        .filter(l => !repFilter || l.repId === repFilter)
        .reduce((s, l) => s + l.total, 0);
      m = shiftMonth(m, 1);
    }
    return round2(total);
  }, [state, deals, from, to, repFilter]);

  const overdueVisits = state.visits.filter(
    v => v.status === "Agendada" && v.date < today && (!repFilter || v.repId === repFilter),
  );
  const pauta = state.committees
    .filter(c => c.status === "Em pauta" && (!repFilter || c.repId === repFilter))
    .sort((a, b) => a.date.localeCompare(b.date));
  const idle = shown.flatMap(m =>
    m.idle.map(l => ({ link: l, last: deals.filter(d => digits(d.document) === digits(l.document)).at(-1)?.date })),
  );
  const waitingFirst = state.links.filter(
    l => (!repFilter || l.repId === repFilter) && !firstDealDate(deals, l.document) && daysBetween(l.since, today) > 5,
  );

  const tabs: [Tab, string, number?][] = [
    ["painel", "Painel"],
    ["comerciais", "Comerciais e carteira"],
    ["negocios", "Negócios realizados"],
    ["contas", "Contas novas"],
    ["visitas", "Visitas", overdueVisits.length],
    ["funil", "Funil"],
    ["comites", "Comitês", pauta.length],
    ["comissoes", "Comissões"],
  ];

  return (
    <div className="page-wrap fn-page cm-page">
      <div className="fn-heading">
        <div>
          <span className="hd-eyebrow">
            <BriefcaseIcon /> COMERCIAL
          </span>
          <h1>Comercial</h1>
          <p>
            Produtividade, carteira, visitas, comitês e comissão de cada comercial, a partir das operações dos clientes
            vinculados.
          </p>
        </div>
        <div className="fn-heading-actions">
          <label className="company-scope">
            <span>COMERCIAL</span>
            <select value={repFilter} onChange={e => setRepFilter(e.target.value)}>
              <option value="">Todos os comerciais</option>
              {state.reps.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {tab !== "comissoes" && (
            <label className="company-scope cm-period">
              <span>PERÍODO</span>
              <select value={period} onChange={e => setPeriod(e.target.value as Period)}>
                <option value="mes">Este mês</option>
                <option value="anterior">Mês anterior</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="ano">Ano até hoje</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
          )}
          {period === "custom" && tab !== "comissoes" && (
            <div className="cm-custom">
              <input
                type="date"
                value={custom.from}
                onChange={e => setCustom({ ...custom, from: e.target.value })}
                aria-label="De"
              />
              <input
                type="date"
                value={custom.to}
                onChange={e => setCustom({ ...custom, to: e.target.value })}
                aria-label="Até"
              />
            </div>
          )}
        </div>
      </div>
      <nav className="fn-tabs" aria-label="Seções do comercial">
        {tabs.map(([id, label, badge]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
            {badge ? <b>{badge}</b> : null}
          </button>
        ))}
      </nav>
      {toast && (
        <div className={`fn-toast ${toast.tone}`} role="status">
          {toast.tone === "error" ? <AlertIcon /> : <CheckIcon />}
          <span>{toast.text}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <CloseIcon />
          </button>
        </div>
      )}

      {tab === "painel" && (
        <>
          <div className="fn-kpis">
            <div>
              <span>Receita gerada</span>
              <strong>{compact(sum("revenue"))}</strong>
              <small>
                {pct(sum("goal") ? (sum("revenue") / sum("goal")) * 100 : 0)} da meta de {compact(sum("goal"))}
              </small>
            </div>
            <div>
              <span>Negócios realizados</span>
              <strong>{sum("deals")}</strong>
              <small>{compact(sum("face"))} em volume</small>
            </div>
            <div>
              <span>Contas novas</span>
              <strong>{shown.reduce((s, m) => s + m.newAccounts.length, 0)}</strong>
              <small>{shown.reduce((s, m) => s + m.activated.length, 0)} ativada(s) com 1ª operação</small>
            </div>
            <div>
              <span>Visitas realizadas</span>
              <strong>{sum("visitsDone")}</strong>
              <small>
                {
                  state.visits.filter(
                    v => v.status === "Agendada" && v.date >= today && (!repFilter || v.repId === repFilter),
                  ).length
                }{" "}
                agendada(s) a partir de hoje
              </small>
            </div>
            <div>
              <span>Comitês</span>
              <strong>
                {sum("committeesApproved")} <em className="cm-kpi-sub">aprov.</em>
              </strong>
              <small>
                {sum("committeesRejected")} reprovado(s) · {pauta.length} em pauta
              </small>
            </div>
            <div>
              <span>Comissão do período</span>
              <strong>{compact(commissionInRange)}</strong>
              <small>{period === "mes" ? "Prévia · mês em andamento" : "Apurada por competência"}</small>
            </div>
          </div>
          <div className="cm-grid">
            <section className="fn-card cm-span2">
              <header className="fn-card-head">
                <div>
                  <h2>Ranking dos comerciais</h2>
                  <p>
                    {br(from)} a {br(to)} · negócios contam para o comercial vinculado ao cliente na data da operação
                  </p>
                </div>
              </header>
              <div className="fn-table-scroll">
                <table className="fn-table">
                  <thead>
                    <tr>
                      <th>Comercial</th>
                      <th className="num">Contas novas</th>
                      <th className="num">Visitas</th>
                      <th className="num">Comitês</th>
                      <th className="num">Negócios</th>
                      <th className="num">Volume</th>
                      <th className="num">Receita</th>
                      <th className="num">Taxa média</th>
                      <th>Meta de receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shown]
                      .sort((a, b) => b.revenue - a.revenue)
                      .map(m => (
                        <tr
                          key={m.rep.id}
                          className="cm-click"
                          onClick={() => {
                            setRepFilter(m.rep.id);
                            setTab("comerciais");
                          }}
                        >
                          <td>
                            <div className="cm-rep">
                              <Avatar rep={m.rep} />
                              <div>
                                <b>{m.rep.name}</b>
                                <small>
                                  {m.rep.role}
                                  {m.rep.kind === "Agente autônomo" ? " · agente" : ""}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td className="num">
                            {m.newAccounts.length}
                            <small>{m.activated.length} ativada(s)</small>
                          </td>
                          <td className="num">
                            {m.visitsDone}
                            <small>{m.visitsPlanned} agendada(s)</small>
                          </td>
                          <td className="num">
                            {m.committeesApproved}
                            <small>{m.committeesPending} em pauta</small>
                          </td>
                          <td className="num">
                            {m.deals}
                            <small>{m.clients} cliente(s)</small>
                          </td>
                          <td className="num">
                            {compact(m.face)}
                            <small>ticket {compact(m.ticket)}</small>
                          </td>
                          <td className="num">
                            <b>{money(m.revenue)}</b>
                          </td>
                          <td className="num">{m.avgRate ? `${m.avgRate.toFixed(2).replace(".", ",")}%` : "—"}</td>
                          <td>
                            <Meter value={m.attainment} goalLabel={`Meta ${money(m.goal)}`} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="fn-card">
              <header className="fn-card-head">
                <div>
                  <h2>Receita por mês</h2>
                  <p>{repFilter ? repName(repFilter) : "Todos os comerciais"} · últimos 6 meses</p>
                </div>
              </header>
              <RevenueChart
                data={Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(today), i - 5)).map(month => ({
                  month,
                  partial: month === monthOf(today),
                  revenue: round2(
                    deals
                      .filter(d => monthOf(d.date) === month && (!repFilter || d.repId === repFilter))
                      .reduce((s, d) => s + d.revenue, 0),
                  ),
                  goal: state.reps
                    .filter(r => r.active && (!repFilter || r.id === repFilter))
                    .reduce((s, r) => s + r.monthlyGoal, 0),
                }))}
              />
            </section>
            <section className="fn-card">
              <header className="fn-card-head">
                <div>
                  <h2>Precisa de atenção</h2>
                  <p>O que o gestor comercial deve cobrar hoje</p>
                </div>
              </header>
              <ul className="cm-alerts">
                {overdueVisits.length > 0 && (
                  <li className="bad" {...pressable(() => setTab("visitas"))}>
                    <AlertIcon />
                    <div>
                      <b>{overdueVisits.length} visita(s) sem registro</b>
                      <small>
                        {overdueVisits
                          .map(v => `${v.target} (${repOf(v.repId)?.initials}, ${br(v.date).slice(0, 5)})`)
                          .join(" · ")}
                      </small>
                    </div>
                  </li>
                )}
                {pauta.length > 0 && (
                  <li {...pressable(() => setTab("comites"))}>
                    <ClockIcon />
                    <div>
                      <b>{pauta.length} pedido(s) na pauta do comitê</b>
                      <small>
                        Próximo: {br(pauta[0].date)} ·{" "}
                        {pauta
                          .slice(0, 3)
                          .map(c => c.clientName)
                          .join(", ")}
                      </small>
                    </div>
                  </li>
                )}
                {waitingFirst.length > 0 && (
                  <li className="warn" {...pressable(() => setTab("contas"))}>
                    <AlertIcon />
                    <div>
                      <b>{waitingFirst.length} conta(s) nova(s) sem 1ª operação</b>
                      <small>
                        {waitingFirst.map(l => `${l.clientName} · ${daysBetween(l.since, today)} dias`).join(" · ")}
                      </small>
                    </div>
                  </li>
                )}
                {idle.length > 0 && (
                  <li className="warn" {...pressable(() => setTab("comerciais"))}>
                    <AlertIcon />
                    <div>
                      <b>{idle.length} cliente(s) sem operar há mais de 30 dias</b>
                      <small>
                        {idle
                          .map(i => `${i.link.clientName} (${i.last ? `${daysBetween(i.last, today)} dias` : "nunca"})`)
                          .join(" · ")}
                      </small>
                    </div>
                  </li>
                )}
                {period === "mes" &&
                  shown
                    .filter(m => m.attainment < 80)
                    .map(m => {
                      const left = daysBetween(today, monthEnd(monthOf(today)));
                      const gap = Math.max(0, m.rep.monthlyGoal - m.revenue);
                      return (
                        <li key={m.rep.id} {...pressable(() => setTab("comerciais"))}>
                          <Avatar rep={m.rep} small />
                          <div>
                            <b>
                              {m.rep.name} em {pct(m.attainment)} da meta
                            </b>
                            <small>
                              Faltam {money(gap)} em {left} dia(s) · pipeline de {compact(m.pipeline)}
                            </small>
                          </div>
                        </li>
                      );
                    })}
                {!overdueVisits.length && !pauta.length && !waitingFirst.length && !idle.length && (
                  <li className="ok">
                    <CheckIcon />
                    <div>
                      <b>Nada pendente</b>
                    </div>
                  </li>
                )}
              </ul>
            </section>
            <section className="fn-card cm-span2">
              <header className="fn-card-head">
                <div>
                  <h2>Funil de novas contas</h2>
                  <p>Oportunidades abertas por etapa · potencial mensal de volume</p>
                </div>
                <button className="fn-btn ghost small" onClick={() => setTab("funil")}>
                  Abrir funil
                </button>
              </header>
              <div className="cm-funnel">
                {funnelStages.map((s, i) => {
                  const list = state.prospects.filter(
                    p => p.stage === s && !p.lost && (!repFilter || p.repId === repFilter),
                  );
                  const max = Math.max(
                    1,
                    ...funnelStages.map(
                      x =>
                        state.prospects.filter(p => p.stage === x && !p.lost && (!repFilter || p.repId === repFilter))
                          .length,
                    ),
                  );
                  return (
                    <div key={s}>
                      <span>{s}</span>
                      <div className="cm-funnel-bar">
                        <i style={{ width: `${(list.length / max) * 100}%`, opacity: 1 - i * 0.12 }} />
                      </div>
                      <b>{list.length}</b>
                      <small>{compact(list.reduce((a, p) => a + p.potential, 0))}</small>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "comerciais" && (
        <CarteiraTab
          repPortfolio={repPortfolio}
          cedents={cedents}
          titles={titles}
          onNavigate={onNavigate}
          state={state}
          deals={deals}
          metrics={metrics}
          repFilter={repFilter}
          setRepFilter={setRepFilter}
          today={today}
          onEdit={rep => setModal({ type: "rep", rep })}
          onNew={() => setModal({ type: "rep" })}
          onTransfer={link => setModal({ type: "transfer", link })}
        />
      )}

      {tab === "negocios" && (
        <DealsTab
          deals={periodDeals}
          state={state}
          from={from}
          to={to}
          operations={operations}
          onOpenOperation={onOpenOperation}
        />
      )}

      {tab === "contas" && (
        <NewAccountsTab
          state={state}
          deals={deals}
          metrics={shown}
          from={from}
          to={to}
          today={today}
          repFilter={repFilter}
          onCommittee={preset => setModal({ type: "committee", preset })}
        />
      )}

      {tab === "visitas" && (
        <VisitsTab
          state={state}
          from={from}
          to={to}
          today={today}
          repFilter={repFilter}
          onNew={() => setModal({ type: "visit" })}
          onRecord={visit => setModal({ type: "visit", visit })}
        />
      )}

      {tab === "funil" && (
        <FunnelTab
          state={state}
          repFilter={repFilter}
          today={today}
          onApply={apply}
          onNew={() => setModal({ type: "prospect" })}
          onLost={prospect => setModal({ type: "lost", prospect })}
          onConvert={prospect => setModal({ type: "convert", prospect })}
          onCommittee={p =>
            setModal({
              type: "committee",
              preset: { clientName: p.name, repId: p.repId, request: "Limite inicial", requested: p.potential },
            })
          }
        />
      )}

      {tab === "comites" && (
        <CommitteesTab
          state={state}
          pauta={pauta}
          repFilter={repFilter}
          from={from}
          to={to}
          onNew={() => setModal({ type: "committee" })}
          onDecide={committee => setModal({ type: "committee", committee })}
        />
      )}

      {tab === "comissoes" && (
        <CommissionsTab
          state={state}
          deals={deals}
          repFilter={repFilter}
          today={today}
          finance={finance}
          onFinance={onFinance}
          onApply={apply}
          onToast={setToast}
          onRules={() => setModal({ type: "rules" })}
        />
      )}

      {modal?.type === "visit" && (
        <VisitModal
          state={state}
          visit={modal.visit}
          defaultRep={repFilter}
          onClose={() => setModal(null)}
          onApply={apply}
        />
      )}
      {modal?.type === "committee" && (
        <CommitteeModal
          state={state}
          committee={modal.committee}
          preset={modal.preset}
          onClose={() => setModal(null)}
          onApply={apply}
        />
      )}
      {modal?.type === "rep" && (
        <RepModal state={state} rep={modal.rep} onClose={() => setModal(null)} onApply={apply} />
      )}
      {modal?.type === "rules" && <RulesModal state={state} onClose={() => setModal(null)} onApply={apply} />}
      {modal?.type === "transfer" && (
        <TransferModal state={state} link={modal.link} onClose={() => setModal(null)} onApply={apply} />
      )}
      {modal?.type === "prospect" && (
        <ProspectModal state={state} defaultRep={repFilter} onClose={() => setModal(null)} onApply={apply} />
      )}
      {modal?.type === "convert" && (
        <ConvertModal state={state} prospect={modal.prospect} onClose={() => setModal(null)} onApply={apply} />
      )}
      {modal?.type === "lost" && (
        <LostModal state={state} prospect={modal.prospect} onClose={() => setModal(null)} onApply={apply} />
      )}
      <p className="fn-note cm-foot">
        Dados comerciais de demonstração gerados a partir de hoje. As operações liberadas ao financeiro no workspace
        entram como negócios do comercial do cliente.{" "}
        <button
          className="fn-btn link"
          onClick={() => {
            if (window.confirm("Restaurar os dados comerciais de demonstração?")) {
              setState(seedCommercial());
              setToast({ tone: "success", text: "Dados comerciais restaurados." });
            }
          }}
        >
          Restaurar demonstração
        </button>
      </p>
    </div>
  );
}
