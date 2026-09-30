"use client";
/**
 * Seções editáveis da condição comercial: condição financeira (método, taxas,
 * custo de capital, float, prazo, rateio e VA, com alertas de meta e piso) e
 * estrutura de responsabilidade (regresso e coobrigação).
 */
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { AlertIcon } from "@/src/ui/icons";
import { formatRate, type NumericPricingField, type PricingCalculation } from "./pricing-model";

type PricingConditionSectionProps = {
  pricing: PricingDraft;
  calculated: PricingCalculation;
  policyMinimum: number;
  finalRateGap: number;
  rateBelowPolicy: boolean;
  onNumberChange: (key: NumericPricingField, value: string) => void;
  onDraftChange: (changes: Partial<PricingDraft>) => void;
};

export function PricingConditionSection({
  pricing,
  calculated,
  policyMinimum,
  finalRateGap,
  rateBelowPolicy,
  onNumberChange,
  onDraftChange,
}: PricingConditionSectionProps) {
  return (
    <section id="pricing-condition" className="pricing-section pricing-anchor">
      <div className="pricing-section-head">
        <div>
          <span>CONDIÇÃO FINANCEIRA</span>
          <strong>Taxa e método de cálculo</strong>
        </div>
        <small>Piso da política: {formatRate(policyMinimum)}% a.m.</small>
      </div>
      <div className="pricing-fields">
        <label>
          <span>MÉTODO DE DESÁGIO</span>
          <select
            value={pricing.method}
            onChange={event => onDraftChange({ method: event.target.value as PricingDraft["method"] })}
          >
            <option>Nominal</option>
            <option>Efetiva</option>
            <option>Mista</option>
            <option>Composta Mista</option>
          </select>
        </label>
        <label>
          <span>TAXA MENSAL</span>
          <div className="input-suffix">
            <input
              type="number"
              step="0.01"
              value={pricing.monthlyRate}
              onChange={event => onNumberChange("monthlyRate", event.target.value)}
            />
            <b>% a.m.</b>
          </div>
        </label>
        <label>
          <span>TAXA FINAL DESEJADA</span>
          <div className="input-suffix">
            <input
              type="number"
              step="0.01"
              value={pricing.targetFinalRateMonthly ?? 0}
              onChange={event => onNumberChange("targetFinalRateMonthly", event.target.value)}
            />
            <b>% a.m.</b>
          </div>
        </label>
        <label>
          <span>CUSTO DE CAPITAL</span>
          <div className="input-suffix">
            <input
              type="number"
              step="0.01"
              value={pricing.fundingCostMonthly}
              onChange={event => onNumberChange("fundingCostMonthly", event.target.value)}
            />
            <b>% a.m.</b>
          </div>
        </label>
        <label>
          <span>FLOAT</span>
          <div className="input-suffix">
            <input
              type="number"
              value={pricing.floatDays}
              onChange={event => onNumberChange("floatDays", event.target.value)}
            />
            <b>dias</b>
          </div>
        </label>
        <label>
          <span>PRAZO MÍNIMO</span>
          <div className="input-suffix">
            <input
              type="number"
              value={pricing.minimumTermDays}
              onChange={event => onNumberChange("minimumTermDays", event.target.value)}
            />
            <b>dias</b>
          </div>
        </label>
        <label>
          <span>RATEIO DAS TARIFAS</span>
          <select
            value={pricing.feeAllocation}
            onChange={event => onDraftChange({ feeAllocation: event.target.value as PricingDraft["feeAllocation"] })}
          >
            <option>Por valor</option>
            <option>Por valor × prazo</option>
          </select>
        </label>
        <label className="pricing-check pricing-va-flag">
          <input
            type="checkbox"
            checked={pricing.vaEnabled}
            onChange={event => onDraftChange({ vaEnabled: event.target.checked })}
          />
          <span>VA — EMBUTIR TARIFAS NO DESÁGIO</span>
        </label>
      </div>
      {pricing.vaEnabled && (
        <div className="pricing-va-notice">
          <strong>VA ativo</strong>
          <span>
            Fator ajustado de {formatRate(calculated.adjustedRate, 4)}% a.m. As tarifas passam a compor o deságio sem
            alterar o valor líquido, o all-in ou o spread da operação.
          </span>
        </div>
      )}
      {Math.abs(finalRateGap) > 0.05 && (
        <div className={`pricing-inline-alert ${finalRateGap < 0 ? "positive" : ""}`}>
          <AlertIcon /> Taxa calculada {finalRateGap > 0 ? "acima" : "abaixo"} da meta em{" "}
          {formatRate(Math.abs(finalRateGap))} p.p.
        </div>
      )}
      {rateBelowPolicy && (
        <div className="pricing-inline-alert">
          <AlertIcon /> Taxa abaixo do piso da política. Será necessária alçada comercial.
        </div>
      )}
    </section>
  );
}

type PricingResponsibilitySectionProps = {
  pricing: PricingDraft;
  onNumberChange: (key: NumericPricingField, value: string) => void;
  onResponsibilityChange: (changes: Partial<Pick<PricingDraft, "regress" | "coobligation">>) => void;
};

export function PricingResponsibilitySection({
  pricing,
  onNumberChange,
  onResponsibilityChange,
}: PricingResponsibilitySectionProps) {
  return (
    <section id="pricing-responsibility" className="pricing-section pricing-anchor">
      <div className="pricing-section-head">
        <div>
          <span>ESTRUTURA DE RESPONSABILIDADE</span>
          <strong>Regresso e coobrigação</strong>
        </div>
        <small>Condição vinculada ao termo da operação</small>
      </div>
      <div className="pricing-fields regress-fields">
        <label>
          <span>REGRESSO</span>
          <select
            value={pricing.regress}
            onChange={event => onResponsibilityChange({ regress: event.target.value as PricingDraft["regress"] })}
          >
            <option>Com regresso</option>
            <option>Sem regresso</option>
          </select>
        </label>
        <label>
          <span>PRAZO PARA REGRESSO</span>
          <div className="input-suffix">
            <input
              type="number"
              value={pricing.regressDays}
              disabled={pricing.regress === "Sem regresso"}
              onChange={event => onNumberChange("regressDays", event.target.value)}
            />
            <b>D+</b>
          </div>
        </label>
        <label className="pricing-check">
          <input
            type="checkbox"
            checked={pricing.coobligation}
            onChange={event => onResponsibilityChange({ coobligation: event.target.checked })}
          />
          <span>CEDENTE COOBRIGADO</span>
        </label>
      </div>
    </section>
  );
}
