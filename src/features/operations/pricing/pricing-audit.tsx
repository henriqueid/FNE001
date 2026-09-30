"use client";
/**
 * Rodapé do painel: memória de cálculo título a título (expansível) e a trilha
 * de auditoria com as versões salvas e revisões da condição comercial.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { formatRate, type PricingCalculation } from "./pricing-model";

type PricingTitleMemoryProps = {
  calculated: PricingCalculation;
  feeAllocation: PricingDraft["feeAllocation"];
  open: boolean;
  onToggle: () => void;
};

/** Tabela recolhível com o cálculo de cada recebível. */
export function PricingTitleMemory({ calculated, feeAllocation, open, onToggle }: PricingTitleMemoryProps) {
  return (
    <section id="pricing-memory" className="pricing-details pricing-anchor">
      <button onClick={onToggle}>
        <span>
          <b>Memória título a título</b>
          <small>
            {calculated.titleRows.length} recebíveis · tarifas rateadas {feeAllocation.toLowerCase()}
            {calculated.vaEnabled ? " · incorporadas ao VA" : ""}
          </small>
        </span>
        <strong>{open ? "Recolher" : "Ver cálculo"}</strong>
      </button>
      {open && (
        <div className="pricing-table-scroll">
          <div className="pricing-table-head">
            <span>TÍTULO</span>
            <span>SACADO</span>
            <span>VENCIMENTO</span>
            <span>DIAS</span>
            <span>FACE</span>
            <span>DESÁGIO</span>
            <span>TARIFAS</span>
            <span>RETENÇÃO</span>
            <span>LÍQUIDO</span>
          </div>
          {calculated.titleRows.map(row => (
            <div className="pricing-table-row" key={row.title.id}>
              <span>{row.title.documentNumber}</span>
              <span>{row.title.debtorName}</span>
              <span>{row.title.dueDate || "—"}</span>
              <span>{row.days}</span>
              <span>{preciseMoney.format(row.title.amount)}</span>
              <span>{preciseMoney.format(row.displayedDiscount)}</span>
              <span>{calculated.vaEnabled ? "Inclusa no VA" : preciseMoney.format(row.displayedFees)}</span>
              <span>{preciseMoney.format(row.allocatedGuarantee)}</span>
              <strong>{preciseMoney.format(row.net)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type PricingAuditTrailProps = {
  audit: NonNullable<PricingDraft["audit"]>;
};

/** Histórico da condição, do evento mais recente para o mais antigo. */
export function PricingAuditTrail({ audit }: PricingAuditTrailProps) {
  return (
    <section className="pricing-audit">
      <div className="pricing-section-head">
        <div>
          <span>TRILHA DE AUDITORIA</span>
          <strong>Histórico da condição comercial</strong>
        </div>
        <small>{audit.length} evento(s) registrado(s)</small>
      </div>
      <div className="pricing-audit-list">
        {audit
          .slice()
          .reverse()
          .map((event, index) => (
            <div key={`${event.at}-${event.action}-${index}`}>
              <span className={event.action === "Condição salva" ? "saved" : "editing"}>
                v{event.version} · {event.action}
              </span>
              <strong>
                {event.by} · {event.at}
              </strong>
              <small>
                {event.reason ? `Motivo: ${event.reason} · ` : ""}
                {event.method} a {formatRate(event.monthlyRate)}% a.m. · face {preciseMoney.format(event.face)} ·
                líquido final {preciseMoney.format(event.borderoNet)}
              </small>
            </div>
          ))}
      </div>
    </section>
  );
}
