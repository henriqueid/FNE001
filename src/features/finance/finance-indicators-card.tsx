"use client";
/**
 * Indicadores financeiros do mês no Financeiro: DRE gerencial (receitas, despesas, resultado
 * e margem), spread da taxa de compra sobre o custo de captação informado na política e giro
 * da carteira (volume comprado no mês ÷ carteira em aberto).
 */
import { type Operation } from "@/src/domain/core/types";
import { type FinanceState } from "@/src/domain/finance/model";
import { isLive, operationDate, portfolioTitles } from "@/src/domain/home/metrics";
import { financeIndicators } from "@/src/domain/indicators/finance";
import { originationIndicators } from "@/src/domain/indicators/origination";
import { compact } from "@/src/features/finance/finance-ui";
import { fmtPct, IndicatorGrid } from "@/src/features/indicators/indicator-grid";

export function FinanceIndicatorsCard({
  state,
  scope,
  operations,
  today,
}: {
  state: FinanceState;
  scope: string;
  operations: Operation[];
  today: string;
}) {
  const from = `${today.slice(0, 8)}01`;
  const scoped = operations.filter(op => scope === "Consolidado" || op.vehicle === scope);
  const month = scoped.filter(
    op => isLive(op) && operationDate(op, today) >= from && operationDate(op, today) <= today,
  );
  const o = originationIndicators(month, op => operationDate(op, today));
  const volume = o.volume;
  const portfolio = portfolioTitles(scoped).reduce((s, t) => s + t.amount, 0);
  const f = financeIndicators(state, scope, from, today, o.rate, o.fundingCost, volume, portfolio);
  return (
    <section className="fn-card lx-ind-card">
      <header className="fn-card-head">
        <div>
          <h2>Resultado e rentabilidade do mês</h2>
          <p>De {from.split("-").reverse().join("/")} até hoje · DRE gerencial pela contabilidade do STRATO</p>
        </div>
      </header>
      <IndicatorGrid
        columns={5}
        items={[
          {
            label: "Receitas",
            value: compact(f.revenue),
            caption: f.topRevenues.map(r => r.name).join(", ") || "sem receitas lançadas",
            source: "Contas de receita do balancete no mês (DRE)",
          },
          {
            label: "Despesas",
            value: compact(f.expense),
            caption: f.topExpenses.map(r => r.name).join(", ") || "sem despesas lançadas",
            source: "Contas de despesa do balancete no mês (DRE)",
          },
          {
            label: "Resultado",
            value: compact(f.result),
            caption:
              f.revenue > 0 && Math.abs(f.margin) <= 100
                ? `margem ${fmtPct(f.margin)}`
                : f.result < 0
                  ? "despesas acima das receitas no mês"
                  : "sem despesas no mês",
            tone: f.result >= 0 ? "good" : "bad",
            source: "Receitas − despesas do mês (DRE)",
          },
          {
            label: "Spread sobre captação",
            value: o.count ? `${fmtPct(f.spread, 2)} a.m.` : "—",
            caption: `compra ${fmtPct(o.rate, 2)} − captação ${fmtPct(f.fundingCost, 2)} a.m.`,
            tone: o.count ? (f.spread > 0 ? "good" : "bad") : "",
            source: "Taxa efetiva total (all-in) das operações do mês menos o custo de captação da modalidade",
          },
          {
            label: "Giro da carteira",
            value: `${f.turnover.toFixed(2).replace(".", ",")}×`,
            caption: `${compact(volume)} comprados ÷ ${compact(portfolio)} em carteira`,
            source: "Volume das operações do mês ÷ carteira em aberto",
          },
        ]}
      />
    </section>
  );
}
