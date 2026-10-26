"use client";

import { decideRegistryBankAccountChange, loadBankAccountChanges } from "@/src/app/registry-client";
import type { PartyBankAccount } from "@/src/domain/registry/parties";
import type { BankAccountChange } from "@/src/server/registry/bank-account-changes";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";
import { useCallback, useEffect, useState } from "react";

const accountLabel = (account: PartyBankAccount) =>
  `${account.bank} · Ag. ${account.agency} · Conta ${account.account}${account.pixKey ? ` · PIX ${account.pixKey}` : ""}`;

export function BankAccountApprovalPanel({
  onFeedback,
  onApplied,
}: {
  onFeedback: (ok: boolean, text: string) => void;
  onApplied: () => Promise<void>;
}) {
  const [changes, setChanges] = useState<BankAccountChange[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setChanges(await loadBankAccountChanges());
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Não foi possível carregar as alterações bancárias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona da fila persistida
    void refresh();
  }, [refresh]);

  if (!loading && !loadError && !changes.length) return null;

  const decide = async (change: BankAccountChange, decision: "APPROVED" | "REJECTED") => {
    if (loading || loadError || busy) return;
    const reason = reasons[change.changeId]?.trim() ?? "";
    if (reason.length < 5) {
      onFeedback(false, "Informe o motivo da decisão com pelo menos 5 caracteres.");
      return;
    }
    setBusy(change.changeId);
    try {
      await decideRegistryBankAccountChange(change.changeId, decision, reason);
      if (decision === "APPROVED") await onApplied();
      onFeedback(
        true,
        decision === "APPROVED" ? "Alteração bancária aprovada e aplicada." : "Alteração bancária rejeitada.",
      );
      await refresh();
    } catch (error) {
      onFeedback(false, error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section className="rg-bank-approvals">
      <header>
        <div>
          <span>SEGURANÇA BANCÁRIA</span>
          <h2>Alterações aguardando segunda aprovação</h2>
          <p>Confira titularidade e destino. O solicitante não pode decidir a própria alteração.</p>
        </div>
        <b>{changes.length} pendente(s)</b>
        <button type="button" disabled={loading || busy !== undefined} onClick={() => void refresh()}>
          {loading ? "Atualizando…" : "Atualizar fila"}
        </button>
      </header>
      {loadError && (
        <div role="alert">
          <p>{loadError}</p>
          {changes.length > 0 && <p>Exibindo a última fila carregada. Atualize antes de decidir.</p>}
          <button type="button" disabled={loading || busy !== undefined} onClick={() => void refresh()}>
            Tentar novamente
          </button>
        </div>
      )}
      {loading && <p role="status">Carregando alterações bancárias…</p>}
      <div className="rg-bank-approval-list">
        {changes.map(change => (
          <article key={change.changeId}>
            <div className="rg-bank-approval-head">
              <div>
                <strong>{change.partyName}</strong>
                <small>
                  Solicitada por {change.requestedByName} · {new Date(change.requestedAt).toLocaleString("pt-BR")}
                </small>
              </div>
              <span>{change.reason}</span>
            </div>
            <div className="rg-bank-account-compare">
              <div>
                <b>ANTES</b>
                {change.previousAccounts.length ? (
                  change.previousAccounts.map(account => <small key={account.id}>{accountLabel(account)}</small>)
                ) : (
                  <small>Sem conta cadastrada</small>
                )}
              </div>
              <div>
                <b>PROPOSTA</b>
                {change.proposedAccounts.length ? (
                  change.proposedAccounts.map(account => <small key={account.id}>{accountLabel(account)}</small>)
                ) : (
                  <small>Remover todas as contas</small>
                )}
              </div>
            </div>
            <div className="rg-bank-approval-actions">
              <input
                value={reasons[change.changeId] ?? ""}
                onChange={event => setReasons(current => ({ ...current, [change.changeId]: event.target.value }))}
                placeholder="Evidência ou motivo da decisão"
              />
              <button
                disabled={loading || Boolean(loadError) || busy !== undefined}
                onClick={() => void decide(change, "REJECTED")}
              >
                <AlertIcon /> Rejeitar
              </button>
              <button
                className="primary"
                disabled={loading || Boolean(loadError) || busy !== undefined}
                onClick={() => void decide(change, "APPROVED")}
              >
                <CheckIcon /> Aprovar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
