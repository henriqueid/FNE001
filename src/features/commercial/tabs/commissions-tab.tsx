"use client";

/**
 * Apuração de comissões por competência: prévia, fechamento, envio ao financeiro e situação do pagamento.
 */
import { closeCommission, commercialToCsv, reopenCommission } from "@/src/domain/commercial/actions";
import { monthEnd, monthLabel, monthOf, shiftMonth, stamp } from "@/src/domain/commercial/calendar";
import { computeCommission, repAt } from "@/src/domain/commercial/rules";
import { type CResult, type CommercialState, type CommissionLine, type Deal } from "@/src/domain/commercial/types";
import type { FinanceState } from "@/src/domain/finance/model";
import { addCategory, addChartAccount } from "@/src/domain/finance/setup";
import { createTitle } from "@/src/domain/finance/titles";
import { commissionPayments } from "@/src/domain/registry/registry";
import { Avatar, Meter, type Toast, downloadCsv } from "@/src/features/commercial/commercial-ui";
import { BY, br, compact, money } from "@/src/features/finance/finance-ui";
import { CheckIcon, ClockIcon } from "@/src/ui/icons";
import { Fragment, useState } from "react";

export function CommissionsTab({
  state,
  deals,
  repFilter,
  today,
  finance,
  onFinance,
  onApply,
  onToast,
  onRules,
}: {
  state: CommercialState;
  deals: Deal[];
  repFilter: string;
  today: string;
  finance: FinanceState;
  onFinance: (s: FinanceState) => void;
  onApply: (r: CResult) => boolean;
  onToast: (t: Toast) => void;
  onRules: () => void;
}) {
  const current = monthOf(today);
  const [month, setMonth] = useState(shiftMonth(current, -1));
  const [open, setOpen] = useState<string | null>(null);
  const closing = state.closings[month];
  const lines: CommissionLine[] = (closing ? closing.lines : computeCommission(state, deals, month)).filter(
    l => !repFilter || l.repId === repFilter,
  );
  const rules = closing?.rules ?? state.rules;
  const rep = (id: string) => state.reps.find(r => r.id === id);
  const total = lines.reduce((s, l) => s + l.total, 0);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i));

  function sendToFinance() {
    if (!closing) return;
    let s = finance;
    const step = (r: { state: FinanceState; error?: string }) => {
      if (r.error) throw new Error(r.error);
      s = r.state;
    };
    try {
      let cat = s.categories.find(c => /comiss/i.test(c.name) && c.kind === "Despesa");
      if (!cat) {
        let ledger = s.chart.find(c => c.analytic && c.nature === "Despesa" && /comiss/i.test(c.name));
        if (!ledger && s.chartOrigin !== "importado" && !s.chart.some(c => c.code === "5.1.12")) {
          step(addChartAccount(s, { code: "5.1.12", name: "Comissões comerciais", nature: "Despesa" }));
          ledger = s.chart.find(c => c.code === "5.1.12");
        }
        ledger ??=
          s.chart.find(c => c.analytic && c.nature === "Despesa" && /terceiros/i.test(c.name)) ??
          s.chart.find(c => c.analytic && c.nature === "Despesa");
        if (!ledger) throw new Error("O plano de contas não tem conta analítica de despesa para a comissão.");
        step(
          addCategory(s, {
            name: "Comissões comerciais",
            kind: "Despesa",
            ledgerCode: ledger.code,
            group: "Comercial",
          }),
        );
        cat = s.categories.find(c => c.name === "Comissões comerciais");
      }
      const due = `${shiftMonth(month, 1)}-10`;
      const before = new Set(s.titles.map(t => t.id));
      closing.lines
        .filter(l => l.total > 0)
        .forEach(l => {
          const r = rep(l.repId)!;
          step(
            createTitle(
              s,
              {
                kind: "Pagar",
                description: `Comissão ${monthLabel(month)} · ${r.name}`,
                counterparty: r.name,
                counterpartyDocument: r.document,
                categoryId: cat!.id,
                company: r.company,
                competenceDate: monthEnd(month),
                dueDate: due < today ? today : due,
                amount: l.total,
              },
              BY,
            ),
          );
        });
      const ids = s.titles.filter(t => !before.has(t.id)).map(t => t.id);
      onFinance(s);
      onApply({
        state: {
          ...state,
          closings: {
            ...state.closings,
            [month]: { ...closing, status: "Enviada ao financeiro", sentAt: stamp(), financeTitles: ids },
          },
        },
        message: `${ids.length} lançamento(s) a pagar criados no Financeiro, vencimento ${br(due < today ? today : due)}.`,
      });
    } catch (e) {
      onToast({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }
  const exportCsv = () =>
    downloadCsv(
      `comissoes-${month}.csv`,
      commercialToCsv([
        [
          "competencia",
          "comercial",
          "documento",
          "negocios",
          "base",
          "meta",
          "atingimento_pct",
          "percentual",
          "comissao",
          "bonus_contas_novas",
          "estorno_recompra",
          "total",
        ],
        ...lines.map(l => [
          month,
          rep(l.repId)?.name ?? "",
          rep(l.repId)?.document ?? "",
          l.deals,
          l.base,
          l.goal,
          l.attainment,
          l.rate,
          l.commission,
          l.bonus,
          l.clawback,
          l.total,
        ]),
      ]),
    );

  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Apuração de comissões</h2>
          <p>
            Base: {rules.base === "receita" ? "receita (deságio + tarifas)" : "volume operado"} · faixas{" "}
            {rules.tiers.map(t => `${t.from}%→${String(t.rate).replace(".", ",")}%`).join(", ")} · bônus de{" "}
            {money(rules.newAccountBonus)} por conta nova ativada{rules.clawback ? " · estorno de recompras" : ""}
          </p>
        </div>
        <div className="fn-head-actions">
          <select className="cm-select" value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {state.closings[m]
                  ? state.closings[m].status === "Fechada"
                    ? " · fechada"
                    : " · enviada"
                  : m === current
                    ? " · prévia"
                    : ""}
              </option>
            ))}
          </select>
          <button className="fn-btn ghost" onClick={onRules}>
            Regras
          </button>
          <button className="fn-btn ghost" onClick={exportCsv}>
            Exportar CSV
          </button>
          {!closing && (
            <button
              className="fn-btn primary"
              disabled={month >= current}
              title={month >= current ? "O mês corrente é uma prévia" : ""}
              onClick={() => onApply(closeCommission(state, deals, month, BY))}
            >
              Fechar competência
            </button>
          )}
          {closing?.status === "Fechada" && (
            <>
              <button className="fn-btn ghost" onClick={() => onApply(reopenCommission(state, month))}>
                Reabrir
              </button>
              <button className="fn-btn primary" onClick={sendToFinance}>
                Enviar ao financeiro
              </button>
            </>
          )}
        </div>
      </header>
      <div className={`cm-status ${closing ? (closing.status === "Fechada" ? "closed" : "sent") : "open"}`}>
        {closing ? (
          closing.status === "Fechada" ? (
            <>
              <CheckIcon /> Fechada por {closing.closedBy} em {closing.closedAt}. Os valores não mudam mais, mesmo que
              as regras mudem.
            </>
          ) : (
            <>
              <CheckIcon /> Enviada ao financeiro em {closing.sentAt}.{" "}
              {(() => {
                const pays = commissionPayments(finance, closing.financeTitles);
                const paid = pays.filter(p => p.status === "Baixado");
                return `${paid.length} de ${pays.length} paga(s) na tesouraria · ${money(pays.filter(p => p.status === "Em aberto").reduce((t, p) => t + p.amount, 0))} a pagar.`;
              })()}
            </>
          )
        ) : month >= current ? (
          <>
            <ClockIcon /> Prévia do mês em andamento. Os valores mudam conforme novas operações.
          </>
        ) : (
          <>
            <ClockIcon /> Competência aberta. Confira e feche para gerar os pagamentos.
          </>
        )}
      </div>
      {closing?.status === "Enviada ao financeiro" && (
        <div className="cm-treasury" aria-label="Situação na tesouraria">
          {commissionPayments(finance, closing.financeTitles).map(p => (
            <div key={p.id}>
              <span>
                <b>{p.repName}</b>
                <small>
                  Vence {br(p.dueDate)}
                  {p.settledAt ? ` · paga em ${br(p.settledAt)}` : ""}
                </small>
              </span>
              <b>{money(p.amount)}</b>
              <span className={`fn-chip ${p.status === "Baixado" ? "ok" : p.status === "Cancelado" ? "bad" : "warn"}`}>
                {p.status === "Baixado" ? "Paga" : p.status === "Cancelado" ? "Cancelada" : "A pagar"}
              </span>
            </div>
          ))}
          <small>
            Os pagamentos são baixados em Financeiro › A pagar e a receber (categoria Comissões comerciais).
          </small>
        </div>
      )}
      <div className="fn-table-scroll">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Comercial</th>
              <th className="num">Negócios</th>
              <th className="num">Base</th>
              <th>Meta de receita</th>
              <th className="num">Faixa</th>
              <th className="num">Comissão</th>
              <th className="num">Bônus contas novas</th>
              <th className="num">Estorno recompra</th>
              <th className="num">Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const r = rep(l.repId);
              const mine = deals.filter(d => d.repId === l.repId && monthOf(d.date) === month);
              return (
                <Fragment key={l.repId}>
                  <tr className="cm-click" onClick={() => setOpen(open === l.repId ? null : l.repId)}>
                    <td>
                      <div className="cm-rep">
                        <Avatar rep={r} small />
                        <div>
                          <b>{r?.name}</b>
                          <small>{r?.kind}</small>
                        </div>
                      </div>
                    </td>
                    <td className="num">{l.deals}</td>
                    <td className="num">{money(l.base)}</td>
                    <td>
                      <Meter value={l.attainment} goalLabel={`Meta ${money(l.goal)}`} />
                    </td>
                    <td className="num">
                      {String(l.rate).replace(".", ",")}%<small>{r?.flatRate ? "fixo" : "por meta"}</small>
                    </td>
                    <td className="num">{money(l.commission)}</td>
                    <td className="num">
                      {money(l.bonus)}
                      {l.bonusAccounts.length > 0 && <small>{l.bonusAccounts.join(", ")}</small>}
                    </td>
                    <td className="num">{l.clawback ? <span className="bad">− {money(l.clawback)}</span> : "—"}</td>
                    <td className="num">
                      <b>{money(l.total)}</b>
                    </td>
                  </tr>
                  {open === l.repId && (
                    <tr className="cm-expand">
                      <td colSpan={9}>
                        <p className="cm-memo">
                          Memória de cálculo: base {money(l.base)} × {String(l.rate).replace(".", ",")}% ={" "}
                          {money(l.commission)}
                          {l.bonus
                            ? ` + ${l.bonusAccounts.length} conta(s) nova(s) × ${money(rules.newAccountBonus)}`
                            : ""}
                          {l.clawback ? ` − estorno de ${money(l.clawback)}` : ""} = <b>{money(l.total)}</b>
                        </p>
                        <table className="cm-mini">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Borderô</th>
                              <th>Cliente</th>
                              <th className="num">Face</th>
                              <th className="num">Receita</th>
                              <th className="num">Comissão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mine.map(d => (
                              <tr key={d.id}>
                                <td>{br(d.date)}</td>
                                <td>{d.bordero}</td>
                                <td>{d.clientName}</td>
                                <td className="num">{money(d.face)}</td>
                                <td className="num">
                                  {money(d.revenue)}
                                  {d.repurchased ? (
                                    <small className="bad">recompra {compact(d.repurchased)}</small>
                                  ) : null}
                                </td>
                                <td className="num">
                                  {money(((rules.base === "receita" ? d.revenue : d.face) * l.rate) / 100)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(state.carteiraEvents ?? []).filter(
                          e => monthOf(e.date) === month && repAt(state, e.document, e.date) === l.repId,
                        ).length > 0 && (
                          <p className="cm-memo">
                            Recompras na Carteira que estornam comissão:{" "}
                            {(state.carteiraEvents ?? [])
                              .filter(e => monthOf(e.date) === month && repAt(state, e.document, e.date) === l.repId)
                              .map(e => `${e.clientName} ${compact(e.amount)} (${e.reference})`)
                              .join(" · ")}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8}>Total da competência</td>
              <td className="num">
                <b>{money(total)}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="fn-note">
        Fechar a competência congela os valores. Ao enviar ao financeiro, cada comercial vira um lançamento a pagar na
        categoria “Comissões comerciais”, com vencimento no dia 10 do mês seguinte.
      </p>
    </section>
  );
}
