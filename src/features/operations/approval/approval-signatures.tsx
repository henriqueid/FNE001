"use client";
/**
 * Cartão de assinaturas: aviso do provedor eletrônico, partes com status e
 * ações (registrar assinatura eletrônica, marcar/desfazer assinatura manual)
 * e o botão de envio para assinaturas.
 */
import { formatBrazilianDate } from "@/src/domain/operations/format";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, ArrowIcon } from "@/src/ui/icons";
import type { Dispatch, SetStateAction } from "react";
import { ApprovalCardHead, type SectionToggle } from "./approval-card-head";
import { type ApprovalSignature, type ManualSignatureDraft } from "./approval-model";
import { ManualSignatureForm } from "./manual-signature-form";

export function ApprovalSignatures({
  signatures,
  signedCount,
  canUndoManual,
  manualSignatureId,
  manualDraft,
  onManualDraftChange,
  onConfigureProvider,
  onRegisterSignature,
  onOpenManual,
  onCancelManual,
  onConfirmManual,
  onUndoManual,
  onSendForSignatures,
  collapsed,
  onToggle,
}: SectionToggle & {
  signatures: ApprovalSignature[];
  signedCount: number;
  /** Desfazer registro manual só é permitido enquanto a operação está na etapa 5. */
  canUndoManual: boolean;
  manualSignatureId: string | null;
  manualDraft: ManualSignatureDraft;
  onManualDraftChange: Dispatch<SetStateAction<ManualSignatureDraft>>;
  onConfigureProvider: () => void;
  onRegisterSignature: (id: string) => void;
  onOpenManual: (id: string) => void;
  onCancelManual: () => void;
  onConfirmManual: () => void;
  onUndoManual: (id: string) => void;
  onSendForSignatures: () => void;
}) {
  return (
    <section className={`approval-card signature-panel${collapsed ? " is-collapsed" : ""}`}>
      <ApprovalCardHead
        eyebrow="ASSINATURAS ELETRÔNICAS"
        title="Partes e andamento"
        meta={
          <>
            {signedCount}/{signatures.length} assinadas
          </>
        }
        toggleLabel="assinaturas"
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed && (
        <>
          <div className="signature-provider">
            <span>
              <AlertIcon />
            </span>
            <div>
              <strong>Integração aguardando configuração</strong>
              <small>
                O envio eletrônico será habilitado após conectar o provedor. Enquanto isso, registre as assinaturas
                manualmente em cada parte.
              </small>
            </div>
            <button onClick={onConfigureProvider}>Configurar</button>
          </div>
          <div className="signature-list">
            {signatures.map(item => (
              <div key={item.id}>
                <span>
                  <strong>{item.party}</strong>
                  <small>{item.signer}</small>
                </span>
                <Badge
                  tone={item.status === "Assinado" ? "ready" : item.status === "Recusado" ? "cancelled" : "default"}
                >
                  {item.status === "Assinado" && item.method === "Manual" ? "Assinado · manual" : item.status}
                </Badge>
                {item.sentAt && item.method !== "Manual" && <small>Enviado em {item.sentAt}</small>}
                {item.method === "Manual" && item.status === "Assinado" && (
                  <small className="manual-signature-note">
                    Assinado em {formatBrazilianDate(item.manualSignedDate)} · {item.manualReason}
                    {item.attachmentName ? ` · ${item.attachmentName}` : ""} · registrado por {item.registeredBy} em{" "}
                    {item.signedAt}
                  </small>
                )}
                {item.status !== "Assinado" && manualSignatureId !== item.id && (
                  <div className="signature-row-actions">
                    {item.status === "Enviado" && (
                      <button onClick={() => onRegisterSignature(item.id)}>Registrar assinatura eletrônica</button>
                    )}
                    <button className="manual" onClick={() => onOpenManual(item.id)}>
                      Marcar como assinado manualmente
                    </button>
                  </div>
                )}
                {item.method === "Manual" && item.status === "Assinado" && canUndoManual && (
                  <div className="signature-row-actions">
                    <button onClick={() => onUndoManual(item.id)}>Desfazer registro manual</button>
                  </div>
                )}
                {manualSignatureId === item.id && (
                  <ManualSignatureForm
                    draft={manualDraft}
                    onDraftChange={onManualDraftChange}
                    onCancel={onCancelManual}
                    onConfirm={onConfirmManual}
                  />
                )}
              </div>
            ))}
          </div>
          {signedCount < signatures.length && (
            <button className="approval-send-signature" onClick={onSendForSignatures}>
              Enviar para assinaturas <ArrowIcon />
            </button>
          )}
        </>
      )}
    </section>
  );
}
