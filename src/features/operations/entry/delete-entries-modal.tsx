"use client";
/**
 * Confirmação da exclusão de todos os títulos digitados na operação.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type ManualEntry } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, CloseIcon } from "@/src/ui/icons";
import { entriesTotal } from "./manual-entry-model";

export function DeleteEntriesModal({
  entries,
  onClose,
  onConfirm,
}: {
  entries: ManualEntry[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section
        className="cancel-modal delete-titles-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Excluir todos os títulos"
      >
        <div className="modal-head">
          <div>
            <Badge tone="cancelled">AÇÃO IRREVERSÍVEL</Badge>
            <h2>Excluir todos os títulos?</h2>
            <p>Os títulos serão retirados deste aditivo e os valores da operação serão recalculados.</p>
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="delete-titles-summary">
          <AlertIcon />
          <div>
            <strong>{entries.length} títulos serão excluídos</strong>
            <span>Total atual: {preciseMoney.format(entriesTotal(entries))}</span>
            <small>O cadastro dos sacados não será apagado.</small>
          </div>
        </div>
        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose}>
            Voltar
          </button>
          <button className="danger-action" onClick={onConfirm}>
            Confirmar exclusão
          </button>
        </div>
      </section>
    </div>
  );
}
