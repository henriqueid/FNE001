"use client";
/**
 * Extrato da carteira do sacado: KPIs de exposição e as colunas de baixados e em aberto.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Debtor } from "@/src/domain/core/types";
import { type LedgerRow, debtorLedger } from "./risk-model";

function LedgerRows({ rows }: { rows: LedgerRow[] }) {
  return (
    <>
      <div className="portfolio-ledger-head">
        <span>Situação</span>
        <span>Qtd.</span>
        <span>Valor</span>
      </div>
      {rows.map(row => (
        <div className={`portfolio-ledger-row ${row.tone}`} key={row.label}>
          <span>{row.label}</span>
          <b>{row.data.count}</b>
          <strong>{preciseMoney.format(row.data.amount)}</strong>
        </div>
      ))}
    </>
  );
}

export function DebtorPortfolioLedger({ debtor }: { debtor?: Debtor }) {
  const { settledRows, openRows, settledAmount, openCount } = debtorLedger(debtor);
  return (
    <div className="debtor-portfolio-ledger">
      <div className="portfolio-kpis">
        <div>
          <span>EXPOSIÇÃO EM ABERTO</span>
          <strong>{preciseMoney.format(debtor?.portfolioReceivable ?? 0)}</strong>
          <small>Carteira anterior no ambiente</small>
        </div>
        <div>
          <span>ATRASO MÉDIO</span>
          <strong className={(debtor?.averageDelayDays ?? 0) > 7 ? "negative" : "positive"}>
            {debtor?.averageDelayDays ?? 0} dias
          </strong>
          <small>{debtor?.lateSettlements ?? 0} liquidações após o vencimento</small>
        </div>
        <div>
          <span>CONCENTRAÇÃO</span>
          <strong>{(debtor?.portfolioMetrics?.concentrationPercent ?? 0).toFixed(1)}%</strong>
          <small>Participação na carteira do cedente</small>
        </div>
      </div>
      <div className="portfolio-ledger-columns">
        <details>
          <summary>
            <span>
              <b>BAIXADOS</b>
              <small>Histórico liquidado</small>
            </span>
            <strong>
              {debtor?.settlements ?? 0} · {preciseMoney.format(settledAmount)}
            </strong>
          </summary>
          <LedgerRows rows={settledRows} />
          <div className="portfolio-ledger-total">
            <span>Total liquidado</span>
            <b>{debtor?.settlements ?? 0}</b>
            <strong>{preciseMoney.format(settledAmount)}</strong>
          </div>
        </details>
        <details>
          <summary>
            <span>
              <b>EM ABERTO</b>
              <small>Posição atual no ambiente</small>
            </span>
            <strong>
              {openCount} · {preciseMoney.format(debtor?.portfolioReceivable ?? 0)}
            </strong>
          </summary>
          <LedgerRows rows={openRows} />
          <div className="portfolio-ledger-total">
            <span>Total em aberto</span>
            <b>{openCount}</b>
            <strong>{preciseMoney.format(debtor?.portfolioReceivable ?? 0)}</strong>
          </div>
          <div className="portfolio-ledger-concentration">
            <span>+ Concentração do sacado</span>
            <strong>{(debtor?.portfolioMetrics?.concentrationPercent ?? 0).toFixed(1)}%</strong>
          </div>
        </details>
      </div>
    </div>
  );
}
