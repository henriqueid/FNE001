"use client";
/**
 * Pontos de entrada da recompra no painel: o resumo em destaque logo abaixo do
 * resultado (com o efeito no líquido) e o atalho dentro do formulário. Ambos
 * abrem o modal de recompra e compensações.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { formatFlowMoney } from "@/src/domain/operations/format";
import { Badge } from "@/src/features/operations/components/status";
import { ArrowIcon } from "@/src/ui/icons";

type RepurchaseOverviewProps = {
  totalOffsets: number;
  netAfterRepurchase: number;
  selectedCount: number;
  hasAvailableItems: boolean;
  onOpen: () => void;
};

/** Resumo da recompra aplicada ao borderô, com botão para compor ou revisar. */
export function RepurchaseOverview({
  totalOffsets,
  netAfterRepurchase,
  selectedCount,
  hasAvailableItems,
  onOpen,
}: RepurchaseOverviewProps) {
  return (
    <section
      id="pricing-repurchase-overview"
      className={`repurchase-overview pricing-anchor ${totalOffsets !== 0 ? "applied" : "empty"}`}
    >
      <div className="repurchase-overview-main">
        <span>RECOMPRA</span>
        <strong>{totalOffsets !== 0 ? "Resumo da recompra" : "Nenhuma recompra adicionada"}</strong>
        {totalOffsets !== 0 && <small>{selectedCount} item(ns) compondo este borderô</small>}
      </div>
      {totalOffsets !== 0 && (
        <div className="repurchase-overview-summary">
          <div>
            <span>VALOR DA RECOMPRA</span>
            <strong>{preciseMoney.format(totalOffsets)}</strong>
          </div>
          <div>
            <span>EFEITO NO LÍQUIDO</span>
            <strong className={totalOffsets > 0 ? "negative" : "positive"}>{formatFlowMoney(-totalOffsets)}</strong>
          </div>
          <div>
            <span>LÍQUIDO FINAL</span>
            <strong>{preciseMoney.format(netAfterRepurchase)}</strong>
          </div>
        </div>
      )}
      <button type="button" data-testid="open-repurchase" disabled={!hasAvailableItems} onClick={onOpen}>
        {totalOffsets !== 0 ? "Revisar recompra" : "Fazer recompra"}
        <ArrowIcon />
      </button>
    </section>
  );
}

type RepurchaseLauncherProps = {
  totalOffsets: number;
  selectedTitleCount: number;
  selectedAdjustmentCount: number;
  onOpen: () => void;
};

/** Atalho para a recompra dentro do formulário da condição. */
export function RepurchaseLauncher({
  totalOffsets,
  selectedTitleCount,
  selectedAdjustmentCount,
  onOpen,
}: RepurchaseLauncherProps) {
  return (
    <section id="pricing-repurchase" className="pricing-section pricing-offset-launcher pricing-anchor">
      <div>
        <Badge tone={totalOffsets > 0 ? "ready" : "eyebrow"}>RECOMPRA E COMPENSAÇÕES</Badge>
        <strong>Compor recompra no borderô</strong>
        <span>Títulos do cedente ou do grupo, pendências e créditos disponíveis.</span>
        {totalOffsets > 0 && (
          <small>
            {selectedTitleCount} título(s) em recompra · {selectedAdjustmentCount} compensação(ões) · total{" "}
            {preciseMoney.format(totalOffsets)}
          </small>
        )}
      </div>
      <button type="button" onClick={onOpen}>
        {totalOffsets > 0 ? "Revisar recompra" : "Adicionar recompra"}
        <ArrowIcon />
      </button>
    </section>
  );
}
