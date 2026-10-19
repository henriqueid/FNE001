"use client";
/**
 * Formulário inline para registrar a assinatura manual de uma parte (data,
 * motivo, observação e contrato digitalizado). Só edita o rascunho recebido;
 * a validação e o registro na trilha ficam no painel.
 */
import { localDateISO } from "@/src/domain/operations/dates";
import type { Dispatch, SetStateAction } from "react";
import { manualReasons, type ManualSignatureDraft } from "./approval-model";

export function ManualSignatureForm({
  draft,
  onDraftChange,
  onCancel,
  onConfirm,
  onAttachmentChange,
  busy,
}: {
  draft: ManualSignatureDraft;
  onDraftChange: Dispatch<SetStateAction<ManualSignatureDraft>>;
  onCancel: () => void;
  onConfirm: () => void;
  onAttachmentChange: (file: File | null) => void;
  busy: boolean;
}) {
  return (
    <div className="manual-signature-form">
      <strong>Registro de assinatura manual</strong>
      <small>Use quando a parte assinou fora do provedor eletrônico. O registro fica na trilha de auditoria.</small>
      <label>
        <span>Data da assinatura</span>
        <input
          disabled={busy}
          type="date"
          value={draft.signedDate}
          max={localDateISO()}
          onChange={e => onDraftChange(d => ({ ...d, signedDate: e.target.value }))}
        />
      </label>
      <label>
        <span>Motivo</span>
        <select
          disabled={busy}
          value={draft.reason}
          onChange={e => onDraftChange(d => ({ ...d, reason: e.target.value }))}
        >
          {manualReasons.map(reason => (
            <option key={reason}>{reason}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span>{draft.reason === "Outro" ? "Descreva o motivo (obrigatório)" : "Observação (opcional)"}</span>
        <input
          disabled={busy}
          value={draft.notes}
          onChange={e => onDraftChange(d => ({ ...d, notes: e.target.value }))}
          placeholder="Ex.: via original arquivada na pasta física do cedente"
        />
      </label>
      <label className="wide">
        <span>Contrato digitalizado (opcional)</span>
        <input
          disabled={busy}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => {
            const file = e.target.files?.[0] ?? null;
            onAttachmentChange(file);
            onDraftChange(d => ({ ...d, attachmentName: file?.name ?? "" }));
          }}
        />
      </label>
      <div className="manual-signature-actions">
        <button disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button disabled={busy} className="confirm" onClick={onConfirm}>
          {busy ? "Preservando anexo…" : "Confirmar assinatura manual"}
        </button>
      </div>
    </div>
  );
}
