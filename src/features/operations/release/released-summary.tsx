"use client";

/**
 * Resumo da operação liberada: situação do pagamento e jornada.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";
import { stageCompletionFor } from "@/src/domain/operations/stage-insight";
import { Badge } from "@/src/features/operations/components/status";
import { ArrowIcon, CheckIcon } from "@/src/ui/icons";

export function financeStatusFor(operation: Operation): { label: string; tone: string; detail: string } {
  const payables = (operation.releaseReview?.payables ?? []).filter(item => item.status !== "Cancelado");
  if (!payables.length)
    return { label: "Sem lançamentos", tone: "default", detail: "Nenhum lançamento ativo no financeiro" };
  const paid = payables.filter(item => item.status === "Pago").length;
  if (paid === payables.length) return { label: "Pago", tone: "ready", detail: `${paid} lançamento(s) baixado(s)` };
  if (paid > 0)
    return {
      label: "Pago parcialmente",
      tone: "attention",
      detail: `${paid} de ${payables.length} lançamento(s) pagos`,
    };
  return {
    label: "Pendente de pagamento",
    tone: "waiting",
    detail: `${payables.length} lançamento(s) aguardando o financeiro`,
  };
}

export function ReleasedOperationSummary({
  operation,
  onViewStages,
}: {
  operation: Operation;
  onViewStages: () => void;
}) {
  const pricing = normalizedPricing(operation);
  const calc = pricingCalculation(operation, pricing);
  const offsets = roundPricing(
    repurchaseCalculation(operation, pricing).total + settlementAdjustmentCalculation(operation, pricing).total,
  );
  const face = calc.face || operation.amount;
  const net = operation.pricingReview ? roundPricing(calc.net - offsets) : operation.netAmount;
  const revenue =
    calc.face > 0 ? calc.originalDiscount + calc.fees : Math.max(0, operation.amount - operation.netAmount);
  const finalRate = calc.face > 0 && calc.allInMonthly > 0 ? calc.allInMonthly : pricing.monthlyRate;
  const term = Math.round(calc.weightedTerm);
  const release = operation.releaseReview;
  const payables = release?.payables ?? [];
  const activePayables = payables.filter(item => item.status !== "Cancelado");
  const toPay = activePayables.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = activePayables.filter(item => item.status === "Pago").reduce((sum, item) => sum + item.amount, 0);
  const finance = financeStatusFor(operation);
  const approvals = operation.approvalReview?.approvals ?? [];
  const signatures = operation.approvalReview?.signatures ?? [];
  const manualSignatures = signatures.filter(item => item.method === "Manual").length;
  const journey = stages.map(stage => ({ stage, completion: stageCompletionFor(operation, stage.id) }));
  const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;
  return (
    <section className="released-summary">
      <div className="released-hero">
        <div className="released-hero-main">
          <span className="released-eyebrow">
            <CheckIcon /> OPERAÇÃO LIBERADA AO FINANCEIRO
          </span>
          <h2>{preciseMoney.format(toPay || net)}</h2>
          <p>
            Liberada em {release?.releasedAt ?? "—"} por {release?.releasedBy ?? "—"} · pagamento previsto para{" "}
            {formatBrazilianDate(release?.paymentDate)}
          </p>
        </div>
        <div className="released-finance">
          <span>STATUS NO FINANCEIRO</span>
          <Badge tone={finance.tone}>{finance.label}</Badge>
          <small>{finance.detail}</small>
          <small>
            Pago: {preciseMoney.format(paidTotal)} de {preciseMoney.format(toPay)}
          </small>
        </div>
      </div>
      <div className="released-kpis">
        <div>
          <span>VALOR DE FACE</span>
          <strong>{preciseMoney.format(face)}</strong>
          <small>{operation.titleCount} recebíveis</small>
        </div>
        <div>
          <span>LÍQUIDO LIBERADO</span>
          <strong>{preciseMoney.format(net)}</strong>
          <small>Borderô {operation.borderoNumber}</small>
        </div>
        <div>
          <span>RECEITA</span>
          <strong className="positive">{preciseMoney.format(revenue)}</strong>
          <small>{face ? pct((revenue / face) * 100) : "0,00%"} sobre a face</small>
        </div>
        <div>
          <span>TAXA EFETIVA</span>
          <strong>{pct(finalRate)} a.m.</strong>
          <small>Base {pct(pricing.monthlyRate)} a.m.</small>
        </div>
        <div>
          <span>PRAZO MÉDIO</span>
          <strong>{term > 0 ? `${term} dias` : "—"}</strong>
          <small>{pricing.method}</small>
        </div>
      </div>
      <div className="released-grid">
        <section className="approval-card">
          <div className="approval-card-head">
            <div>
              <span>RESUMO GERAL</span>
              <strong>Dados da operação</strong>
            </div>
          </div>
          <dl className="released-facts">
            <div>
              <dt>Cedente</dt>
              <dd>
                {operation.cedent}
                <small>{operation.document}</small>
              </dd>
            </div>
            <div>
              <dt>Veículo</dt>
              <dd>
                {operation.vehicle}
                <small>
                  {operation.institution}
                  {operation.fundClass ? ` · ${operation.fundClass}` : ""}
                </small>
              </dd>
            </div>
            <div>
              <dt>Aditivo / borderô</dt>
              <dd>
                {operation.aditivoNumber}
                <small>Borderô {operation.borderoNumber}</small>
              </dd>
            </div>
            {operation.source && (
              <div>
                <dt>Origem e tipo</dt>
                <dd>
                  {operation.source}
                  <small>{operation.operationType ?? "—"}</small>
                </dd>
              </div>
            )}
            <div>
              <dt>Política</dt>
              <dd>
                {operation.policy}
                <small>Risco {operation.risk}</small>
              </dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>
                {operation.owner}
                <small>Entrada: {operation.enteredAt}</small>
              </dd>
            </div>
            <div>
              <dt>Composição do líquido</dt>
              <dd>
                {preciseMoney.format(face)} de face → {preciseMoney.format(net)} líquido
                <small>
                  {calc.face > 0
                    ? `− deságio ${preciseMoney.format(calc.originalDiscount)} · tarifas ${preciseMoney.format(calc.fees)} · impostos ${preciseMoney.format(calc.iof)} · retenções ${preciseMoney.format(calc.guarantee + pricing.manualRetention)} · compensações ${preciseMoney.format(offsets)}`
                    : `− deságio e tarifas ${preciseMoney.format(revenue)} (condição registrada na origem)`}
                </small>
              </dd>
            </div>
            <div>
              <dt>Aprovação</dt>
              <dd>
                {approvals.length
                  ? `${approvals.filter(item => item.status === "Aprovado").length}/${approvals.length} alçada(s) aprovada(s)`
                  : "Alçadas registradas na etapa"}
                <small>
                  {signatures.length
                    ? `${signatures.filter(item => item.status === "Assinado").length}/${signatures.length} assinatura(s) · ${manualSignatures} manual(is)`
                    : "Assinaturas registradas na etapa"}
                </small>
              </dd>
            </div>
          </dl>
        </section>
        <section className="approval-card">
          <div className="approval-card-head">
            <div>
              <span>FINANCEIRO</span>
              <strong>Lançamentos a pagar</strong>
            </div>
            <small>Baixa e estorno somente pelo financeiro</small>
          </div>
          <div className="released-payables">
            {activePayables.length ? (
              activePayables.map(item => (
                <div key={`${item.id}-${item.createdAt}`}>
                  <span>
                    <strong>{item.payee}</strong>
                    <small>
                      {item.id} · {item.method} · {item.destination}
                    </small>
                  </span>
                  <span>
                    <b>{preciseMoney.format(item.amount)}</b>
                    <small>Vence {formatBrazilianDate(item.dueDate)}</small>
                  </span>
                  <Badge tone={item.status === "Pago" ? "ready" : "waiting"}>{item.status}</Badge>
                </div>
              ))
            ) : (
              <p className="released-empty">Nenhum lançamento ativo.</p>
            )}
          </div>
          {release?.observation && (
            <div className="released-note">
              <span>OBSERVAÇÃO ENVIADA</span>
              <p>{release.observation}</p>
            </div>
          )}
          <div className="released-note">
            <span>CONTA PAGADORA</span>
            <p>Definida pelo financeiro no momento do pagamento.</p>
          </div>
        </section>
      </div>
      <section className="approval-card">
        <div className="approval-card-head">
          <div>
            <span>JORNADA</span>
            <strong>Etapas concluídas</strong>
          </div>
          <button className="release-link" onClick={onViewStages}>
            Ver etapas em detalhe <ArrowIcon />
          </button>
        </div>
        <ol className="released-journey">
          {journey.map(({ stage, completion }) => (
            <li key={stage.id} className={completion || stage.id === 6 ? "done" : ""}>
              <i>
                <CheckIcon />
              </i>
              <span>
                <strong>{stage.short}</strong>
                <small>
                  {stage.id === 6
                    ? `Liberada · ${release?.releasedAt ?? "—"} · ${release?.releasedBy ?? ""}`
                    : completion
                      ? `${completion.completedBy} · ${completion.completedAt}`
                      : "Sem registro de conclusão"}
                </small>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="released-actions">
        <button className="secondary-action" onClick={() => window.print()}>
          Imprimir resumo
        </button>
        <button className="primary-action" onClick={onViewStages}>
          Ver etapas em detalhe <ArrowIcon />
        </button>
      </div>
    </section>
  );
}
