"use client";

import { useState } from "react";
import { decideIntegrationChange, proposeIntegrationChange } from "@/src/app/integrations-client";
import type {
  IntegrationCapability,
  IntegrationChangeProposal,
  IntegrationConnection,
  IntegrationState,
} from "@/src/domain/integrations/model";
import styles from "./integration-governance-panel.module.css";

const capabilityLabels: Record<IntegrationCapability, string> = {
  CNPJ_LOOKUP: "Consulta CNPJ",
  CEP_LOOKUP: "Consulta CEP",
  BANK_DIRECTORY: "Diretório bancário",
  HOLIDAY_CALENDAR: "Calendário de feriados",
  PIX_DIRECTORY: "Participantes Pix",
};

const statusLabels: Record<IntegrationConnection["status"], string> = {
  ACTIVE: "Ativo",
  DEGRADED: "Degradado",
  PLANNED: "Planejado",
  SUSPENDED: "Suspenso",
};

const grouped = (connections: IntegrationConnection[]) => {
  const result = new Map<IntegrationCapability, IntegrationChangeProposal[]>();
  for (const connection of connections) {
    const capability = connection.capability;
    const items = result.get(capability) ?? [];
    items.push({
      providerId: connection.providerId,
      capability,
      status: connection.status,
      priority: connection.priority,
    });
    result.set(capability, items);
  }
  return Object.fromEntries(result) as Partial<Record<IntegrationCapability, IntegrationChangeProposal[]>>;
};

export default function IntegrationGovernancePanel({
  integrations,
  onIntegrations,
}: {
  integrations: IntegrationState;
  onIntegrations: (state: IntegrationState) => void;
}) {
  const connections = integrations.connections ?? [];
  const [drafts, setDrafts] = useState(() => grouped(connections));
  const [reasons, setReasons] = useState<Partial<Record<IntegrationCapability, string>>>({});
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string }>();
  const requests = integrations.changeRequests ?? [];
  const pending = requests.filter(request => request.status === "PENDING");

  const changeDraft = (
    capability: IntegrationCapability,
    providerId: string,
    patch: Partial<IntegrationChangeProposal>,
  ) =>
    setDrafts(current => ({
      ...current,
      [capability]: (current[capability] ?? []).map(item =>
        item.providerId === providerId ? { ...item, ...patch } : item,
      ),
    }));

  const propose = async (capability: IntegrationCapability) => {
    setBusy(`propose:${capability}`);
    setFeedback(undefined);
    try {
      const next = await proposeIntegrationChange(capability, drafts[capability] ?? [], reasons[capability] ?? "");
      onIntegrations(next);
      setDrafts(grouped(next.connections ?? []));
      setReasons(current => ({ ...current, [capability]: "" }));
      setFeedback({ tone: "success", message: "Proposta registrada para aprovação independente." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível registrar a proposta.",
      });
    } finally {
      setBusy(undefined);
    }
  };

  const decide = async (changeId: string, decision: "APPROVED" | "REJECTED") => {
    setBusy(`decide:${changeId}`);
    setFeedback(undefined);
    try {
      const next = await decideIntegrationChange(changeId, decision, decisionReasons[changeId] ?? "");
      onIntegrations(next);
      setDrafts(grouped(next.connections ?? []));
      setDecisionReasons(current => ({ ...current, [changeId]: "" }));
      setFeedback({
        tone: "success",
        message: decision === "APPROVED" ? "Configuração aplicada." : "Proposta rejeitada.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      });
    } finally {
      setBusy(undefined);
    }
  };

  if (!connections.length) return null;

  return (
    <section className={styles.panel} aria-label="Governança das integrações">
      <header>
        <span>MAKER-CHECKER</span>
        <h3>Alterações com dupla aprovação</h3>
        <p>Estado, prioridade e troca de provedor só entram em vigor depois da decisão de outra pessoa.</p>
      </header>

      {feedback && (
        <p className={feedback.tone === "error" ? styles.error : styles.success} role="status">
          {feedback.message}
        </p>
      )}

      {pending.length > 0 && (
        <div className={styles.queue}>
          <h4>Fila de aprovação</h4>
          {pending.map(request => (
            <article key={request.id}>
              <div>
                <strong>{capabilityLabels[request.capability]}</strong>
                <small>
                  Solicitada por {request.requestedBy} · {new Date(request.requestedAt).toLocaleString("pt-BR")}
                </small>
                <p>{request.reason}</p>
                <ul>
                  {request.proposed.map(item => (
                    <li key={item.providerId}>
                      {item.label}: {statusLabels[item.status]} · prioridade {item.priority}
                    </li>
                  ))}
                </ul>
              </div>
              <label>
                Justificativa da decisão
                <textarea
                  value={decisionReasons[request.id] ?? ""}
                  onChange={event => setDecisionReasons(current => ({ ...current, [request.id]: event.target.value }))}
                  placeholder="Registre a conferência realizada"
                />
              </label>
              <div className={styles.actions}>
                <button type="button" onClick={() => void decide(request.id, "REJECTED")} disabled={busy !== undefined}>
                  Rejeitar
                </button>
                <button type="button" onClick={() => void decide(request.id, "APPROVED")} disabled={busy !== undefined}>
                  Aprovar e aplicar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className={styles.capabilities}>
        {(Object.entries(drafts) as Array<[IntegrationCapability, IntegrationChangeProposal[]]>).map(
          ([capability, items]) => {
            const hasPending = pending.some(request => request.capability === capability);
            return (
              <fieldset key={capability} disabled={busy !== undefined || hasPending}>
                <legend>{capabilityLabels[capability]}</legend>
                {items.map(item => {
                  const connection = connections.find(
                    current => current.capability === capability && current.providerId === item.providerId,
                  );
                  return (
                    <div key={item.providerId} className={styles.provider}>
                      <div>
                        <strong>{connection?.label ?? item.providerId}</strong>
                        <small>
                          {connection?.sourceType === "PUBLIC" ? "Fonte pública" : "Integração institucional"}
                        </small>
                      </div>
                      <label>
                        Estado
                        <select
                          value={item.status}
                          onChange={event =>
                            changeDraft(capability, item.providerId, {
                              status: event.target.value as IntegrationConnection["status"],
                            })
                          }
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Prioridade
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          step="1"
                          value={item.priority}
                          onChange={event =>
                            changeDraft(capability, item.providerId, { priority: Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                  );
                })}
                <label className={styles.reason}>
                  Motivo da proposta
                  <textarea
                    value={reasons[capability] ?? ""}
                    onChange={event => setReasons(current => ({ ...current, [capability]: event.target.value }))}
                    placeholder="Explique o impacto operacional e a evidência da mudança"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void propose(capability)}
                  disabled={busy !== undefined || hasPending}
                >
                  {hasPending ? "Aguardando decisão" : "Enviar para aprovação"}
                </button>
              </fieldset>
            );
          },
        )}
      </div>
    </section>
  );
}
