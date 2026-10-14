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
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setChanges(await loadBankAccountChanges());
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona da fila persistida
    void refresh();
  }, [refresh]);

  if (!available || !changes.length) return null;

  const decide = async (change: BankAccountChange, decision: "APPROVED" | "REJECTED") => {
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
      </header>
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
              <button disabled={busy === change.changeId} onClick={() => void decide(change, "REJECTED")}>
                <AlertIcon /> Rejeitar
              </button>
              <button
                className="primary"
                disabled={busy === change.changeId}
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
