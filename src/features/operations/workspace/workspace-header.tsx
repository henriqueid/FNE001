"use client";
/**
 * Cabeçalho do workspace (voltar, título, ações) e avisos logo abaixo:
 * cancelamento, feedback da última ação e alternância Resumo/Etapas das liberadas.
 */
import { type Operation } from "@/src/domain/core/types";
import { Badge, StatusBadge } from "@/src/features/operations/components/status";
import { AlertIcon, ArrowIcon, BackIcon, CheckIcon, CloseIcon } from "@/src/ui/icons";
import { type WorkspaceFeedback, type WorkspaceView } from "./workspace-model";

export function WorkspaceHeader({
  operation,
  commercialRepName,
  onBack,
  onCancel,
  onAdvance,
}: {
  operation: Operation;
  commercialRepName: string | undefined;
  onBack: () => void;
  onCancel: () => void;
  onAdvance: () => void;
}) {
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <BackIcon /> Operações em andamento
      </button>
      <div className="workspace-heading">
        <div>
          <div className="workspace-title-line">
            <h1>Aditivo {operation.aditivoNumber}</h1>
            <Badge tone={operation.institution.toLowerCase()}>{operation.institution}</Badge>
            <StatusBadge status={operation.status} />
          </div>
          <p>
            Borderô {operation.borderoNumber} <span>•</span> {operation.cedent} <span>•</span> {operation.document}{" "}
            <span>•</span> Comercial: <b className="workspace-rep">{commercialRepName ?? "sem vínculo"}</b>
          </p>
        </div>
        <div className="workspace-actions">
          {operation.status !== "Cancelada" && operation.status !== "Liberada ao financeiro" && (
            <button className="danger-secondary" onClick={onCancel}>
              Cancelar operação
            </button>
          )}
          {operation.status !== "Cancelada" && operation.stage < 6 && (
            <button className="primary-action" onClick={onAdvance}>
              Concluir etapa e avançar
              <ArrowIcon />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function WorkspaceNotices({
  operation,
  feedback,
  onDismissFeedback,
  workspaceView,
  onWorkspaceViewChange,
}: {
  operation: Operation;
  feedback: WorkspaceFeedback | null;
  onDismissFeedback: () => void;
  workspaceView: WorkspaceView;
  onWorkspaceViewChange: (view: WorkspaceView) => void;
}) {
  return (
    <>
      {operation.cancellation && (
        <div className="cancellation-banner">
          <CloseIcon />
          <div>
            <strong>Operação cancelada — {operation.cancellation.category}</strong>
            <span>{operation.cancellation.reason}</span>
            <small>
              Na etapa {operation.cancellation.stage}: {operation.cancellation.stageName} ·{" "}
              {operation.cancellation.cancelledAt} por {operation.cancellation.cancelledBy}
            </small>
          </div>
        </div>
      )}
      {feedback && (
        <div className={`success-banner ${feedback.tone}`}>
          {feedback.tone === "success" ? <CheckIcon /> : <AlertIcon />}
          <span>
            <strong>{feedback.tone === "success" ? "Ação registrada." : "Ação necessária."}</strong> {feedback.message}
          </span>
          <button onClick={onDismissFeedback} aria-label="Fechar aviso">
            <CloseIcon />
          </button>
        </div>
      )}
      {operation.status === "Liberada ao financeiro" && (
        <div className="released-toggle">
          <div>
            <CheckIcon />
            <span>
              <strong>Operação liberada ao financeiro</strong>
              <small>Somente consulta · baixa e estorno são feitos pelo financeiro</small>
            </span>
          </div>
          <div className="released-toggle-buttons">
            <button
              className={workspaceView === "summary" ? "active" : ""}
              onClick={() => onWorkspaceViewChange("summary")}
            >
              Resumo
            </button>
            <button
              className={workspaceView === "stages" ? "active" : ""}
              onClick={() => onWorkspaceViewChange("stages")}
            >
              Etapas
            </button>
          </div>
        </div>
      )}
    </>
  );
}
