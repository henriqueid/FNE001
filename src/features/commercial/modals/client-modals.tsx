"use client";

/**
 * Modais de cliente do Comercial: transferir, nova oportunidade, converter em conta nova e marcar perda.
 */
import { addProspect, convertProspect, moveProspect, transferClient } from "@/src/domain/commercial/actions";
import {
  type CResult,
  type ClientLink,
  type CommercialState,
  type LinkOrigin,
  type Prospect,
} from "@/src/domain/commercial/types";
import { inputMoney, num } from "@/src/features/commercial/commercial-ui";
import { BY, Field, Modal } from "@/src/features/finance/finance-ui";
import { useState } from "react";

export function TransferModal({
  state,
  link,
  onClose,
  onApply,
}: {
  state: CommercialState;
  link: ClientLink;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [to, setTo] = useState(state.reps.find(r => r.id !== link.repId && r.active)?.id ?? "");
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Transferir cliente"
      subtitle={`${link.clientName} · hoje com ${state.reps.find(r => r.id === link.repId)?.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => {
              if (onApply(transferClient(state, link.id, to, reason, BY))) onClose();
            }}
          >
            Transferir
          </button>
        </>
      }
    >
      <div className="fn-form single">
        <Field label="Novo comercial">
          <select value={to} onChange={e => setTo(e.target.value)}>
            {state.reps
              .filter(r => r.id !== link.repId && r.active)
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Motivo">
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex.: reorganização da carteira"
          />
        </Field>
      </div>
      <p className="fn-note">
        Os negócios já feitos e as comissões fechadas continuam com o comercial atual. Só as próximas operações contam
        para o novo.
      </p>
    </Modal>
  );
}

export function ProspectModal({
  state,
  defaultRep,
  onClose,
  onApply,
}: {
  state: CommercialState;
  defaultRep: string;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    repId: defaultRep || state.reps[0].id,
    potential: "",
    source: "Prospecção ativa" as LinkOrigin,
    nextStep: "",
  });
  return (
    <Modal
      title="Nova oportunidade"
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => {
              if (
                onApply(
                  addProspect(state, {
                    ...form,
                    potential: num(form.potential),
                    nextStep: form.nextStep || "Primeiro contato",
                  }),
                )
              )
                onClose();
            }}
          >
            Criar
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Empresa" wide>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Comercial">
          <select value={form.repId} onChange={e => setForm({ ...form, repId: e.target.value })}>
            {state.reps
              .filter(r => r.active)
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Origem">
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as LinkOrigin })}>
            <option>Prospecção ativa</option>
            <option>Indicação</option>
            <option>Inbound</option>
          </select>
        </Field>
        <Field label="Potencial de volume mensal (R$)">
          <input
            inputMode="decimal"
            value={form.potential}
            onChange={e => setForm({ ...form, potential: e.target.value.replace(/[^\d.,]/g, "") })}
          />
        </Field>
        <Field label="Próximo passo">
          <input value={form.nextStep} onChange={e => setForm({ ...form, nextStep: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function ConvertModal({
  state,
  prospect,
  onClose,
  onApply,
}: {
  state: CommercialState;
  prospect: Prospect;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const approved = state.committees.find(c => c.clientName === prospect.name && c.approved);
  const [form, setForm] = useState({ document: "", limit: inputMoney(approved?.approved ?? 0), segment: "", city: "" });
  return (
    <Modal
      title="Virar conta nova"
      subtitle={`${prospect.name} · ${state.reps.find(r => r.id === prospect.repId)?.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => {
              if (
                onApply(
                  convertProspect(state, prospect.id, {
                    document: form.document,
                    approvedLimit: num(form.limit),
                    segment: form.segment || "—",
                    city: form.city || "—",
                  }),
                )
              )
                onClose();
            }}
          >
            Criar conta nova
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="CNPJ">
          <input
            value={form.document}
            onChange={e => setForm({ ...form, document: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </Field>
        <Field label="Limite aprovado (R$)">
          <input
            inputMode="decimal"
            value={form.limit}
            onChange={e => setForm({ ...form, limit: e.target.value.replace(/[^\d.,]/g, "") })}
          />
        </Field>
        <Field label="Segmento">
          <input value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })} />
        </Field>
        <Field label="Cidade">
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        </Field>
      </div>
      <p className="fn-note">
        A conta nova fica vinculada ao comercial a partir de hoje. O bônus é pago quando ela fizer a 1ª operação em até{" "}
        {state.rules.newAccountWindow} dias.
      </p>
    </Modal>
  );
}

export function LostModal({
  state,
  prospect,
  onClose,
  onApply,
}: {
  state: CommercialState;
  prospect: Prospect;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Marcar como perdida"
      subtitle={prospect.name}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn danger"
            onClick={() => {
              if (onApply(moveProspect(state, prospect.id, "Perdido", reason))) onClose();
            }}
          >
            Marcar como perdida
          </button>
        </>
      }
    >
      <div className="fn-form single">
        <Field label="Motivo">
          <select value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Escolha</option>
            <option>Taxa da concorrência</option>
            <option>Reprovado no comitê</option>
            <option>Sem faturamento a prazo</option>
            <option>Cliente desistiu</option>
            <option>Sem retorno</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
