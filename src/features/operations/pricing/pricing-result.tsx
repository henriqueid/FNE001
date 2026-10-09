"use client";
/**
 * Resultado da simulação: cartão com líquido ao cedente, taxa base, taxa
 * efetiva final e spread, e o aviso de reconciliação quando a face dos títulos
 * diverge do valor registrado na operação.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { AlertIcon } from "@/src/ui/icons";
import { formatRate, type PricingCalculation } from "./pricing-model";

type PricingResultCardProps = {
  pricing: PricingDraft;
  calculated: PricingCalculation;
  totalOffsets: number;
  netAfterRepurchase: number;
  targetFinalRate: number;
  finalRateGap: number;
};

export function PricingResultCard({
  pricing,
  calculated,
  totalOffsets,
  netAfterRepurchase,
  targetFinalRate,
  finalRateGap,
}: PricingResultCardProps) {
  return (
    <div className="pricing-result-card">
      <div className="pricing-main-result">
        <span>{totalOffsets !== 0 ? "LÍQUIDO APÓS RECOMPRA" : "VALOR LÍQUIDO AO CEDENTE"}</span>
        <strong>{preciseMoney.format(netAfterRepurchase)}</strong>
        <small>
          {totalOffsets !== 0
            ? `${preciseMoney.format(calculated.net)} comercial ${totalOffsets > 0 ? "−" : "+"} ${preciseMoney.format(Math.abs(totalOffsets))} em recompra e compensações`
            : `${formatRate((calculated.net / Math.max(1, calculated.face)) * 100)}% do valor de face`}
        </small>
      </div>
      <div>
        <span>TAXA BASE</span>
        <strong>{formatRate(pricing.monthlyRate)}% a.m.</strong>
        <small>
          {pricing.method} · {Math.round(calculated.weightedTerm)} dias médios
        </small>
      </div>
      <div>
        <span>TAXA EFETIVA FINAL</span>
        <strong>{formatRate(calculated.allInMonthly)}% a.m.</strong>
        <small>
          Meta {formatRate(targetFinalRate)}% · diferença {finalRateGap >= 0 ? "+" : ""}
          {formatRate(finalRateGap)} p.p.
        </small>
      </div>
      <div>
        <span>SPREAD PROJETADO</span>
        <strong className={calculated.spread > 0 ? "positive" : "negative"}>
          {formatRate(calculated.spread)}% a.m.
        </strong>
        <small>Custo de capital: {formatRate(pricing.fundingCostMonthly)}% a.m.</small>
      </div>
    </div>
  );
}

type PricingReconciliationProps = {
  registeredAmount: number;
  titlesFace: number;
};

/** Aviso exibido quando a soma dos títulos difere do valor registrado na operação. */
export function PricingReconciliation({ registeredAmount, titlesFace }: PricingReconciliationProps) {
  return (
    <div className="pricing-reconciliation">
      <AlertIcon />
      <div>
        <strong>Valor de face recalculado pelos títulos</strong>
        <span>
          O resumo registra {preciseMoney.format(registeredAmount)}, mas os títulos totalizam{" "}
          {preciseMoney.format(titlesFace)}. Ao salvar, os totais da operação serão sincronizados.
        </span>
      </div>
    </div>
  );
}
