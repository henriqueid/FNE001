"use client";

/**
 * Cadastro rápido e edição de comercial dentro do Comercial.
 */
import { saveRep } from "@/src/domain/commercial/actions";
import { type CResult, type CommercialState, type SalesRep } from "@/src/domain/commercial/types";
import { todayIso } from "@/src/domain/finance/ledger";
import { inputMoney, num } from "@/src/features/commercial/commercial-ui";
import { Field, Modal } from "@/src/features/finance/finance-ui";
import { useState } from "react";

export function RepModal({
  state,
  rep,
  onClose,
  onApply,
}: {
  state: CommercialState;
  rep?: SalesRep;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [form, setForm] = useState<SalesRep>(
    rep ?? {
      id: "",
      name: "",
      initials: "",
      role: "Executivo comercial",
      kind: "CLT",
      region: "",
      email: "",
      phone: "",
      document: "",
      company: "Lastro Fomento Mercantil",
      monthlyGoal: 30_000,
      active: true,
      since: todayIso(),
    },
  );
  const [goal, setGoal] = useState(inputMoney(form.monthlyGoal));
  const [flat, setFlat] = useState(form.flatRate ? String(form.flatRate).replace(".", ",") : "");
  return (
    <Modal
      title={rep ? "Editar comercial" : "Novo comercial"}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => {
              if (onApply(saveRep(state, { ...form, monthlyGoal: num(goal), flatRate: flat ? num(flat) : undefined })))
                onClose();
            }}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Nome" wide>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Vínculo">
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as SalesRep["kind"] })}>
            <option>CLT</option>
            <option>Agente autônomo</option>
          </select>
        </Field>
        <Field label="Cargo">
          <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
        </Field>
        <Field label="Região ou carteira" wide>
          <input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label={form.kind === "CLT" ? "CPF" : "CNPJ"} hint="Usado no lançamento a pagar da comissão">
          <input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} />
        </Field>
        <Field label="Meta mensal de receita (R$)">
          <input inputMode="decimal" value={goal} onChange={e => setGoal(e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field label="% fixo sobre a base" hint="Deixe vazio para usar as faixas por meta. Comum para agentes.">
          <input inputMode="decimal" value={flat} onChange={e => setFlat(e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field label="Situação">
          <select
            value={form.active ? "Ativo" : "Inativo"}
            onChange={e => setForm({ ...form, active: e.target.value === "Ativo" })}
          >
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
