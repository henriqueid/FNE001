"use client";
/**
 * Indicadores comerciais no Painel: clientes sem operar por faixa de dias (risco de perder o
 * cliente), funil ponderado pela probabilidade de cada etapa (política) e, por comercial,
 * taxa média, receita e qualidade da carteira trazida.
 */
import { repAt } from "@/src/domain/commercial/rules";
import { type CommercialState, type Deal } from "@/src/domain/commercial/types";
import { commercialIndicators } from "@/src/domain/indicators/commercial";
import { type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { compact } from "@/src/features/finance/finance-ui";
import { fmtPct, IndicatorGrid } from "@/src/features/indicators/indicator-grid";

export function CommercialIndicatorsCard({
  state,
  deals,
  today,
  policy,
  repPortfolio,
  repFilter,
}: {
  state: CommercialState;
  deals: Deal[];
  today: string;
  policy: QualityPolicy;
  repPortfolio: { repId: string; open: number; overdue: number }[];
  repFilter: string;
}) {
  const repurchasedByRep: Record<string, number> = {};
  (state.carteiraEvents ?? []).forEach(e => {
    const rep = repAt(state, e.document, e.date);
    if (rep) repurchasedByRep[rep] = (repurchasedByRep[rep] ?? 0) + e.amount;
  });
  const portfolioByRep = Object.fromEntries(
    repPortfolio.map(r => [r.repId, { open: r.open, overdue: r.overdue, repurchased: repurchasedByRep[r.repId] ?? 0 }]),
  );
  const scoped: CommercialState = repFilter
    ? {
        ...state,
        deals: deals.filter(d => d.repId === repFilter),
        links: state.links.filter(l => l.repId === repFilter),
        prospects: state.prospects.filter(p => p.repId === repFilter),
        reps: state.reps.filter(r => r.id === repFilter),
      }
    : { ...state, deals };
  const c = commercialIndicators(scoped, today, policy.indicators, portfolioByRep);
  const [d1, d2, d3] = policy.indicators.inactiveDays;
  const reps = c.byRep.filter(r => r.deals > 0 || r.overdueRate > 0);
  return (
    <section className="fn-card lx-ind-card">
      <header className="fn-card-head">
        <div>
          <h2>Indicadores comerciais</h2>
          <p>Base ativa, funil e qualidade da carteira trazida por comercial · passe o mouse para ver a fonte</p>
        </div>
      </header>
      <IndicatorGrid
        columns={5}
        items={[
          {
            label: `Sem operar ${d1}–${d2} dias`,
            value: String(c.idle1.length),
            caption:
              c.idle1
                .map(x => x.link.clientName)
                .slice(0, 2)
                .join(", ") || "nenhum cliente",
            source: "Clientes ativos pela data do último negócio",
          },
          {
            label: `Sem operar ${d2}–${d3} dias`,
            value: String(c.idle2.length),
            caption:
              c.idle2
                .map(x => x.link.clientName)
                .slice(0, 2)
                .join(", ") || "nenhum cliente",
            tone: c.idle2.length ? "bad" : "",
            source: "Clientes ativos pela data do último negócio",
          },
          {
            label: `Sem operar > ${d3} dias`,
            value: String(c.idle3.length),
            caption: `${c.idle3.filter(x => x.never).length} nunca operaram · de ${c.activeClients} ativos`,
            tone: c.idle3.length ? "bad" : "",
            source: "Clientes ativos sem negócio na janela (ou nunca), faixas da política",
          },
          {
            label: "Funil ponderado",
            value: compact(c.weightedPipeline),
            caption: `potencial bruto ${compact(c.pipeline)}`,
            source: "Potencial de cada oportunidade × probabilidade da etapa (política comercial)",
            manual: true,
          },
          {
            label: "Taxa média dos negócios",
            value: `${fmtPct(
              c.byRep.reduce((s, r) => s + r.rate * r.face, 0) /
                Math.max(
                  1,
                  c.byRep.reduce((s, r) => s + r.face, 0),
                ),
              2,
            )} a.m.`,
            caption: "ponderada pelo valor de face",
            source: "Negócios realizados (todos os períodos)",
          },
        ]}
      />
      {reps.length > 0 && (
        <table className="lx-rep-quality">
          <thead>
            <tr>
              <th>Comercial</th>
              <th>Negócios</th>
              <th>Volume</th>
              <th>Receita</th>
              <th>Taxa média</th>
              <th>Vencido da carteira trazida</th>
              <th>Recompra</th>
            </tr>
          </thead>
          <tbody>
            {reps.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.deals}</td>
                <td>{compact(r.face)}</td>
                <td>{compact(r.revenue)}</td>
                <td>{r.face ? `${fmtPct(r.rate, 2)} a.m.` : "—"}</td>
                <td className={r.overdueRate > 10 ? "bad" : ""}>{fmtPct(r.overdueRate)}</td>
                <td>{fmtPct(r.repurchaseRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
