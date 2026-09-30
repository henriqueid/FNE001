"use client";
/**
 * Etapa de Aprovação e formalização da operação. Este componente concentra o
 * estado (observação, avisos, seções recolhidas, prévia de relatório e
 * assinatura manual) e as ações que gravam no `approvalReview` com registro na
 * trilha; a apresentação fica nos cartões irmãos desta pasta e os cálculos em
 * `approval-model.ts`.
 */
import { useCedents } from "@/src/app/registry-context";
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { localDateISO } from "@/src/domain/operations/dates";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import { lastroAssessmentFor } from "@/src/domain/operations/lastro";
import { useState } from "react";
import { ApprovalAuthorities } from "./approval-authorities";
import { ApprovalDocuments } from "./approval-documents";
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
} from "./approval-model";
import { ApprovalReadiness } from "./approval-readiness";
import { ApprovalReports } from "./approval-reports";
import { ApprovalSignatures } from "./approval-signatures";
import { ApprovalFeedback, ApprovalFooter, ApprovalHero, ApprovalStatusStrip } from "./approval-status";
import { ApprovalTimeline } from "./approval-timeline";
import { ReportPreviewModal } from "./report-preview-modal";

type CollapsibleSection = "financial" | "readiness" | "approvals" | "documents" | "signatures" | "reports" | "timeline";

export function ApprovalPanel({
  operation,
  onChange,
}: {
  operation: Operation;
  onChange: (operation: Operation) => void;
}) {
  const registryCedents = useCedents();
  const figures = buildFinancialFigures(operation, registryCedents);
  const { finalNet } = figures;
  const lastro = lastroAssessmentFor(operation);
  const checklist = buildReadinessChecklist(operation, lastro);
  const prerequisitesReady = checklist.every(item => item.ok);
  const defaultApprovals = buildDefaultApprovals(operation, prerequisitesReady);
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

  /** Props de recolher/expandir para a seção informada. */
  function sectionToggle(section: CollapsibleSection) {
    return {
      collapsed: Boolean(collapsedSections[section]),
      onToggle: () => setCollapsedSections(current => ({ ...current, [section]: !current[section] })),
    };
  }

  function saveReview(change: Partial<ApprovalReview>, action: string, detail: string) {
    const next = {
      ...review,
      ...change,
      approvals: change.approvals ?? approvals,
      documents: change.documents ?? documents,
      signatures: change.signatures ?? signatures,
      audit: [...(review.audit ?? []), { at: nowLabel(), by: "Henrique", action, detail }],
    };
    onChange({ ...operation, approvalReview: next });
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
    if (approvals.some(item => item.status !== "Aprovado")) {
      setFeedback("Ainda existem alçadas pendentes ou reprovadas.");
      return;
    }
    saveReview(
      { status: "Aprovada", observation },
      "Operação aprovada",
      `Líquido aprovado: ${preciseMoney.format(finalNet)}`,
    );
    setFeedback("Operação aprovada. O pacote está pronto para envio às assinaturas.");
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
    const nextSignatures = signatures.map(item =>
      item.id === id
        ? { ...item, status: "Assinado" as const, signedAt: nowLabel(), sentAt: item.sentAt ?? nowLabel() }
        : item,
    );
    saveReview(
      { status: "Em formalização", signatures: nextSignatures },
      "Assinatura registrada",
      nextSignatures.find(item => item.id === id)?.party ?? id,
    );
    setFeedback(
      nextSignatures.every(item => item.status === "Assinado")
        ? "Todas as partes assinaram. A operação está pronta para seguir à liberação."
        : "Assinatura registrada. Ainda existem partes aguardando assinatura.",
    );
  }

  function openManualSignature(id: string) {
    if (review.status !== "Aprovada" && review.status !== "Em formalização") {
      setFeedback("A operação precisa estar aprovada antes do registro de assinaturas.");
      return;
    }
    setManualDraft(emptyManualDraft(localDateISO()));
    setManualSignatureId(id);
  }

  function confirmManualSignature() {
    if (!manualSignatureId) return;
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
    const nextSignatures = signatures.map(item =>
      item.id === manualSignatureId
        ? {
            ...item,
            status: "Assinado" as const,
            method: "Manual" as const,
            signedAt: nowLabel(),
            manualSignedDate: manualDraft.signedDate,
            manualReason: reason,
            attachmentName: manualDraft.attachmentName || undefined,
            registeredBy: "Henrique",
          }
        : item,
    );
    const party = nextSignatures.find(item => item.id === manualSignatureId)?.party ?? manualSignatureId;
    saveReview(
      { status: "Em formalização", signatures: nextSignatures },
      "Assinatura manual registrada",
      `${party} · ${formatBrazilianDate(manualDraft.signedDate)} · ${reason}${manualDraft.attachmentName ? ` · anexo ${manualDraft.attachmentName}` : ""}`,
    );
    setManualSignatureId(null);
    setFeedback(
      nextSignatures.every(item => item.status === "Assinado")
        ? "Todas as partes assinaram. A operação está pronta para seguir à liberação."
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
      <ApprovalHero status={review.status} />
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
            observation={observation}
            onObservationChange={setObservation}
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
            onCancelManual={() => setManualSignatureId(null)}
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
      <ApprovalFooter
        status={review.status}
        prerequisitesReady={prerequisitesReady}
        onSubmit={submitForApproval}
        onApprove={approveOperation}
      />
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
