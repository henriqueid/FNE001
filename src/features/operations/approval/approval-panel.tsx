"use client";
/**
 * Etapa de Aprovação e formalização da operação. Este componente concentra o
 * estado (observação, avisos, seções recolhidas, prévia de relatório e
 * assinatura manual) e as ações que gravam no `approvalReview` com registro na
 * trilha; a apresentação fica nos cartões irmãos desta pasta e os cálculos em
 * `approval-model.ts`.
 */
import { useCedents } from "@/src/app/registry-context";
import { useStratoAuth } from "@/src/features/auth/auth-context";
import { decideOperationApproval, loadOperationApproval } from "@/src/app/operation-approval-client";
import type { ApprovalSlot } from "@/src/server/operations/approval-evidence";
import { preciseMoney } from "@/src/domain/core/format";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { localDateISO } from "@/src/domain/operations/dates";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import { useEffect, useRef, useState } from "react";
import { uploadOperationDocument, type UploadedDocument } from "@/src/app/documents-client";
import { returnApprovalToRisk } from "./return-to-risk-client";
import { ApprovalAuthorities } from "./approval-authorities";
import { ApprovalDocuments } from "./approval-documents";
import { ApprovalDecisionSummary } from "./approval-decision-summary";
import { ApprovalFinancialSummary } from "./approval-financial-summary";
import {
  type ApprovalReview,
  buildApprovalTimeline,
  buildDefaultApprovals,
  buildDefaultDocuments,
  buildDefaultSignatures,
  buildFinancialFigures,
  buildReadinessChecklist,
  emptyManualDraft,
  nowLabel,
  type ReportType,
  withFormalizationCompleted,
  withOperationReturnedToRisk,
} from "./approval-model";
import { ApprovalReadiness } from "./approval-readiness";
import { ApprovalReports } from "./approval-reports";
import { ApprovalSignatures } from "./approval-signatures";
import { ApprovalFeedback, ApprovalFooter, ApprovalStatusStrip } from "./approval-status";
import { ApprovalTimeline } from "./approval-timeline";
import { ReportPreviewModal } from "./report-preview-modal";

type CollapsibleSection = "financial" | "readiness" | "approvals" | "documents" | "signatures" | "reports" | "timeline";

export function ApprovalPanel({
  operation,
  debtors,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  onChange: (operation: Operation) => void;
}) {
  const isDemo = useStratoAuth()?.mode === "demo";
  const [serverSlots, setServerSlots] = useState<ApprovalSlot[]>([]);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const returnBusyRef = useRef(false);
  const currentOperationId = useRef(operation.id);
  useEffect(() => {
    currentOperationId.current = operation.id;
  }, [operation.id]);
  const [attachmentFile, setAttachmentFile] = useState<{ file: File; operationId: string } | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const registryCedents = useCedents();
  const figures = buildFinancialFigures(operation, registryCedents);
  const { finalNet } = figures;
  const lastro = lastroAssessmentFor(operation, debtors);
  const checklist = buildReadinessChecklist(operation, lastro);
  const prerequisitesReady = checklist.every(item => item.ok);
  const lastroConcerns = ["Favorável com ressalvas", "Desfavorável"].includes(lastro.status) ? 1 : 0;
  const defaultApprovals: NonNullable<ApprovalReview["approvals"]> = isDemo
    ? buildDefaultApprovals(operation, prerequisitesReady, lastroConcerns)
    : serverSlots.map(slot => ({
        id: slot.id,
        role: slot.authorityId,
        approver: "Aguardando alçada",
        status: "Pendente" as const,
      }));
  const defaultDocuments = buildDefaultDocuments(operation, lastro);
  const defaultSignatures = buildDefaultSignatures(operation);
  const review: ApprovalReview = operation.approvalReview ?? {
    status: "Preparação" as const,
    approvals: defaultApprovals,
    documents: defaultDocuments,
    signatures: defaultSignatures,
    audit: [],
  };
  const approvals = review.approvals?.length ? review.approvals : defaultApprovals;
  const documents = review.documents?.length ? review.documents : defaultDocuments;
  const signatures = review.signatures?.length ? review.signatures : defaultSignatures;
  const approvedCount = approvals.filter(item => item.status === "Aprovado").length;
  const readyDocuments = documents.filter(item => item.status === "Pronto" || item.status === "Dispensado").length;
  const signedCount = signatures.filter(item => item.status === "Assinado").length;
  const approvalTimeline = buildApprovalTimeline(operation, review.audit ?? []);
  const [observation, setObservation] = useState(review.observation ?? "");
  const [feedback, setFeedback] = useState("");
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [manualSignatureId, setManualSignatureId] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState(() => emptyManualDraft(localDateISO()));
  useEffect(() => {
    if (isDemo) return;
    let active = true;
    loadOperationApproval(operation.id)
      .then(result => {
        if (active) setServerSlots(result.slots);
      })
      .catch(error => {
        if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível carregar as alçadas.");
      });
    return () => {
      active = false;
    };
  }, [isDemo, operation.id]);

  async function decideServerApproval(id: string, decision: "Aprovado" | "Reprovado") {
    if (decisionBusy) return;
    if (observation.trim().length < 10) {
      setFeedback("Registre a justificativa da alçada com pelo menos dez caracteres.");
      return;
    }
    setDecisionBusy(true);
    try {
      const saved = await decideOperationApproval({
        operationId: operation.id,
        expectedVersion: operation.persistenceVersion ?? 0,
        slotId: id,
        decision: decision === "Aprovado" ? "APROVAR" : "REPROVAR",
        reason: observation.trim(),
      });
      if (currentOperationId.current !== saved.id) return;
      onChange(saved);
      setFeedback("Decisão da alçada registrada pelo servidor.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível registrar a alçada.");
    } finally {
      setDecisionBusy(false);
    }
  }

  /** Props de recolher/expandir para a seção informada. */
  function sectionToggle(section: CollapsibleSection) {
    return {
      collapsed: Boolean(collapsedSections[section]),
      onToggle: () => setCollapsedSections(current => ({ ...current, [section]: !current[section] })),
    };
  }

  function saveReview(change: Partial<ApprovalReview>, action: string, detail: string, tryAvailability = false) {
    const next: ApprovalReview = {
      ...review,
      ...change,
      approvals: change.approvals ?? approvals,
      documents: change.documents ?? documents,
      signatures: change.signatures ?? signatures,
      audit: [...(review.audit ?? []), { at: nowLabel(), by: "Henrique", action, detail }],
    };
    if (!isDemo) next.approvals = operation.approvalReview?.approvals;
    onChange(tryAvailability ? withFormalizationCompleted(operation, next) : { ...operation, approvalReview: next });
  }

  function submitForApproval() {
    if (!prerequisitesReady || readyDocuments < documents.filter(item => item.required).length) {
      setFeedback("Conclua os requisitos e documentos obrigatórios antes de enviar para as alçadas.");
      return;
    }
    saveReview(
      { status: "Em aprovação", submittedAt: nowLabel(), submittedBy: "Henrique", observation },
      "Enviada para aprovação",
      `${approvals.length} alçada(s) configurada(s)`,
    );
    setFeedback("Pacote enviado para as alçadas. As decisões ficam registradas individualmente.");
  }

  function decideApproval(id: string, decision: "Aprovado" | "Reprovado") {
    if (!isDemo) {
      void decideServerApproval(id, decision);
      return;
    }
    const nextApprovals = approvals.map(item =>
      item.id === id
        ? { ...item, status: decision, decidedAt: nowLabel(), note: observation.trim() || item.note }
        : item,
    );
    saveReview(
      {
        status:
          decision === "Reprovado" ? "Reprovada" : review.status === "Preparação" ? "Em aprovação" : review.status,
        approvals: nextApprovals,
        observation,
      },
      decision === "Aprovado" ? "Alçada aprovada" : "Alçada reprovada",
      nextApprovals.find(item => item.id === id)?.role ?? id,
    );
    setFeedback(
      decision === "Aprovado"
        ? "Aprovação registrada na trilha da operação."
        : "Reprovação registrada. A operação permanece bloqueada para formalização.",
    );
  }

  function approveOperation() {
    if (!isDemo) {
      setFeedback(
        "Registre cada decisão nas alçadas. A aprovação final é concluída pelo servidor quando todas estiverem aprovadas.",
      );
      return;
    }
    if (approvals.some(item => item.status !== "Aprovado")) {
      setFeedback("Ainda existem alçadas pendentes ou reprovadas.");
      return;
    }
    saveReview(
      {
        status: "Aprovada",
        observation,
        finalDecision: {
          outcome: "APROVADA",
          decidedAt: nowLabel(),
          decidedBy: "Henrique",
          justification: observation.trim() || "Política e alçadas atendidas.",
        },
      },
      "Operação aprovada",
      `Líquido aprovado: ${preciseMoney.format(finalNet)}`,
    );
    setFeedback("Operação aprovada. O pacote está pronto para envio às assinaturas.");
  }

  async function returnToRisk() {
    if (returnBusyRef.current || decisionBusy || attachmentBusy) return;
    if (observation.trim().length < 8) {
      setFeedback("Registre uma justificativa com pelo menos oito caracteres antes de devolver a operação.");
      return;
    }
    if (isDemo) {
      onChange(withOperationReturnedToRisk(operation, review, observation));
      return;
    }
    returnBusyRef.current = true;
    setReturnBusy(true);
    try {
      const saved = await returnApprovalToRisk(operation.id, operation.persistenceVersion ?? 0, observation.trim());
      if (currentOperationId.current !== saved.id) return;
      onChange(saved);
      setFeedback(
        "Devolução ao Risco confirmada pelo servidor. Alçadas, documentos e assinaturas precisarão ser refeitos.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível devolver a operação ao Risco.");
    } finally {
      returnBusyRef.current = false;
      setReturnBusy(false);
    }
  }

  function rejectOperation() {
    if (!isDemo) {
      setFeedback("Registre a reprovação no item da alçada responsável para preservar autoridade e trilha.");
      return;
    }
    if (observation.trim().length < 8) {
      setFeedback("Registre uma justificativa com pelo menos oito caracteres antes de reprovar a operação.");
      return;
    }
    const audit = [
      ...(review.audit ?? []),
      { at: nowLabel(), by: "Henrique", action: "Operação reprovada", detail: observation.trim() },
    ];
    onChange({
      ...operation,
      status: "Em atenção",
      blockers: Math.max(1, operation.blockers),
      nextAction: "Operação reprovada — revisar decisão registrada",
      approvalReview: {
        ...review,
        status: "Reprovada",
        observation,
        finalDecision: {
          outcome: "REPROVADA",
          decidedAt: nowLabel(),
          decidedBy: "Henrique",
          justification: observation.trim(),
        },
        audit,
      },
    });
    setFeedback("Reprovação registrada. A operação permanece bloqueada e auditável.");
  }

  function sendForSignatures() {
    if (review.status !== "Aprovada" && review.status !== "Em formalização") {
      setFeedback("A operação precisa estar aprovada antes do envio para assinatura.");
      return;
    }
    const sent = signatures.map(item =>
      item.status === "Não enviado" ? { ...item, status: "Enviado" as const, sentAt: nowLabel() } : item,
    );
    saveReview(
      { status: "Em formalização", signatures: sent },
      "Formalização iniciada",
      `${sent.length} assinatura(s) solicitada(s)`,
    );
    setFeedback("Documentos preparados e enviados para assinatura na simulação.");
  }

  function registerSignature(id: string) {
    if (!isDemo) {
      openManualSignature(id);
      return;
    }
    const nextSignatures = signatures.map(item =>
      item.id === id
        ? { ...item, status: "Assinado" as const, signedAt: nowLabel(), sentAt: item.sentAt ?? nowLabel() }
        : item,
    );
    saveReview(
      { status: "Em formalização", signatures: nextSignatures },
      "Assinatura registrada",
      nextSignatures.find(item => item.id === id)?.party ?? id,
      true,
    );
    setFeedback(
      nextSignatures.every(item => item.status === "Assinado")
        ? "Todas as partes assinaram. A operação foi disponibilizada automaticamente para Liberação."
        : "Assinatura registrada. Ainda existem partes aguardando assinatura.",
    );
  }

  function openManualSignature(id: string) {
    if (attachmentBusy) return;
    if (review.status !== "Aprovada" && review.status !== "Em formalização") {
      setFeedback("A operação precisa estar aprovada antes do registro de assinaturas.");
      return;
    }
    setAttachmentFile(null);
    setManualDraft(emptyManualDraft(localDateISO()));
    setManualSignatureId(id);
  }

  async function confirmManualSignature() {
    if (!manualSignatureId || attachmentBusy) return;
    if (!manualDraft.signedDate) {
      setFeedback("Informe a data da assinatura manual.");
      return;
    }
    if (manualDraft.reason === "Outro" && !manualDraft.notes.trim()) {
      setFeedback("Descreva o motivo da assinatura manual.");
      return;
    }
    const reason =
      manualDraft.reason === "Outro"
        ? manualDraft.notes.trim()
        : [manualDraft.reason, manualDraft.notes.trim()].filter(Boolean).join(" · ");
    let attachment: UploadedDocument | undefined;
    if (attachmentFile) {
      if (attachmentFile.operationId !== operation.id) {
        setFeedback("Selecione novamente o anexo nesta operação.");
        return;
      }
      setAttachmentBusy(true);
      try {
        attachment = await uploadOperationDocument(operation.id, attachmentFile.file);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao preservar anexo.");
        return;
      } finally {
        setAttachmentBusy(false);
      }
      if (currentOperationId.current !== operation.id) return;
    }
    const nextSignatures = signatures.map(item =>
      item.id === manualSignatureId
        ? {
            ...item,
            status: "Assinado" as const,
            method: "Manual" as const,
            signedAt: nowLabel(),
            manualSignedDate: manualDraft.signedDate,
            manualReason: reason,
            attachmentName: attachment?.name,
            attachmentId: attachment?.id,
            attachmentHash: attachment?.sha256,
            attachmentMime: attachment?.mime,
            attachmentSize: attachment?.size,
            registeredBy: "Henrique",
          }
        : item,
    );
    const party = nextSignatures.find(item => item.id === manualSignatureId)?.party ?? manualSignatureId;
    saveReview(
      { status: "Em formalização", signatures: nextSignatures },
      "Assinatura manual registrada",
      `${party} · ${formatBrazilianDate(manualDraft.signedDate)} · ${reason}${manualDraft.attachmentName ? ` · anexo ${manualDraft.attachmentName}` : ""}`,
      true,
    );
    setManualSignatureId(null);
    setFeedback(
      nextSignatures.every(item => item.status === "Assinado")
        ? "Todas as partes assinaram. A operação foi disponibilizada automaticamente para Liberação."
        : "Assinatura manual registrada. Ainda existem partes aguardando assinatura.",
    );
  }

  function undoManualSignature(id: string) {
    const nextSignatures = signatures.map(item =>
      item.id === id
        ? {
            ...item,
            status: item.sentAt ? ("Enviado" as const) : ("Não enviado" as const),
            method: undefined,
            signedAt: undefined,
            manualSignedDate: undefined,
            manualReason: undefined,
            attachmentName: undefined,
            attachmentId: undefined,
            attachmentHash: undefined,
            attachmentMime: undefined,
            attachmentSize: undefined,
            registeredBy: undefined,
          }
        : item,
    );
    saveReview(
      { signatures: nextSignatures },
      "Assinatura manual desfeita",
      nextSignatures.find(item => item.id === id)?.party ?? id,
    );
    setFeedback("Registro de assinatura manual desfeito.");
  }

  function toggleDocument(id: string) {
    const nextDocuments = documents.map(item =>
      item.id === id
        ? { ...item, status: item.status === "Pronto" ? ("Pendente" as const) : ("Pronto" as const) }
        : item,
    );
    saveReview(
      { documents: nextDocuments },
      "Documento atualizado",
      nextDocuments.find(item => item.id === id)?.name ?? id,
    );
  }

  return (
    <section className="approval-workbench">
      <ApprovalDecisionSummary operation={operation} figures={figures} />
      <ApprovalFooter
        busy={returnBusy || decisionBusy || attachmentBusy}
        status={review.status}
        prerequisitesReady={prerequisitesReady}
        observation={observation}
        onObservationChange={setObservation}
        onSubmit={submitForApproval}
        onApprove={approveOperation}
        onReturn={returnToRisk}
        onReject={rejectOperation}
      />
      <ApprovalFinancialSummary
        operation={operation}
        figures={figures}
        prerequisitesReady={prerequisitesReady}
        {...sectionToggle("financial")}
      />
      <ApprovalStatusStrip
        counters={{
          readinessDone: checklist.filter(item => item.ok).length,
          readinessTotal: checklist.length,
          approvedCount,
          approvalsTotal: approvals.length,
          readyDocuments,
          documentsTotal: documents.length,
          signedCount,
          signaturesTotal: signatures.length,
          sentSignatures: signatures.filter(item => item.status === "Enviado").length,
        }}
      />
      <div className="approval-layout">
        <div className="approval-main-column">
          <ApprovalReadiness checklist={checklist} {...sectionToggle("readiness")} />
          <ApprovalAuthorities
            approvals={approvals}
            approvedCount={approvedCount}
            onDecide={decideApproval}
            {...sectionToggle("approvals")}
          />
        </div>
        <aside className="approval-side-column">
          <ApprovalDocuments
            documents={documents}
            readyDocuments={readyDocuments}
            onToggleDocument={toggleDocument}
            {...sectionToggle("documents")}
          />
          <ApprovalSignatures
            operationId={operation.id}
            onAttachmentChange={file => setAttachmentFile(file ? { file, operationId: operation.id } : null)}
            busy={attachmentBusy}
            signatures={signatures}
            signedCount={signedCount}
            canUndoManual={operation.stage === 5}
            manualSignatureId={manualSignatureId}
            manualDraft={manualDraft}
            onManualDraftChange={setManualDraft}
            onConfigureProvider={() =>
              setFeedback("A configuração do provedor de assinatura ficará disponível nas integrações da empresa.")
            }
            onRegisterSignature={registerSignature}
            onOpenManual={openManualSignature}
            onCancelManual={() => {
              if (!attachmentBusy) setManualSignatureId(null);
            }}
            onConfirmManual={confirmManualSignature}
            onUndoManual={undoManualSignature}
            onSendForSignatures={sendForSignatures}
            {...sectionToggle("signatures")}
          />
        </aside>
      </div>
      <ApprovalReports onOpenReport={setReportType} {...sectionToggle("reports")} />
      <ApprovalTimeline events={approvalTimeline} {...sectionToggle("timeline")} />
      {feedback && <ApprovalFeedback message={feedback} onDismiss={() => setFeedback("")} />}
      {reportType && (
        <ReportPreviewModal
          reportType={reportType}
          operation={operation}
          figures={figures}
          onClose={() => setReportType(null)}
        />
      )}
    </section>
  );
}
