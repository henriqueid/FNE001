"use client";

/**
 * Agendar e registrar visita (resultado, próximo passo ou motivo).
 */
import { recordVisit, scheduleVisit } from "@/src/domain/commercial/actions";
import { type CResult, type CommercialState, type Visit, type VisitKind } from "@/src/domain/commercial/types";
import { addDays, todayIso } from "@/src/domain/finance/ledger";
import { Field, Modal, br } from "@/src/features/finance/finance-ui";
import { useState } from "react";

export function VisitModal({
  state,
  visit,
  defaultRep,
  onClose,
  onApply,
}: {
  state: CommercialState;
  visit?: Visit;
  defaultRep: string;
  onClose: () => void;
  onApply: (r: CResult) => boolean;
}) {
  const targets = [...state.links.map(l => l.clientName), ...state.prospects.filter(p => !p.lost).map(p => p.name)];
  const [form, setForm] = useState({
    repId: defaultRep || state.reps[0].id,
    target: "",
    date: addDays(todayIso(), 1),
    time: "10:00",
    kind: "Relacionamento" as VisitKind,
    address: "",
    notes: "",
  });
  const [result, setResult] = useState<{ status: Visit["status"]; outcome: string; nextStep: string; notes: string }>({
    status: "Realizada",
    outcome: "",
    nextStep: "",
    notes: "",
  });
  if (visit)
    return (
      <Modal
        title="Registrar visita"
        subtitle={`${visit.target} · ${br(visit.date)} às ${visit.time} · ${state.reps.find(r => r.id === visit.repId)?.name}`}
        onClose={onClose}
        footer={
          <>
            <button className="fn-btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="fn-btn primary"
              onClick={() => {
                if (onApply(recordVisit(state, visit.id, result))) onClose();
              }}
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="fn-form single">
          <Field label="O que aconteceu">
            <select
              value={result.status}
              onChange={e => setResult({ ...result, status: e.target.value as Visit["status"] })}
            >
              <option>Realizada</option>
              <option>Não realizada</option>
              <option>Cancelada</option>
            </select>
          </Field>
          {result.status === "Realizada" ? (
            <>
              <Field label="Resultado">
                <textarea
                  rows={3}
                  value={result.outcome}
                  onChange={e => setResult({ ...result, outcome: e.target.value })}
                  placeholder="Ex.: pediu proposta para R$ 300 mil/mês"
                />
              </Field>
              <Field label="Próximo passo">
                <input
                  value={result.nextStep}
                  onChange={e => setResult({ ...result, nextStep: e.target.value })}
                  placeholder="Ex.: enviar proposta até sexta"
                />
              </Field>
            </>
          ) : (
            <Field label="Motivo">
              <input value={result.notes} onChange={e => setResult({ ...result, notes: e.target.value })} />
            </Field>
          )}
        </div>
      </Modal>
    );
  const link = state.links.find(l => l.clientName === form.target);
  return (
    <Modal
      title="Agendar visita"
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
                  scheduleVisit(state, {
                    ...form,
                    document: link?.document,
                    address: form.address || link?.city || "",
                  }),
                )
              )
                onClose();
            }}
          >
            Agendar
          </button>
        </>
      }
    >
      <div className="fn-form">
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
        <Field label="Tipo">
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as VisitKind })}>
            {(["Prospecção", "Relacionamento", "Renegociação", "Pós-venda", "Cobrança"] as VisitKind[]).map(k => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Cliente ou prospect" wide>
          <input
            list="cm-targets"
            value={form.target}
            onChange={e => setForm({ ...form, target: e.target.value })}
            placeholder="Digite ou escolha"
          />
          <datalist id="cm-targets">
            {targets.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Data">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Hora">
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        </Field>
        <Field label="Local" wide>
          <input
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder={link?.city ?? "Cidade ou endereço"}
          />
        </Field>
      </div>
    </Modal>
  );
}
