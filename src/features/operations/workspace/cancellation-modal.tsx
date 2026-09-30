"use client";

/**
 * Cancelamento da operação com categoria e motivo (a memória é preservada).
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { CloseIcon, ShieldIcon } from "@/src/ui/icons";
import { useState } from "react";

export function CancellationModal({
  operation,
  onClose,
  onConfirm,
}: {
  operation: Operation;
  onClose: () => void;
  onConfirm: (category: string, reason: string) => void;
}) {
  const [category, setCategory] = useState("Desistência do cliente");
  const [reason, setReason] = useState("");
  const categories = [
    "Desistência do cliente",
    "Desistência da financeira",
    "Risco fora da política",
    "Documentação inconsistente",
    "Duplicidade de operação",
    "Erro de importação",
    "Outro motivo",
  ];
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section className="cancel-modal" role="dialog" aria-modal="true" aria-label="Cancelar operação">
        <div className="modal-head">
          <div>
            <Badge tone="cancelled">ENCERRAMENTO DO NEGÓCIO</Badge>
            <h2>Cancelar operação?</h2>
            <p>A operação não será apagada. O histórico será usado para reconhecer futuras reimportações.</p>
          </div>
          <button onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="cancel-operation-ref">
          <span>ADITIVO {operation.aditivoNumber}</span>
          <strong>{operation.cedent}</strong>
          <small>
            Borderô {operation.borderoNumber} · Etapa {operation.stage}: {stages[operation.stage - 1].title}
          </small>
        </div>
        <label className="modal-field">
          <span>Origem do cancelamento</span>
          <select value={category} onChange={event => setCategory(event.target.value)}>
            {categories.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="modal-field cancellation-reason">
          <span>Motivo detalhado</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Descreva o que levou ao encerramento. Esta informação ficará na memória da operação."
          />
        </label>
        <div className="memory-notice">
          <ShieldIcon />
          <span>
            <strong>Memória de reimportação ativa</strong>
            <small>Aditivo, borderô, títulos, valores, etapa e justificativa permanecerão pesquisáveis.</small>
          </span>
        </div>
        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose}>
            Voltar
          </button>
          <button
            className="danger-action"
            disabled={reason.trim().length < 5}
            onClick={() => onConfirm(category, reason.trim())}
          >
            Confirmar cancelamento
          </button>
        </div>
      </section>
    </div>
  );
}
