"use client";
/**
 * Resumo financeiro para decisão: face → líquido, indicadores principais da
 * condição, cascata de descontos e, abaixo, o razão detalhado (ledger).
 * Quando recolhido, mostra só o líquido e a taxa final no cabeçalho.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { CollapseButton, type SectionToggle } from "./approval-card-head";
import { ApprovalFinancialLedger } from "./approval-financial-ledger";
import { decimal, type FinancialFigures } from "./approval-model";

export function ApprovalFinancialSummary({
  operation,
  figures,
  prerequisitesReady,
  collapsed,
  onToggle,
}: SectionToggle & {
  operation: Operation;
  figures: FinancialFigures;
  prerequisitesReady: boolean;
}) {
  const { calculated, finalNet } = figures;
  return (
    <section className={`approval-financial-decision${collapsed ? " is-collapsed" : ""}`}>
      <div className="approval-financial-head">
        <div>
          <span>RESUMO FINANCEIRO PARA DECISÃO</span>
          <strong>
            {collapsed ? `Líquido do borderô · ${preciseMoney.format(finalNet)}` : "O que será efetivamente aprovado"}
          </strong>
          <small>
            {collapsed
              ? `${calculated.titleRows.length} títulos · taxa final ${decimal(calculated.allInMonthly, 2)}% a.m.`
              : "Condição comercial, impacto no caixa, risco e limite em uma única leitura."}
          </small>
        </div>
        <div className="approval-head-actions">
          <Badge tone={prerequisitesReady ? "ready" : "attention"}>
            {prerequisitesReady ? "PRONTA PARA ALÇADA" : "COM PENDÊNCIAS"}
          </Badge>
          <CollapseButton collapsed={collapsed} label="resumo financeiro" onToggle={onToggle} />
        </div>
      </div>
      {!collapsed && (
        <>
          <MoneyHero figures={figures} />
          <FinancialGrid operation={operation} figures={figures} />
          <Waterfall figures={figures} />
          <ApprovalFinancialLedger operation={operation} figures={figures} />
        </>
      )}
    </section>
  );
}

function MoneyHero({ figures }: { figures: FinancialFigures }) {
  const { calculated, finalNet } = figures;
  return (
    <div className="approval-money-hero">
      <div>
        <span>VALOR DE FACE</span>
        <strong>{preciseMoney.format(calculated.face)}</strong>
        <small>
          {calculated.titleRows.length} recebíveis · prazo médio {Math.round(calculated.weightedTerm)} dias
        </small>
      </div>
      <i>→</i>
      <div className="net">
        <span>LÍQUIDO DO BORDERÔ</span>
        <strong>{preciseMoney.format(finalNet)}</strong>
        <small>{calculated.face ? decimal((finalNet / calculated.face) * 100, 2) : "0,00"}% da face</small>
      </div>
    </div>
  );
}

function FinancialGrid({ operation, figures }: { operation: Operation; figures: FinancialFigures }) {
  const {
    pricing,
    calculated,
    repurchase,
    adjustments,
    totalOffsets,
    cedent,
    availableLimit,
    projectedLimit,
    retainedTotal,
    targetFinalRate,
  } = figures;
  return (
    <div className="approval-financial-grid">
      <div>
        <span>TAXA BASE</span>
        <strong>{decimal(pricing.monthlyRate, 2)}% a.m.</strong>
        <small>{pricing.method}</small>
      </div>
      <div>
        <span>TAXA FINAL CALCULADA</span>
        <strong>{decimal(calculated.allInMonthly, 2)}% a.m.</strong>
        <small>{targetFinalRate > 0 ? `Meta ${decimal(targetFinalRate, 2)}% a.m.` : "Sem meta definida"}</small>
      </div>
      <div>
        <span>SPREAD PROJETADO</span>
        <strong className={calculated.spread >= 0 ? "positive" : "negative"}>
          {decimal(calculated.spread, 2)}% a.m.
        </strong>
        <small>Custo {decimal(pricing.fundingCostMonthly, 2)}% a.m.</small>
      </div>
      <div>
        <span>LIMITE DISPONÍVEL</span>
        <strong>{preciseMoney.format(availableLimit)}</strong>
        <small>Após operação: {preciseMoney.format(projectedLimit)}</small>
      </div>
      <div>
        <span>DESÁGIO</span>
        <strong>{preciseMoney.format(calculated.originalDiscount)}</strong>
        <small>
          {calculated.face ? decimal((calculated.originalDiscount / calculated.face) * 100, 2) : "0,00"}% da face
        </small>
      </div>
      <div>
        <span>TARIFAS</span>
        <strong>{preciseMoney.format(calculated.fees)}</strong>
        <small>{pricing.manualFees?.length ?? 0} esporádica(s)</small>
      </div>
      <div>
        <span>IMPOSTOS</span>
        <strong>{preciseMoney.format(calculated.iof)}</strong>
        <small>Regra do veículo</small>
      </div>
      <div>
        <span>GARANTIAS / RETENÇÕES</span>
        <strong>{preciseMoney.format(retainedTotal)}</strong>
        <small>Reserva e retenção manual</small>
      </div>
      <div>
        <span>RECOMPRA</span>
        <strong className={totalOffsets > 0 ? "negative" : ""}>{preciseMoney.format(totalOffsets)}</strong>
        <small>{repurchase.selected.length + adjustments.selected.length} item(ns)</small>
      </div>
      <div>
        <span>RISCO</span>
        <strong>{operation.risk}</strong>
        <small>{operation.policy}</small>
      </div>
      <div>
        <span>REGRESSO</span>
        <strong>{pricing.regress}</strong>
        <small>{pricing.coobligation ? "Cedente coobrigado" : "Sem coobrigação"}</small>
      </div>
      <div>
        <span>CEDENTE</span>
        <strong>{cedent?.score ?? "—"}</strong>
        <small>Score · {cedent?.incidents ?? 0} apontamento(s)</small>
      </div>
    </div>
  );
}

function Waterfall({ figures }: { figures: FinancialFigures }) {
  const { calculated, retainedTotal, totalOffsets, finalNet } = figures;
  return (
    <div className="approval-waterfall">
      <span>
        <b>Face</b>
        <strong>{preciseMoney.format(calculated.face)}</strong>
      </span>
      <span>
        <b>− Deságio</b>
        <strong>{preciseMoney.format(calculated.originalDiscount)}</strong>
      </span>
      <span>
        <b>− Tarifas e impostos</b>
        <strong>{preciseMoney.format(calculated.fees + calculated.iof)}</strong>
      </span>
      <span>
        <b>− Retenções</b>
        <strong>{preciseMoney.format(retainedTotal)}</strong>
      </span>
      <span>
        <b>− Recompra</b>
        <strong>{preciseMoney.format(totalOffsets)}</strong>
      </span>
      <span className="total">
        <b>= Líquido</b>
        <strong>{preciseMoney.format(finalNet)}</strong>
      </span>
    </div>
  );
}
