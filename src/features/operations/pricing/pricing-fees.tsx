"use client";
/**
 * Seções de tarifas do formulário: tarifas e retenções configuradas (operação,
 * título, ad valorem, garantia, retenção manual e IOF calculado) e o cadastro
 * de tarifas esporádicas nomeadas desta operação.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { CloseIcon, PlusIcon } from "@/src/ui/icons";
import { type NumericPricingField, type PricingCalculation } from "./pricing-model";

type PricingFeesSectionProps = {
  pricing: PricingDraft;
  calculated: PricingCalculation;
  taxRule: string;
  adValoremEnabled: boolean;
  onNumberChange: (key: NumericPricingField, value: string) => void;
};

export function PricingFeesSection({
  pricing,
  calculated,
  taxRule,
  adValoremEnabled,
  onNumberChange,
}: PricingFeesSectionProps) {
  return (
    <section id="pricing-fees" className="pricing-section pricing-anchor">
      <div className="pricing-section-head">
        <div>
          <span>TARIFAS E RETENÇÕES</span>
          <strong>Componentes da liberação</strong>
        </div>
        <small>{taxRule}</small>
      </div>
      <div className="pricing-fields">
        <label>
          <span>TARIFA POR OPERAÇÃO</span>
          <div className="input-prefix">
            <b>R$</b>
            <input
              type="number"
              step="0.01"
              value={pricing.operationFee}
              onChange={event => onNumberChange("operationFee", event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>TARIFA POR TÍTULO</span>
          <div className="input-prefix">
            <b>R$</b>
            <input
              type="number"
              step="0.01"
              value={pricing.feePerTitle}
              onChange={event => onNumberChange("feePerTitle", event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>AD VALOREM</span>
          <div className="input-suffix">
            <input
              type="number"
              step="0.01"
              value={pricing.adValoremPercent}
              disabled={!adValoremEnabled}
              onChange={event => onNumberChange("adValoremPercent", event.target.value)}
            />
            <b>%</b>
          </div>
        </label>
        <label>
          <span>GARANTIA / RESERVA</span>
          <div className="input-suffix">
            <input
              type="number"
              step="0.01"
              value={pricing.guaranteePercent}
              onChange={event => onNumberChange("guaranteePercent", event.target.value)}
            />
            <b>%</b>
          </div>
        </label>
        <label>
          <span>RETENÇÃO MANUAL</span>
          <div className="input-prefix">
            <b>R$</b>
            <input
              type="number"
              step="0.01"
              value={pricing.manualRetention}
              onChange={event => onNumberChange("manualRetention", event.target.value)}
            />
          </div>
        </label>
        <label>
          <span>IOF DA OPERAÇÃO</span>
          <input value={preciseMoney.format(calculated.iof)} disabled />
        </label>
      </div>
    </section>
  );
}

type PricingCustomFeesProps = {
  manualFees: PricingDraft["manualFees"];
  manualFeesTotal: number;
  feeDescription: string;
  feeAmount: string;
  onFeeDescriptionChange: (value: string) => void;
  onFeeAmountChange: (value: string) => void;
  onAddFee: () => void;
  onRemoveFee: (id: string) => void;
};

export function PricingCustomFees({
  manualFees,
  manualFeesTotal,
  feeDescription,
  feeAmount,
  onFeeDescriptionChange,
  onFeeAmountChange,
  onAddFee,
  onRemoveFee,
}: PricingCustomFeesProps) {
  return (
    <section className="pricing-section pricing-custom-fees">
      <div className="pricing-section-head">
        <div>
          <span>TARIFAS ESPORÁDICAS</span>
          <strong>Itens específicos desta operação</strong>
        </div>
        <small>Tarifas nomeadas, auditáveis e aplicadas somente nesta condição</small>
      </div>
      <div className="pricing-fee-composer">
        <label className="fee-description">
          <span>DESCRIÇÃO</span>
          <input
            aria-label="Descrição da tarifa esporádica"
            value={feeDescription}
            placeholder="Ex.: consulta extraordinária"
            onChange={event => onFeeDescriptionChange(event.target.value)}
          />
        </label>
        <label>
          <span>VALOR</span>
          <div className="input-prefix">
            <b>R$</b>
            <input
              aria-label="Valor da tarifa esporádica"
              inputMode="decimal"
              value={feeAmount}
              placeholder="0,00"
              onChange={event => onFeeAmountChange(event.target.value.replace(/[^0-9,.]/g, ""))}
            />
          </div>
        </label>
        <button type="button" onClick={onAddFee}>
          <PlusIcon /> Adicionar tarifa
        </button>
      </div>
      {manualFees?.length ? (
        <div className="pricing-fee-list">
          {manualFees.map(fee => (
            <div key={fee.id}>
              <span>{fee.description}</span>
              <strong>{preciseMoney.format(fee.amount)}</strong>
              <button
                type="button"
                aria-label={`Excluir tarifa ${fee.description}`}
                onClick={() => onRemoveFee(fee.id)}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <div className="pricing-fee-total">
            <span>Total esporádico</span>
            <strong>{preciseMoney.format(manualFeesTotal)}</strong>
          </div>
        </div>
      ) : (
        <div className="pricing-fee-empty">Nenhuma tarifa esporádica adicionada.</div>
      )}
    </section>
  );
}
