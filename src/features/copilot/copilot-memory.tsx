"use client";

/** Registro explícito de observação/correção e revisão humana da memória. */
import { useState } from "react";
import type { CopilotReport } from "@/src/domain/copilot/report";
import { isQueryKey, type BehaviorEvent } from "@/src/domain/copilot/behavior";
import type { AccessUser } from "@/src/domain/access/model";
import { saveCopilotMemory, reviewCopilotMemory } from "@/src/app/intelligence-client";

const labels: Record<BehaviorEvent["kind"], string> = {
  observation: "Observação",
  confirmation: "Confirmação registrada",
  collection: "Cobrança",
  promise: "Promessa declarada",
  decision: "Decisão formal",
  payment: "Pagamento",
  correction: "Correção de interpretação",
  guidance: "Orientação do cliente",
  feedback: "Avaliação da resposta",
};
const statuses: Record<BehaviorEvent["status"], string> = {
  recorded: "Registrado na fonte",
  pending: "Pendente de revisão",
  validated: "Revisado",
  rejected: "Não aprovado",
  revoked: "Desativado",
};
export function CopilotMemory({
  report,
  events,
  user,
  onSaved,
}: {
  report: CopilotReport;
  events: BehaviorEvent[];
  user: AccessUser;
  onSaved: () => Promise<void>;
}) {
  const entities =
    report.entities?.filter(entity => /^(title|operation|finance|visit|committee|task):/.test(entity.id)) ?? [];
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [kind, setKind] = useState<"observation" | "correction" | "feedback" | "guidance">("observation");
  const [text, setText] = useState("");
  const [shared, setShared] = useState(false);
  const [queryKey, setQueryKey] = useState(report.queryKey ?? "debtor:balance:open");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewId, setReviewId] = useState("");
  const [rationale, setRationale] = useState("");
  const save = async () => {
    const entity = report.entities?.find(entity => entity.id === entityId);
    if (!entity) return;
    setBusy(true);
    setStatus("");
    try {
      await saveCopilotMemory({
        company: entity.company,
        entityId,
        text,
        kind,
        visibility: shared ? "company" : "private",
        ...(kind === "correction" && isQueryKey(queryKey) ? { question: report.question, queryKey } : {}),
      });
      setText("");
      setStatus("Registro salvo. Correções só serão reutilizadas após revisão por outro responsável.");
      await onSaved();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };
  const review = async (action: "validated" | "rejected" | "revoked") => {
    setBusy(true);
    setStatus("");
    try {
      await reviewCopilotMemory(reviewId, action, rationale);
      setReviewId("");
      setRationale("");
      setStatus("Revisão registrada. Atualize a consulta para usar a memória atual.");
      await onSaved();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Não foi possível revisar.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Comportamento e anotações">
      <p>Relatos mantêm autoria e evidências. Uma anotação não confirma pagamento nem aprova crédito.</p>
      {entities.length ? (
        <form
          className="cpl-memory-form"
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            Vincular ao registro
            <select value={entityId} onChange={event => setEntityId(event.target.value)}>
              {entities.map(entity => (
                <option value={entity.id} key={entity.id}>
                  {entity.label} · {entity.company}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
              <option value="observation">Anotação ou insight</option>
              <option value="correction">Corrigir interpretação da pergunta</option>
              <option value="guidance">Orientação para aprendizado, sujeita a revisão</option>
              <option value="feedback">Avaliar a resposta</option>
            </select>
          </label>
          {kind === "correction" && (
            <label>
              Consulta correta
              <select value={queryKey} onChange={event => setQueryKey(event.target.value)}>
                {["debtor", "owner", "title", "summary"].flatMap(group =>
                  ["balance", "count"].flatMap(metric =>
                    ["open", "overdue", "upcoming"].map(bucket => (
                      <option key={`${group}:${metric}:${bucket}`} value={`${group}:${metric}:${bucket}`}>
                        {group === "debtor"
                          ? "Sacados"
                          : group === "owner"
                            ? "Cedentes"
                            : group === "title"
                              ? "Títulos"
                              : "Carteira"}{" "}
                        · {metric === "count" ? "quantidade" : "saldo"} ·{" "}
                        {bucket === "overdue" ? "vencidos" : bucket === "upcoming" ? "a vencer" : "em aberto"}
                      </option>
                    )),
                  ),
                )}
              </select>
            </label>
          )}
          <label>
            Conteúdo
            <textarea value={text} onChange={event => setText(event.target.value)} maxLength={2000} required rows={3} />
          </label>
          <label className="cpl-memory-check">
            <input type="checkbox" checked={shared} onChange={event => setShared(event.target.checked)} /> Compartilhar
            com pessoas autorizadas desta empresa, permitindo revisão
          </label>
          <small>Sem marcar, o registro é privado. A validade inicial é de 90 dias; o autor pode desativá-lo.</small>
          <button type="submit" className="cpl-primary" disabled={busy || !text.trim()}>
            Salvar registro
          </button>
        </form>
      ) : (
        <p>Faça uma consulta com registros identificados para vincular anotações ou correções.</p>
      )}
      {status && <p role="status">{status}</p>}
      {events.map(event => (
        <article className="cpl-memory-event" key={event.id}>
          <b>
            {labels[event.kind]} · {statuses[event.status]}
          </b>
          <p>{event.text}</p>
          <small>
            {event.actorId} · {event.at ? new Date(event.at).toLocaleString("pt-BR") : "Data não informada na fonte"} ·{" "}
            {event.visibility === "private" ? "Privado" : "Empresa"}
            {event.validUntil ? ` · válido até ${event.validUntil}` : ""}
          </small>
          <details>
            <summary>Origem e evidências</summary>
            <p>
              {event.source} · {event.entityId}
            </p>
            <p>{event.evidenceRefs.join(", ")}</p>
            {event.question && <p>Pergunta: {event.question}</p>}
          </details>
          {event.source === "memory" &&
            !["revoked", "rejected"].includes(event.status) &&
            (event.actorId === user.id || user.permissions.includes("settings:manage")) && (
              <button
                type="button"
                className="cpl-ghost"
                onClick={() => {
                  setReviewId(event.id);
                  setRationale("");
                }}
              >
                Revisar ou desativar
              </button>
            )}
          {reviewId === event.id && (
            <form className="cpl-memory-form" onSubmit={e => e.preventDefault()}>
              <label>
                Justificativa
                <textarea required value={rationale} onChange={e => setRationale(e.target.value)} maxLength={2000} />
              </label>
              <div className="cpl-result-actions">
                {["correction", "guidance"].includes(event.kind) &&
                  event.actorId !== user.id &&
                  user.permissions.includes("settings:manage") && (
                    <button type="button" disabled={busy || !rationale.trim()} onClick={() => void review("validated")}>
                      Validar para uso como memória
                    </button>
                  )}
                {user.permissions.includes("settings:manage") && (
                  <button type="button" disabled={busy || !rationale.trim()} onClick={() => void review("rejected")}>
                    Não aprovar
                  </button>
                )}
                <button type="button" disabled={busy || !rationale.trim()} onClick={() => void review("revoked")}>
                  Desativar
                </button>
                <button type="button" onClick={() => setReviewId("")}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </article>
      ))}
      {!events.length && <p>Nenhum comportamento registrado neste recorte.</p>}
    </section>
  );
}
