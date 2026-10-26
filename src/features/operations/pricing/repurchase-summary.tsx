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
  demo?: boolean;
  unavailableReason?: string;
  totalOffsets: number;
  netAfterRepurchase: number;
  selectedCount: number;
  hasAvailableItems: boolean;
  onOpen: () => void;
};

/** Resumo da recompra aplicada ao borderô, com botão para compor ou revisar. */
export function RepurchaseOverview({
  unavailableReason,
  demo = true,
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
        <strong>
          {unavailableReason
            ? "Recompra indisponível"
            : totalOffsets !== 0
              ? "Resumo da recompra"
              : "Nenhuma recompra adicionada"}
        </strong>
        <small>
          {unavailableReason || (demo ? "Simulação de recompra e compensações" : "Recompra de saldo principal aberto")}
        </small>
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
      <button
        type="button"
        data-testid="open-repurchase"
        disabled={Boolean(unavailableReason) || !hasAvailableItems}
        onClick={onOpen}
      >
        {totalOffsets !== 0 ? "Revisar recompra" : "Fazer recompra"}
        <ArrowIcon />
      </button>
    </section>
  );
}

type RepurchaseLauncherProps = {
  demo?: boolean;
  unavailableReason?: string;
  totalOffsets: number;
  selectedTitleCount: number;
  selectedAdjustmentCount: number;
  onOpen: () => void;
};

/** Atalho para a recompra dentro do formulário da condição. */
export function RepurchaseLauncher({
  unavailableReason,
  demo = true,
  totalOffsets,
  selectedTitleCount,
  selectedAdjustmentCount,
  onOpen,
}: RepurchaseLauncherProps) {
  return (
    <section id="pricing-repurchase" className="pricing-section pricing-offset-launcher pricing-anchor">
      <div>
        <Badge tone={totalOffsets > 0 ? "ready" : "eyebrow"}>RECOMPRA E COMPENSAÇÕES</Badge>
        <strong>
          {unavailableReason
            ? "Recompra indisponível"
            : demo
              ? "Simulação de recompra e compensações"
              : "Recompra de saldo principal aberto"}
        </strong>
        <span>
          {unavailableReason ||
            (demo
              ? "Títulos fictícios do cedente ou do grupo, pendências e créditos demonstrativos."
              : "Defina se cada título será baixado ou seguirá em cobrança do sacado.")}
        </span>
        {totalOffsets > 0 && (
          <small>
            {selectedTitleCount} título(s) em recompra · {selectedAdjustmentCount} compensação(ões) · total{" "}
            {preciseMoney.format(totalOffsets)}
          </small>
        )}
      </div>
      <button type="button" data-testid="launch-repurchase" disabled={Boolean(unavailableReason)} onClick={onOpen}>
        {totalOffsets > 0 ? "Revisar recompra" : "Adicionar recompra"}
        <ArrowIcon />
      </button>
    </section>
  );
}
