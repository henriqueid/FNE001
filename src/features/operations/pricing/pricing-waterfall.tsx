"use client";
/**
 * Coluna lateral "Memória da operação": cascata de formação do líquido (face,
 * deságio, tarifas, tributos, garantia, retenção, recompra), composição interna
 * do VA, leitura da política, botão de salvar e mensagem de retorno.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { formatRate, type PricingCalculation } from "./pricing-model";

type PolicyReadingInput = {
  rateBelowPolicy: boolean;
  spread: number;
  netAfterRepurchase: number;
};

/** Explicação curta da leitura da condição frente à política. */
function policyReadingText({ rateBelowPolicy, spread, netAfterRepurchase }: PolicyReadingInput) {
  return rateBelowPolicy
    ? "Taxa abaixo do piso comercial."
    : spread <= 0
      ? "Spread não remunera o custo de capital."
      : netAfterRepurchase <= 0
        ? "A recompra e as compensações consomem todo o líquido do borderô."
        : "Spread positivo e líquido final calculado.";
}

type PricingWaterfallProps = {
  pricing: PricingDraft;
  calculated: PricingCalculation;
  totalOffsets: number;
  netAfterRepurchase: number;
  positiveEconomics: boolean;
  rateBelowPolicy: boolean;
  feedback: string;
  onSave: () => void;
};

export function PricingWaterfall({
  pricing,
  calculated,
  totalOffsets,
  netAfterRepurchase,
  positiveEconomics,
  rateBelowPolicy,
  feedback,
  onSave,
}: PricingWaterfallProps) {
  const withinPolicy = positiveEconomics && !rateBelowPolicy;
  return (
    <aside className="pricing-waterfall">
      <div className="pricing-section-head">
        <div>
          <span>MEMÓRIA DA OPERAÇÃO</span>
          <strong>Formação do líquido</strong>
        </div>
      </div>
      <div className="waterfall-lines">
        <div>
          <span>Valor de face</span>
          <strong>{preciseMoney.format(calculated.face)}</strong>
        </div>
        <div>
          <span>(–) {calculated.vaEnabled ? "Deságio com VA" : "Deságio"}</span>
          <strong>{preciseMoney.format(calculated.discount)}</strong>
        </div>
        {!calculated.vaEnabled && (
          <div>
            <span>(–) Tarifas</span>
            <strong>{preciseMoney.format(calculated.displayedFees)}</strong>
          </div>
        )}
        <div>
          <span>(–) Tributos configurados</span>
          <strong>{preciseMoney.format(calculated.iof)}</strong>
        </div>
        <div>
          <span>(–) Garantia / reserva</span>
          <strong>{preciseMoney.format(calculated.guarantee)}</strong>
        </div>
        <div>
          <span>(–) Retenção manual</span>
          <strong>{preciseMoney.format(pricing.manualRetention)}</strong>
        </div>
        <div className="waterfall-subtotal">
          <span>Líquido comercial</span>
          <strong>{preciseMoney.format(calculated.net)}</strong>
        </div>
        {totalOffsets !== 0 && (
          <div className={`waterfall-repurchase ${totalOffsets < 0 ? "credit" : ""}`}>
            <span>({totalOffsets > 0 ? "–" : "+"}) Recompra e compensações</span>
            <strong>{preciseMoney.format(Math.abs(totalOffsets))}</strong>
          </div>
        )}
        <div className="waterfall-total">
          <span>Líquido do borderô</span>
          <strong>{preciseMoney.format(netAfterRepurchase)}</strong>
        </div>
      </div>
      {calculated.vaEnabled && (
        <div className="pricing-va-audit">
          <span>COMPOSIÇÃO INTERNA DO VA</span>
          <small>
            Deságio original {preciseMoney.format(calculated.originalDiscount)} + tarifas{" "}
            {preciseMoney.format(calculated.fees)}
          </small>
          <small>
            Fator ajustado {formatRate(calculated.adjustedRate, 4)}% a.m. · ajuste de fechamento{" "}
            {preciseMoney.format(calculated.vaVariance)}
          </small>
        </div>
      )}
      <div className="pricing-policy">
        <span>LEITURA DA CONDIÇÃO</span>
        <strong className={withinPolicy ? "positive" : "warning-text"}>
          {withinPolicy ? "Dentro da política" : "Exige atenção"}
        </strong>
        <small>{policyReadingText({ rateBelowPolicy, spread: calculated.spread, netAfterRepurchase })}</small>
      </div>
      <button className="pricing-save" disabled={pricing.locked} onClick={onSave}>
        {pricing.locked ? `Condição v${pricing.version ?? 0} salva` : "Salvar condição comercial"}
      </button>
      {feedback && (
        <div className={`pricing-feedback ${feedback.startsWith("Condição comercial salva") ? "success" : "warning"}`}>
          {feedback}
        </div>
      )}
    </aside>
  );
}
