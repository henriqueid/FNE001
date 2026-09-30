"use client";
/**
 * Modal de análise do título: prazo da política, monitoramento da NF-e, CFOP e decisão individual.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type ManualEntry } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { CloseIcon } from "@/src/ui/icons";
import {
  MINIMUM_TERM_DAYS,
  type RiskDecision,
  cfopDescription,
  cfopMonitoring,
  isCirculationCfop,
  noteMonitoring,
  termFor,
} from "./risk-model";

export function TitleAnalysisModal({
  title,
  debtorName,
  onClose,
  onDecide,
}: {
  title: ManualEntry;
  debtorName?: string;
  onClose: () => void;
  onDecide: (id: string, decision: RiskDecision) => void;
}) {
  const decideAndClose = (decision: RiskDecision) => {
    onDecide(title.id, decision);
    onClose();
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section className="risk-detail-modal title-analysis-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <Badge tone="eyebrow">ANÁLISE DO TÍTULO</Badge>
            <h2>{title.documentNumber}</h2>
            <p>
              {debtorName} · {preciseMoney.format(title.amount)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>
        <div className="title-monitor-summary">
          <div className={termFor(title) != null && termFor(title)! >= MINIMUM_TERM_DAYS ? "ok" : "fail"}>
            <span>PRAZO DA POLÍTICA</span>
            <strong>{termFor(title) == null ? "Não calculado" : `${termFor(title)} dias`}</strong>
            <small>Mínimo configurado: {MINIMUM_TERM_DAYS} dias</small>
          </div>
          <div className={title.nfeKey ? "ok" : "fail"}>
            <span>MONITORAMENTO NF-e</span>
            <strong>{title.nfeKey ? "Ativo" : "Pendente"}</strong>
            <small>{noteMonitoring(title)}</small>
          </div>
          <div className={isCirculationCfop(title.cfop) ? "ok" : "fail"}>
            <span>CFOP {title.cfop || "não informado"}</span>
            <strong>{cfopDescription(title.cfop)}</strong>
            <small>{cfopMonitoring(title)}</small>
          </div>
        </div>
        <div className="title-detail-list">
          <div>
            <span>Chave da nota</span>
            <strong className="tax-key-full">{title.nfeKey || "Não informada"}</strong>
          </div>
          <div>
            <span>Emissão</span>
            <strong>{title.issueDate || "Não informada"}</strong>
          </div>
          <div>
            <span>Vencimento</span>
            <strong>{title.dueDate || "Não informado"}</strong>
          </div>
          <div>
            <span>Nosso número</span>
            <strong>{title.ourNumber || "Não informado"}</strong>
          </div>
          <div>
            <span>Descrição do CFOP</span>
            <strong>{cfopDescription(title.cfop)}</strong>
          </div>
          <div>
            <span>Observação</span>
            <strong>{title.observation || "Sem observações"}</strong>
          </div>
        </div>
        <div className="modal-actions title-modal-actions">
          <button className="danger-secondary" onClick={() => decideAndClose("Reprovado")}>
            Rejeitar título
          </button>
          <button className="primary-action" onClick={() => decideAndClose("Aprovado")}>
            Aprovar título
          </button>
        </div>
      </section>
    </div>
  );
}
