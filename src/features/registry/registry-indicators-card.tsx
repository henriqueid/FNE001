"use client";
/**
 * Indicadores do Cadastro: revisão cadastral (KYC) vencida ou a vencer em 30 dias, limites
 * com revisão vencida, cedentes sem operar e distribuição do score dos cedentes nas faixas
 * da política de risco.
 */
import { useCedents, useRegistry } from "@/src/app/registry-context";
import { type Operation } from "@/src/domain/core/types";
import { todayIso } from "@/src/domain/finance/ledger";
import { operationDate } from "@/src/domain/home/metrics";
import { registryIndicators } from "@/src/domain/indicators/registry";
import { onlyDigits } from "@/src/domain/registry/parties";
import { fmtDays, IndicatorGrid } from "@/src/features/indicators/indicator-grid";
import { useQualityPolicy } from "@/src/features/risk/use-quality-policy";

export function RegistryIndicatorsCard({ operations }: { operations: Operation[] }) {
  const { parties, commercial } = useRegistry();
  const cedents = useCedents();
  const { policy } = useQualityPolicy();
  const today = todayIso();
  const lastOperation: Record<string, string> = {};
  operations.forEach(op => {
    const key = onlyDigits(op.document);
    const d = operationDate(op, today);
    if (!lastOperation[key] || lastOperation[key] < d) lastOperation[key] = d;
  });
  commercial.deals.forEach(d => {
    const key = onlyDigits(d.document);
    if (!lastOperation[key] || lastOperation[key] < d.date) lastOperation[key] = d.date;
  });
  const score = policy.components.find(c => c.id === "bureauScore");
  const r = registryIndicators(
    parties
      .filter(p => p.status === "Ativo")
      .map(p => ({
        document: p.document,
        name: p.name,
        updatedAt: p.updatedAt,
        isCedent: p.roles.includes("cedente"),
        score: cedents.find(c => onlyDigits(c.document) === onlyDigits(p.document))?.score,
      })),
    commercial.committees,
    lastOperation,
    today,
    policy.indicators,
    { good: score?.good ?? 800, bad: score?.bad ?? 500 },
  );
  const names = (list: { name: string }[]) =>
    list
      .map(p => p.name)
      .slice(0, 2)
      .join(", ");
  return (
    <section className="fn-card lx-ind-card">
      <header className="fn-card-head">
        <div>
          <h2>Saúde do cadastro</h2>
          <p>
            Revisão cadastral a cada {fmtDays(policy.indicators.kycReviewDays)} e de limite a cada{" "}
            {fmtDays(policy.indicators.limitReviewDays)} (política de risco)
          </p>
        </div>
      </header>
      <IndicatorGrid
        columns={5}
        items={[
          {
            label: "Revisão cadastral vencida",
            value: String(r.kycExpired.length),
            caption: names(r.kycExpired) || `de ${r.total} cadastros ativos`,
            tone: r.kycExpired.length ? "bad" : "good",
            source: "Data da última atualização do cadastro × prazo de revisão da política",
          },
          {
            label: "Vence em 30 dias",
            value: String(r.kycSoon.length),
            caption: names(r.kycSoon) || "nenhuma revisão próxima",
            source: "Data da última atualização do cadastro × prazo de revisão da política",
          },
          {
            label: "Limite com revisão vencida",
            value: String(r.limitExpired.length),
            caption: names(r.limitExpired) || "todos revisados no prazo",
            tone: r.limitExpired.length ? "bad" : "good",
            source: "Último comitê aprovado do cedente × prazo de revisão de limite da política",
          },
          {
            label: `Cedentes sem operar > ${policy.indicators.inactiveDays[2]} dias`,
            value: String(r.idle.length),
            caption: names(r.idle) || "todos operando",
            source: "Data da última operação ou negócio do cedente",
          },
          {
            label: "Score dos cedentes",
            value: `${r.score.good} ${r.score.good === 1 ? "bom" : "bons"}`,
            caption: `${r.score.fair} médios · ${r.score.weak} fracos · ${r.score.bad} abaixo do mínimo`,
            tone: r.score.bad ? "bad" : "",
            source: "Score de bureau nas faixas bom/ruim da política de qualidade",
          },
        ]}
      />
    </section>
  );
}
