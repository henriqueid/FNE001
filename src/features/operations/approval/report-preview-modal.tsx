"use client";
/**
 * Modal de prévia de relatório (borderô, termo de cessão, memória financeira,
 * dossiê). O termo de cessão mostra o texto contratual; os demais, o quadro
 * financeiro e a lista de títulos. Permite imprimir ou salvar em PDF.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { CloseIcon } from "@/src/ui/icons";
import { decimal, type FinancialFigures, nowLabel, type ReportType } from "./approval-model";

export function ReportPreviewModal({
  reportType,
  operation,
  figures,
  onClose,
}: {
  reportType: ReportType;
  operation: Operation;
  figures: FinancialFigures;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop report-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section className="report-preview" role="dialog" aria-modal="true" aria-label={`Prévia de ${reportType}`}>
        <header>
          <div>
            <span>STRATO · OPERAÇÃO {operation.aditivoNumber}</span>
            <h2>{reportType}</h2>
            <p>
              {operation.cedent} · {operation.document}
            </p>
          </div>
          <button aria-label="Fechar relatório" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="report-identifiers">
          <div>
            <span>ADITIVO</span>
            <strong>{operation.aditivoNumber}</strong>
          </div>
          <div>
            <span>BORDERÔ</span>
            <strong>{operation.borderoNumber}</strong>
          </div>
          <div>
            <span>VEÍCULO</span>
            <strong>{operation.vehicle}</strong>
          </div>
          <div>
            <span>EMISSÃO</span>
            <strong>{nowLabel()}</strong>
          </div>
        </div>
        {reportType === "Termo de cessão" ? (
          <AssignmentContract operation={operation} figures={figures} />
        ) : (
          <FinancialReport figures={figures} />
        )}
        <footer>
          <span>Documento gerado a partir da condição comercial e da trilha da operação.</span>
          <strong>STRATO · Receivables OS</strong>
        </footer>
        <div className="report-actions">
          <button onClick={onClose}>Fechar</button>
          <button className="primary-action" onClick={() => window.print()}>
            Imprimir / salvar em PDF
          </button>
        </div>
      </section>
    </div>
  );
}

function AssignmentContract({ operation, figures }: { operation: Operation; figures: FinancialFigures }) {
  const { calculated, finalNet } = figures;
  return (
    <div className="report-contract">
      <h3>Partes e objeto da cessão</h3>
      <p>
        <b>Cedente:</b> {operation.cedent}, inscrito sob {operation.document}.
      </p>
      <p>
        <b>Cessionário:</b> {operation.vehicle}.
      </p>
      <p>
        O presente instrumento referencia a cessão dos {calculated.titleRows.length} recebíveis vinculados ao borderô{" "}
        {operation.borderoNumber}, pelo valor de face de {preciseMoney.format(calculated.face)} e líquido de{" "}
        {preciseMoney.format(finalNet)}, sujeito às condições e aprovações registradas na operação.
      </p>
      <div>
        <span>CEDENTE</span>
        <span>CESSIONÁRIO</span>
      </div>
    </div>
  );
}

function FinancialReport({ figures }: { figures: FinancialFigures }) {
  const { pricing, calculated, finalNet, totalOffsets } = figures;
  return (
    <>
      <div className="report-financial-grid">
        <div>
          <span>VALOR DE FACE</span>
          <strong>{preciseMoney.format(calculated.face)}</strong>
        </div>
        <div>
          <span>VALOR LÍQUIDO</span>
          <strong>{preciseMoney.format(finalNet)}</strong>
        </div>
        <div>
          <span>TAXA BASE</span>
          <strong>{decimal(pricing.monthlyRate, 2)}% a.m.</strong>
        </div>
        <div>
          <span>TAXA FINAL</span>
          <strong>{decimal(calculated.allInMonthly, 2)}% a.m.</strong>
        </div>
        <div>
          <span>DESÁGIO</span>
          <strong>{preciseMoney.format(calculated.originalDiscount)}</strong>
        </div>
        <div>
          <span>TARIFAS</span>
          <strong>{preciseMoney.format(calculated.fees)}</strong>
        </div>
        <div>
          <span>IMPOSTOS</span>
          <strong>{preciseMoney.format(calculated.iof)}</strong>
        </div>
        <div>
          <span>RECOMPRA</span>
          <strong>{preciseMoney.format(totalOffsets)}</strong>
        </div>
      </div>
      <div className="report-table">
        <div>
          <span>Documento</span>
          <span>Sacado</span>
          <span>Vencimento</span>
          <span>Valor</span>
        </div>
        {calculated.titleRows.map(row => (
          <div key={row.title.id}>
            <strong>{row.title.documentNumber}</strong>
            <span>{row.title.debtorName}</span>
            <span>{row.title.dueDate}</span>
            <strong>{preciseMoney.format(row.title.amount)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
