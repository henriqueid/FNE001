"use client";

/**
 * Modais de vínculo comercial do cedente: transferir e vincular.
 */
import { useRegistry } from "@/src/app/registry-context";
import { type ClientLink, type LinkOrigin } from "@/src/domain/commercial/types";
import { type ClientRecord } from "@/src/domain/registry/registry";
import { Field, Modal } from "@/src/features/finance/finance-ui";
import { useState } from "react";
export function TransferModal({
  link,
  onClose,
  onSave,
}: {
  link: ClientLink;
  onClose: () => void;
  onSave: (to: string, reason: string) => void;
}) {
  const { commercial } = useRegistry();
  const [to, setTo] = useState(commercial.reps.find(r => r.id !== link.repId && r.active)?.id ?? "");
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={`Transferir ${link.clientName}`}
      subtitle={`Hoje com ${commercial.reps.find(r => r.id === link.repId)?.name}. Negócios anteriores continuam com o comercial atual.`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="fn-btn primary" onClick={() => onSave(to, reason)}>
            Transferir
          </button>
        </>
      }
    >
      <Field label="Novo comercial">
        <select value={to} onChange={e => setTo(e.target.value)}>
          {commercial.reps
            .filter(r => r.id !== link.repId)
            .map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Motivo" wide>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: redistribuição regional" />
      </Field>
    </Modal>
  );
}

export function LinkModal({
  record,
  onClose,
  onSave,
}: {
  record: ClientRecord;
  onClose: () => void;
  onSave: (repId: string, origin: LinkOrigin) => void;
}) {
  const { commercial } = useRegistry();
  const [repId, setRepId] = useState(commercial.reps.find(r => r.active)?.id ?? "");
  const [origin, setOrigin] = useState<LinkOrigin>("Prospecção ativa");
  return (
    <Modal
      title={`Vincular ${record.name}`}
      subtitle="O comercial passa a responder pelo cliente a partir de hoje."
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="fn-btn primary" onClick={() => onSave(repId, origin)}>
            Vincular
          </button>
        </>
      }
    >
      <Field label="Comercial responsável">
        <select value={repId} onChange={e => setRepId(e.target.value)}>
          {commercial.reps
            .filter(r => r.active)
            .map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Origem">
        <select value={origin} onChange={e => setOrigin(e.target.value as LinkOrigin)}>
          {(["Prospecção ativa", "Indicação", "Inbound", "Carteira transferida"] as LinkOrigin[]).map(o => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}
