"use client";

/**
 * Pedido e decisão de comitê (com pareceres, ressalvas e motivo obrigatório).
 */
import { decideCommittee, submitCommittee } from "@/src/domain/commercial/actions";
import {
  type CResult,
  type CommercialState,
  type Committee,
  type CommitteeRequest,
  type CommitteeStatus,
} from "@/src/domain/commercial/types";
import { addDays, todayIso } from "@/src/domain/finance/ledger";
import { inputMoney, num } from "@/src/features/commercial/commercial-ui";
import { BY, Field, Modal, money } from "@/src/features/finance/finance-ui";
import { useState } from "react";

export function CommitteeModal({
  state,
  committee,
  preset,
  onClose,
  onApply,
}: {
  state: CommercialState;
  committee?: Committee;
  preset?: Partial<Committee>;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const [form, setForm] = useState({
    clientName: preset?.clientName ?? "",
    document: preset?.document ?? "",
    repId: preset?.repId ?? state.reps[0].id,
    request: (preset?.request ?? "Limite inicial") as CommitteeRequest,
    requested: inputMoney(preset?.requested ?? 0),
    rate: "",
    commercialOpinion: "",
    date: nextCommitteeDate(),
  });
  const [decision, setDecision] = useState({
    status: "Aprovado" as Exclude<CommitteeStatus, "Em pauta">,
    approved: inputMoney(committee?.requested ?? 0),
    rate: committee?.rate ? String(committee.rate).replace(".", ",") : "",
    conditions: "",
    riskOpinion: committee?.riskOpinion ?? "",
    date: addDays(committee?.date ?? todayIso(), 7),
  });
  if (committee)
    return (
      <Modal
        wide
        title="Registrar decisão do comitê"
        subtitle={`${committee.clientName} · ${committee.request} · ${state.reps.find(r => r.id === committee.repId)?.name}`}
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
                    decideCommittee(
                      state,
                      committee.id,
                      {
                        status: decision.status,
                        approved: num(decision.approved),
                        rate: decision.rate ? num(decision.rate) : undefined,
                        conditions: decision.conditions,
                        riskOpinion: decision.riskOpinion,
                        date: decision.date,
                      },
                      BY,
                    ),
                  )
                )
                  onClose();
              }}
            >
              Registrar decisão
            </button>
          </>
        }
      >
        <div className="cm-opinions">
          <div>
            <span>Solicitado</span>
            <b>
              {committee.request === "Taxa especial"
                ? `${String(committee.rate ?? "").replace(".", ",")}% a.m.`
                : money(committee.requested)}
            </b>
          </div>
          <div>
            <span>Parecer comercial</span>
            <p>{committee.commercialOpinion}</p>
          </div>
          {committee.riskOpinion && (
            <div>
              <span>Parecer de risco</span>
              <p>{committee.riskOpinion}</p>
            </div>
          )}
        </div>
        <div className="fn-form">
          <Field label="Decisão">
            <select
              value={decision.status}
              onChange={e => setDecision({ ...decision, status: e.target.value as typeof decision.status })}
            >
              <option>Aprovado</option>
              <option>Aprovado com ressalvas</option>
              <option>Reprovado</option>
              <option>Adiado</option>
            </select>
          </Field>
          {(decision.status === "Aprovado" || decision.status === "Aprovado com ressalvas") &&
            committee.request !== "Taxa especial" && (
              <Field label="Valor aprovado (R$)">
                <input
                  inputMode="decimal"
                  value={decision.approved}
                  onChange={e => setDecision({ ...decision, approved: e.target.value.replace(/[^\d.,]/g, "") })}
                />
              </Field>
            )}
          {(decision.status === "Aprovado" || decision.status === "Aprovado com ressalvas") && (
            <Field label="Taxa aprovada (% a.m.)">
              <input
                inputMode="decimal"
                value={decision.rate}
                onChange={e => setDecision({ ...decision, rate: e.target.value.replace(/[^\d.,]/g, "") })}
              />
            </Field>
          )}
          {decision.status === "Adiado" && (
            <Field label="Nova data">
              <input
                type="date"
                value={decision.date}
                onChange={e => setDecision({ ...decision, date: e.target.value })}
              />
            </Field>
          )}
          <Field
            label={
              decision.status === "Aprovado com ressalvas"
                ? "Ressalvas"
                : decision.status === "Aprovado"
                  ? "Condições (opcional)"
                  : "Motivo"
            }
            wide
          >
            <textarea
              rows={3}
              value={decision.conditions}
              onChange={e => setDecision({ ...decision, conditions: e.target.value })}
            />
          </Field>
          <Field label="Parecer de risco" wide>
            <textarea
              rows={2}
              value={decision.riskOpinion}
              onChange={e => setDecision({ ...decision, riskOpinion: e.target.value })}
            />
          </Field>
        </div>
        <p className="fn-note">
          Participantes: {committee.members.join(", ")}. A decisão entra no histórico do cliente e, se aprovada,
          atualiza o limite na carteira do comercial.
        </p>
      </Modal>
    );
  const known = state.links.find(l => l.clientName === form.clientName);
  return (
    <Modal
      wide
      title="Enviar pedido ao comitê"
      subtitle="O pedido entra na pauta da próxima reunião"
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
                  submitCommittee(
                    state,
                    {
                      ...form,
                      document: form.document || known?.document,
                      requested: num(form.requested),
                      rate: form.rate ? num(form.rate) : undefined,
                    },
                    BY,
                  ),
                )
              )
                onClose();
            }}
          >
            Incluir na pauta
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Cliente ou prospect" wide>
          <input
            list="cm-committee-targets"
            value={form.clientName}
            onChange={e => {
              const l = state.links.find(x => x.clientName === e.target.value);
              const p = state.prospects.find(x => x.name === e.target.value);
              setForm({
                ...form,
                clientName: e.target.value,
                repId: l?.repId ?? p?.repId ?? form.repId,
                document: l?.document ?? form.document,
                request: l ? "Aumento de limite" : form.request,
              });
            }}
          />
          <datalist id="cm-committee-targets">
            {[...state.links.map(l => l.clientName), ...state.prospects.filter(p => !p.lost).map(p => p.name)].map(
              t => (
                <option key={t} value={t} />
              ),
            )}
          </datalist>
        </Field>
        <Field label="Comercial responsável">
          <select value={form.repId} onChange={e => setForm({ ...form, repId: e.target.value })}>
            {state.reps.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pedido">
          <select
            value={form.request}
            onChange={e => setForm({ ...form, request: e.target.value as CommitteeRequest })}
          >
            {(
              [
                "Limite inicial",
                "Aumento de limite",
                "Renovação de limite",
                "Taxa especial",
                "Concentração de sacado",
              ] as CommitteeRequest[]
            ).map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        {form.request !== "Taxa especial" && (
          <Field label="Valor solicitado (R$)">
            <input
              inputMode="decimal"
              value={form.requested}
              onChange={e => setForm({ ...form, requested: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </Field>
        )}
        <Field label="Taxa proposta (% a.m.)">
          <input
            inputMode="decimal"
            value={form.rate}
            onChange={e => setForm({ ...form, rate: e.target.value.replace(/[^\d.,]/g, "") })}
            placeholder="Opcional"
          />
        </Field>
        <Field label="Data do comitê">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Parecer comercial" wide>
          <textarea
            rows={4}
            value={form.commercialOpinion}
            onChange={e => setForm({ ...form, commercialOpinion: e.target.value })}
            placeholder="Quem é o cliente, faturamento, sacados, por que agora e o que o comercial recomenda"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function nextCommitteeDate() {
  const d = new Date(`${todayIso()}T12:00:00`);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== 2 && d.getDay() !== 4);
  return d.toISOString().slice(0, 10);
}
