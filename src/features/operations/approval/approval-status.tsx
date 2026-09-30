"use client";
/**
 * Peças de status do pacote decisório: cabeçalho com o status da aprovação,
 * faixa de contadores (prontidão, alçadas, documentos, assinaturas), aviso de
 * retorno das ações e rodapé com as ações principais.
 */
import { Badge } from "@/src/features/operations/components/status";
import { ArrowIcon, CloseIcon } from "@/src/ui/icons";
import { type ApprovalStatus, feedbackTone, reviewStatusTone } from "./approval-model";

export function ApprovalHero({ status }: { status: ApprovalStatus }) {
  return (
    <div className="approval-hero">
      <div>
        <Badge tone="eyebrow">APROVAÇÃO E FORMALIZAÇÃO</Badge>
        <h3>Pacote decisório da operação</h3>
        <p>Uma leitura única das condições aprovadas, requisitos, alçadas, documentos e assinaturas.</p>
      </div>
      <Badge tone={reviewStatusTone(status)}>{status}</Badge>
    </div>
  );
}

export type ApprovalCounters = {
  readinessDone: number;
  readinessTotal: number;
  approvedCount: number;
  approvalsTotal: number;
  readyDocuments: number;
  documentsTotal: number;
  signedCount: number;
  signaturesTotal: number;
  sentSignatures: number;
};

export function ApprovalStatusStrip({ counters }: { counters: ApprovalCounters }) {
  const c = counters;
  return (
    <div className="approval-kpis approval-status-strip">
      <div>
        <span>PRONTIDÃO</span>
        <strong>
          {c.readinessDone}/{c.readinessTotal}
        </strong>
        <small>requisitos concluídos</small>
      </div>
      <div>
        <span>ALÇADAS</span>
        <strong>
          {c.approvedCount}/{c.approvalsTotal}
        </strong>
        <small>{c.approvalsTotal - c.approvedCount} aguardando decisão</small>
      </div>
      <div>
        <span>DOCUMENTOS</span>
        <strong>
          {c.readyDocuments}/{c.documentsTotal}
        </strong>
        <small>pacote de formalização</small>
      </div>
      <div>
        <span>ASSINATURAS</span>
        <strong>
          {c.signedCount}/{c.signaturesTotal}
        </strong>
        <small>{c.sentSignatures} enviada(s)</small>
      </div>
    </div>
  );
}

export function ApprovalFeedback({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className={`approval-feedback ${feedbackTone(message)}`}>
      {message}
      <button aria-label="Fechar aviso" onClick={onDismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}

export function ApprovalFooter({
  status,
  prerequisitesReady,
  onSubmit,
  onApprove,
}: {
  status: ApprovalStatus;
  prerequisitesReady: boolean;
  onSubmit: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="approval-footer">
      <div>
        <strong>{status === "Preparação" ? "Pacote em preparação" : status}</strong>
        <span>
          {prerequisitesReady ? "Requisitos anteriores concluídos." : "Existem requisitos anteriores pendentes."}
        </span>
      </div>
      <button className="secondary-action" onClick={onSubmit}>
        Enviar para alçadas
      </button>
      <button className="primary-action" onClick={onApprove}>
        Aprovar operação <ArrowIcon />
      </button>
    </div>
  );
}
