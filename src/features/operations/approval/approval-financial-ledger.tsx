"use client";
/**
 * Razão detalhado do resumo financeiro: cartões de negócio, estatísticas,
 * tarifas, impostos, recompras, pagamento e favorecidos — a memória de
 * cálculo que sustenta o líquido do borderô.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { decimal, type FinancialFigures } from "./approval-model";

export function ApprovalFinancialLedger({ operation, figures }: { operation: Operation; figures: FinancialFigures }) {
  return (
    <div className="approval-financial-ledger">
      <BusinessCard figures={figures} />
      <StatisticsCard figures={figures} />
      <FeesCard figures={figures} />
      <TaxesCard operation={operation} figures={figures} />
      <RepurchaseCard figures={figures} />
      <PaymentCard figures={figures} />
      <section className="approval-ledger-card approval-ledger-favored">
        <header>
          <span>FAVORECIDOS</span>
          <strong>Destinatários da liberação</strong>
        </header>
        <div className="ledger-empty">
          <span>Nenhuma conta favorecida vinculada à operação.</span>
          <small>O destino financeiro será definido na formalização ou na liquidação.</small>
        </div>
      </section>
    </div>
  );
}

function LedgerHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header>
      <span>{eyebrow}</span>
      <strong>{title}</strong>
    </header>
  );
}

function BusinessCard({ figures }: { figures: FinancialFigures }) {
  const { calculated, pricing, adValoremTotal, retainedTotal, totalOffsets, finalNet } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="NEGÓCIO" title="Formação do valor a pagar" />
      <div>
        <span>Total de face</span>
        <strong>{preciseMoney.format(calculated.face)}</strong>
      </div>
      <div>
        <span>(−) Deságio</span>
        <em>{calculated.face ? decimal((calculated.originalDiscount / calculated.face) * 100, 4) : "0,0000"}%</em>
        <strong>{preciseMoney.format(calculated.originalDiscount)}</strong>
      </div>
      <div>
        <span>(−) Ad valorem</span>
        <em>{decimal(pricing.adValoremPercent, 4)}%</em>
        <strong>{preciseMoney.format(adValoremTotal)}</strong>
      </div>
      <div>
        <span>(−) Tarifas</span>
        <strong>{preciseMoney.format(calculated.fees)}</strong>
      </div>
      <div>
        <span>(−) Impostos diversos</span>
        <strong>{preciseMoney.format(calculated.iof)}</strong>
      </div>
      <div>
        <span>(−) Retenções</span>
        <strong>{preciseMoney.format(retainedTotal)}</strong>
      </div>
      <div>
        <span>(−) Recompra líquida</span>
        <strong>{preciseMoney.format(totalOffsets)}</strong>
      </div>
      <div className="ledger-total">
        <span>Total a pagar</span>
        <strong>{preciseMoney.format(finalNet)}</strong>
      </div>
    </section>
  );
}

function StatisticsCard({ figures }: { figures: FinancialFigures }) {
  const {
    calculated,
    pricing,
    averageTerm,
    averageFloat,
    averageNetTerm,
    periodFactor,
    realMonthlyFactor,
    suggestedMonthlyFactor,
    projectedRoa,
  } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="ESTATÍSTICAS" title="Indicadores da condição" />
      <div>
        <span>Quantidade de títulos</span>
        <strong>{calculated.titleRows.length}</strong>
      </div>
      <div>
        <span>Prazo médio</span>
        <strong>{averageTerm} dias</strong>
      </div>
      <div>
        <span>D+ operacional</span>
        <strong>{averageFloat} dias</strong>
      </div>
      <div>
        <span>Prazo médio líquido</span>
        <strong>{averageNetTerm} dias</strong>
      </div>
      <div>
        <span>Fator do período</span>
        <strong>{decimal(periodFactor, 6)}%</strong>
      </div>
      <div>
        <span>Fator equivalente a.m.</span>
        <strong>{decimal(pricing.monthlyRate, 6)}%</strong>
      </div>
      <div>
        <span>Fator real a.m.</span>
        <strong>{decimal(realMonthlyFactor, 6)}%</strong>
      </div>
      <div>
        <span>Fator sugerido a.m.</span>
        <strong>{decimal(suggestedMonthlyFactor, 6)}%</strong>
      </div>
      <div>
        <span>Forma de cálculo</span>
        <strong>
          {pricing.method}
          {pricing.vaEnabled ? " · VA" : ""}
        </strong>
      </div>
      <div>
        <span>Taxa efetiva final</span>
        <strong>{decimal(calculated.allInMonthly, 6)}%</strong>
      </div>
      <div className="ledger-total">
        <span>ROA projetado</span>
        <strong>{decimal(projectedRoa, 4)}% a.a.</strong>
      </div>
    </section>
  );
}

function FeesCard({ figures }: { figures: FinancialFigures }) {
  const { calculated, pricing, operationFeeTotal, titleFeeTotal, adValoremTotal } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="TARIFAS" title="Composição detalhada" />
      <div>
        <span>Tarifa por operação</span>
        <strong>{preciseMoney.format(operationFeeTotal)}</strong>
      </div>
      <div>
        <span>Tarifa por título</span>
        <em>
          {calculated.titleRows.length} × {preciseMoney.format(pricing.feePerTitle)}
        </em>
        <strong>{preciseMoney.format(titleFeeTotal)}</strong>
      </div>
      <div>
        <span>Ad valorem</span>
        <em>{decimal(pricing.adValoremPercent, 4)}%</em>
        <strong>{preciseMoney.format(adValoremTotal)}</strong>
      </div>
      {pricing.manualFees?.map(fee => (
        <div key={fee.id}>
          <span>{fee.description}</span>
          <em>Esporádica</em>
          <strong>{preciseMoney.format(fee.amount)}</strong>
        </div>
      ))}
      <div className="ledger-total">
        <span>Total de tarifas</span>
        <strong>{preciseMoney.format(calculated.fees)}</strong>
      </div>
    </section>
  );
}

function TaxesCard({ operation, figures }: { operation: Operation; figures: FinancialFigures }) {
  const { calculated } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="IMPOSTOS" title="Tributos da operação" />
      <div>
        <span>IOF</span>
        <em>{operation.institution === "Factoring" ? "Conforme prazo" : "Não aplicável"}</em>
        <strong>{preciseMoney.format(calculated.iof)}</strong>
      </div>
      <div>
        <span>IOF adicional</span>
        <em>0,000000%</em>
        <strong>{preciseMoney.format(0)}</strong>
      </div>
      <div className="ledger-total">
        <span>Total de impostos</span>
        <strong>{preciseMoney.format(calculated.iof)}</strong>
      </div>
    </section>
  );
}

function RepurchaseCard({ figures }: { figures: FinancialFigures }) {
  const { repurchaseByAction, adjustments, totalOffsets } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="RECOMPRAS E COMPENSAÇÕES" title="Impactos no líquido do borderô" />
      <div>
        <span>Recompra de títulos</span>
        <strong>{preciseMoney.format(repurchaseByAction("Recompra"))}</strong>
      </div>
      <div>
        <span>Recompra parcial</span>
        <strong>{preciseMoney.format(repurchaseByAction("Recompra parcial"))}</strong>
      </div>
      <div>
        <span>Baixa bancária</span>
        <strong>{preciseMoney.format(repurchaseByAction("Baixar do banco"))}</strong>
      </div>
      <div>
        <span>Baixa somente no sistema</span>
        <strong>{preciseMoney.format(repurchaseByAction("Baixar somente do sistema"))}</strong>
      </div>
      <div>
        <span>Pendências financeiras</span>
        <strong>{preciseMoney.format(adjustments.debitTotal)}</strong>
      </div>
      <div>
        <span>(−) Créditos compensados</span>
        <strong>{preciseMoney.format(adjustments.creditTotal)}</strong>
      </div>
      <div className="ledger-total">
        <span>Total líquido de recompra</span>
        <strong>{preciseMoney.format(totalOffsets)}</strong>
      </div>
    </section>
  );
}

/** Formas de pagamento ainda não configuradas na simulação: todas zeradas, exceto a transferência. */
const zeroPaymentMethods = [
  "Crédito por negociação",
  "DOC / TED",
  "Cheque",
  "Conta-corrente do cedente",
  "Dinheiro",
  "Documento caucionado",
];

function PaymentCard({ figures }: { figures: FinancialFigures }) {
  const { finalNet } = figures;
  return (
    <section className="approval-ledger-card">
      <LedgerHeader eyebrow="PAGAMENTO DA OPERAÇÃO" title="Destino previsto da liberação" />
      {zeroPaymentMethods.map(method => (
        <div key={method}>
          <span>{method}</span>
          <strong>{preciseMoney.format(0)}</strong>
        </div>
      ))}
      <div>
        <span>Transferência / PIX a definir</span>
        <strong>{preciseMoney.format(finalNet)}</strong>
      </div>
      <div className="ledger-total">
        <span>Total previsto</span>
        <strong>{preciseMoney.format(finalNet)}</strong>
      </div>
    </section>
  );
}
