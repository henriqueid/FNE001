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
}: {
  draft: ManualSignatureDraft;
  onDraftChange: Dispatch<SetStateAction<ManualSignatureDraft>>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="manual-signature-form">
      <strong>Registro de assinatura manual</strong>
      <small>Use quando a parte assinou fora do provedor eletrônico. O registro fica na trilha de auditoria.</small>
      <label>
        <span>Data da assinatura</span>
        <input
          type="date"
          value={draft.signedDate}
          max={localDateISO()}
          onChange={e => onDraftChange(d => ({ ...d, signedDate: e.target.value }))}
        />
      </label>
      <label>
        <span>Motivo</span>
        <select value={draft.reason} onChange={e => onDraftChange(d => ({ ...d, reason: e.target.value }))}>
          {manualReasons.map(reason => (
            <option key={reason}>{reason}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span>{draft.reason === "Outro" ? "Descreva o motivo (obrigatório)" : "Observação (opcional)"}</span>
        <input
          value={draft.notes}
          onChange={e => onDraftChange(d => ({ ...d, notes: e.target.value }))}
          placeholder="Ex.: via original arquivada na pasta física do cedente"
        />
      </label>
      <label className="wide">
        <span>Contrato digitalizado (opcional)</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => onDraftChange(d => ({ ...d, attachmentName: e.target.files?.[0]?.name ?? "" }))}
        />
      </label>
      <div className="manual-signature-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button className="confirm" onClick={onConfirm}>
          Confirmar assinatura manual
        </button>
      </div>
    </div>
  );
}
