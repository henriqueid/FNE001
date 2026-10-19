"use client";
/** Editor de regra de alçadas por empresa com proposta e dupla conferência. */
import { useEffect, useState } from "react";
import {
  changeApprovalPolicy,
  loadApprovalPolicy,
  type ApprovalPolicyConfiguration,
} from "@/src/app/operation-approval-client";
import type { ApprovalSlot } from "@/src/server/operations/approval-evidence";

export function PolicyApprovalPanel({
  companies,
  actorId,
  demoMode,
}: {
  companies: string[];
  actorId: string;
  demoMode?: boolean;
}) {
  const [company, setCompany] = useState(companies[0] ?? "");
  const selectedCompany = company || companies[0] || "";
  const [configuration, setConfiguration] = useState<ApprovalPolicyConfiguration>();
  const [slots, setSlots] = useState<ApprovalSlot[]>([{ id: "credito", authorityId: "", permission: "risk:decide" }]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (demoMode || !selectedCompany) return;
    let active = true;
    loadApprovalPolicy(selectedCompany)
      .then(state => {
        if (active) {
          setConfiguration(state);
          setSlots(state.policy?.slots ?? [{ id: "credito", authorityId: "", permission: "risk:decide" }]);
          setMessage("");
        }
      })
      .catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : "Não foi possível carregar a regra.");
      });
    return () => {
      active = false;
    };
  }, [selectedCompany, demoMode]);
  async function submit(action: "PROPOR" | "APROVAR" | "REJEITAR", proposalId?: string) {
    if (!configuration || busy) return;
    setBusy(true);
    try {
      const common = { company: selectedCompany, expectedVersion: configuration.version, reason };
      const state = await changeApprovalPolicy(
        action === "PROPOR" ? { ...common, action, slots } : { ...common, action, proposalId: proposalId ?? "" },
      );
      setConfiguration(state);
      setMessage(
        action === "PROPOR"
          ? "Proposta registrada. Outra pessoa deve conferir e aprovar."
          : "Decisão registrada na trilha da empresa.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar a regra.");
    } finally {
      setBusy(false);
    }
  }
  if (demoMode)
    return (
      <section className="settings-panel">
        <h3>Alçadas de aprovação</h3>
        <p>Regras formais são configuradas no ambiente autenticado. Este ambiente é demonstrativo.</p>
      </section>
    );
  return (
    <section className="settings-panel">
      <h3>Alçadas de aprovação por empresa</h3>
      <p>Defina cada decisão obrigatória. A proposta só entra em vigor após conferência por outra pessoa.</p>
      <label>
        Empresa
        <select
          value={selectedCompany}
          onChange={event => {
            setConfiguration(undefined);
            setCompany(event.target.value);
          }}
        >
          {companies.map(name => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {configuration && (
        <>
          <p>
            Versão {configuration.version} ·{" "}
            {configuration.policy ? `${configuration.policy.slots.length} alçada(s) vigente(s)` : "Sem regra vigente"}
          </p>
          {slots.map((slot, index) => (
            <div key={index} className="fn-form-row">
              <label>
                Identificador
                <input
                  value={slot.id}
                  onChange={event =>
                    setSlots(
                      slots.map((item, offset) => (offset === index ? { ...item, id: event.target.value } : item)),
                    )
                  }
                />
              </label>
              <label>
                Alçada
                <select
                  value={slot.authorityId}
                  onChange={event =>
                    setSlots(
                      slots.map((item, offset) =>
                        offset === index ? { ...item, authorityId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  <option value="">Selecione</option>
                  {configuration.authorities.map(id => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
              </label>
              <label>
                Área responsável
                <select
                  value={slot.permission}
                  onChange={event =>
                    setSlots(
                      slots.map((item, offset) =>
                        offset === index
                          ? { ...item, permission: event.target.value as ApprovalSlot["permission"] }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="risk:decide">Risco</option>
                  <option value="controlleria:formalize">Controladoria</option>
                </select>
              </label>
              <button
                type="button"
                className="fn-btn"
                disabled={busy || slots.length <= 1}
                onClick={() => setSlots(slots.filter((_, offset) => offset !== index))}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            className="fn-btn"
            disabled={busy}
            onClick={() =>
              setSlots([
                ...slots,
                { id: `alcada-${slots.length + 1}`, authorityId: "", permission: "controlleria:formalize" },
              ])
            }
          >
            Adicionar alçada
          </button>
          <label>
            Motivo da proposta ou decisão
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="Descreva o motivo em pelo menos dez caracteres"
            />
          </label>
          <button
            type="button"
            className="fn-btn"
            disabled={busy || reason.trim().length < 10}
            onClick={() => void submit("PROPOR")}
          >
            Enviar proposta
          </button>
          {configuration.proposals.map(proposal => (
            <article key={proposal.eventId}>
              <h4>Proposta pendente</h4>
              <p>{proposal.reason}</p>
              <p>
                {proposal.slots
                  .map(
                    slot =>
                      `${slot.id}: ${slot.authorityId} (${slot.permission === "risk:decide" ? "Risco" : "Controladoria"})`,
                  )
                  .join(" · ")}
              </p>
              {proposal.actorId === actorId ? (
                <p>Aguardando conferência por outra pessoa.</p>
              ) : (
                <>
                  <button
                    type="button"
                    className="fn-btn"
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => void submit("APROVAR", proposal.eventId)}
                  >
                    Aprovar regra
                  </button>
                  <button
                    type="button"
                    className="fn-btn"
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => void submit("REJEITAR", proposal.eventId)}
                  >
                    Rejeitar regra
                  </button>
                </>
              )}
            </article>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
