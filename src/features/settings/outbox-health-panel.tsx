"use client";

import { useEffect, useState } from "react";
import { type OutboxHealth } from "@/src/domain/notifications/model";
import { retryFailedNotifications, syncPublishedNotifications } from "@/src/app/notification-client";

const emptyHealth: OutboxHealth = { pending: 0, failed: 0, published: 0 };

export function OutboxHealthPanel({ tenantId, demoMode = false }: { tenantId: string; demoMode?: boolean }) {
  const [health, setHealth] = useState(emptyHealth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => {
    if (demoMode) return;
    setBusy(true);
    setError("");
    return syncPublishedNotifications(tenantId)
      .then(result => setHealth(result.health ?? emptyHealth))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Falha ao consultar a outbox."))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    syncPublishedNotifications(tenantId)
      .then(result => {
        if (!cancelled) setHealth(result.health ?? emptyHealth);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Falha ao consultar a outbox.");
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, demoMode]);

  const retry = () => {
    if (demoMode) return;
    setBusy(true);
    setError("");
    void retryFailedNotifications(tenantId)
      .then(setHealth)
      .catch(reason => setError(reason instanceof Error ? reason.message : "Falha ao reprocessar a outbox."))
      .finally(() => setBusy(false));
  };

  if (demoMode)
    return (
      <section className="settings-outbox" aria-labelledby="settings-outbox-title">
        <header>
          <strong id="settings-outbox-title">Entrega de eventos — Demonstração</strong>
        </header>
        <p>A fila real não é consultada, processada ou reprocessada neste modo.</p>
        <button type="button" disabled>
          Fila real indisponível na demonstração
        </button>
      </section>
    );

  return (
    <section className="settings-outbox" aria-labelledby="settings-outbox-title">
      <header>
        <span>
          <strong id="settings-outbox-title">Entrega confiável de eventos</strong>
          <small>Decisões publicadas para a Central do Dia e integrações internas.</small>
        </span>
        <button type="button" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Atualizando…" : "Atualizar fila"}
        </button>
      </header>
      <div className="settings-integration-legend" role="status">
        <span>
          <b>{health.pending}</b> pendentes
        </span>
        <span>
          <b>{health.published}</b> publicadas
        </span>
        <span>
          <b>{health.failed}</b> na fila de falhas
        </span>
      </div>
      {health.failed > 0 && (
        <button className="settings-outbox-retry" type="button" onClick={retry} disabled={busy}>
          Reprocessar mensagens com falha
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
