"use client";

/** Administração explícita do teto mensal e das cotas, sem confiar em contadores do navegador. */
import { useEffect, useState } from "react";
import type { AccessUser } from "@/src/domain/access/model";
import type { IntelligenceState } from "@/src/domain/intelligence/model";
import {
  distributeBudgetEqually,
  validateBudgetInput,
  type AIBudgetInput,
  type AIBudgetSnapshot,
} from "@/src/domain/intelligence/budget";
import { loadAIBudget, saveAIBudget } from "@/src/app/intelligence-client";
import styles from "./ai-budget-panel.module.css";

type Props = {
  intelligence: IntelligenceState;
  users: AccessUser[];
  canManage: boolean;
  demoMode?: boolean;
  onSaved: (budget: AIBudgetSnapshot) => void;
};
type Draft = { total: string; mode: AIBudgetInput["mode"]; quotas: Record<string, string> };
const number = (value: number) => value.toLocaleString("pt-BR");
const numeric = (value: string) => (value.trim() === "" ? NaN : Number(value));
function draftOf(snapshot: AIBudgetSnapshot): Draft {
  return {
    total: String(snapshot.policy.monthlyTokenBudget),
    mode: snapshot.policy.mode,
    quotas: Object.fromEntries(
      snapshot.users.map(user => [
        user.userId,
        String(snapshot.policy.allocations.find(item => item.userId === user.userId)?.monthlyTokenBudget ?? 0),
      ]),
    ),
  };
}
function demoSnapshot(intelligence: IntelligenceState, users: AccessUser[]): AIBudgetSnapshot {
  return {
    policy: { monthlyTokenBudget: intelligence.monthlyTokenBudget, mode: "shared", allocations: [], version: 0 },
    period: new Date().toISOString().slice(0, 7),
    usedTokens: intelligence.usedTokens,
    users: users
      .filter(user => user.tenantIds.includes(intelligence.tenantId))
      .map(user => ({ userId: user.id, name: user.name, status: user.status, usedTokens: 0 })),
  };
}
export function AIBudgetPanel({ intelligence, users, canManage, demoMode = false, onSaved }: Props) {
  const [initial] = useState(() => demoSnapshot(intelligence, users));
  const [snapshot, setSnapshot] = useState<AIBudgetSnapshot | null>(demoMode ? initial : null);
  const [draft, setDraft] = useState<Draft | null>(demoMode ? draftOf(initial) : null);
  const [busy, setBusy] = useState(!demoMode);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  const storageKey = `strato-demo-ai-budget:${intelligence.tenantId}`;
  const accept = (next: AIBudgetSnapshot) => {
    setSnapshot(next);
    setDraft(draftOf(next));
  };
  useEffect(() => {
    let cancelled = false;
    if (demoMode) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        try {
          const validation = validateBudgetInput(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
          if (validation.ok) {
            const next = { ...initial, policy: validation.input };
            setSnapshot(next);
            setDraft(draftOf(next));
          }
        } catch {
          /* Preferência demonstrativa inválida não altera a configuração inicial. */
        }
      });
      return () => {
        cancelled = true;
      };
    }
    void loadAIBudget()
      .then(next => {
        if (!cancelled) {
          setSnapshot(next);
          setDraft(draftOf(next));
        }
      })
      .catch(error => {
        if (!cancelled)
          setFeedback({
            error: true,
            text: error instanceof Error ? error.message : "Não foi possível carregar os limites.",
          });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode, storageKey, initial]);
  const refresh = async () => {
    setBusy(true);
    setFeedback(undefined);
    try {
      accept(demoMode ? { ...snapshot!, period: new Date().toISOString().slice(0, 7) } : await loadAIBudget());
    } catch (error) {
      setFeedback({
        error: true,
        text: error instanceof Error ? error.message : "Não foi possível recarregar o consumo.",
      });
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!snapshot || !draft || !canManage || busy) return;
    const validation = validateBudgetInput({
      monthlyTokenBudget: numeric(draft.total),
      mode: draft.mode,
      version: snapshot.policy.version,
      allocations:
        draft.mode === "shared"
          ? []
          : Object.entries(draft.quotas)
              .map(([userId, value]) => ({ userId, monthlyTokenBudget: numeric(value) }))
              .filter(item => item.monthlyTokenBudget !== 0),
    });
    if (!validation.ok) {
      setFeedback({ error: true, text: validation.error });
      return;
    }
    const inactive = validation.input.allocations.some(
      item =>
        item.monthlyTokenBudget > 0 && snapshot.users.find(user => user.userId === item.userId)?.status !== "active",
    );
    if (inactive) {
      setFeedback({ error: true, text: "Zere as cotas dos usuários inativos antes de salvar." });
      return;
    }
    setBusy(true);
    setFeedback(undefined);
    try {
      const next = demoMode
        ? { ...snapshot, policy: { ...validation.input, version: snapshot.policy.version + 1 } }
        : await saveAIBudget(validation.input);
      if (demoMode) localStorage.setItem(storageKey, JSON.stringify(next.policy));
      accept(next);
      onSaved(next);
      setFeedback({
        error: false,
        text: demoMode
          ? "Limites salvos nesta demonstração local."
          : "Limites salvos. Novas consultas já respeitam a distribuição.",
      });
    } catch (error) {
      setFeedback({
        error: true,
        text: error instanceof Error ? error.message : "Não foi possível salvar os limites.",
      });
    } finally {
      setBusy(false);
    }
  };
  const allocated = draft ? Object.values(draft.quotas).reduce((total, value) => total + numeric(value), 0) : 0;
  const total = draft ? numeric(draft.total) : 0;
  const active = snapshot?.users.filter(user => user.status === "active") ?? [];
  const individualUsed = snapshot?.users.reduce((total, user) => total + user.usedTokens, 0) ?? 0;
  return (
    <section className={styles.panel} aria-labelledby="ai-budget-title" aria-busy={busy}>
      <header>
        <div>
          <span className={styles.eyebrow}>CONTROLE DE CONSUMO</span>
          <h3 id="ai-budget-title">Limites da IA</h3>
          <p>Tokens por mês. Defina um teto geral e escolha como a equipe pode usá-lo.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy || (demoMode && !snapshot)}>
          Atualizar consumo
        </button>
      </header>
      {snapshot && draft ? (
        <form onSubmit={event => void submit(event)} noValidate>
          <div className={styles.summary}>
            <div>
              <small>Uso e reservas · {snapshot.period} UTC</small>
              <strong>{number(snapshot.usedTokens)}</strong>
            </div>
            <div>
              <small>Limite mensal salvo</small>
              <strong>{number(snapshot.policy.monthlyTokenBudget)}</strong>
            </div>
            <div>
              <small>Saldo geral</small>
              <strong>{number(Math.max(0, snapshot.policy.monthlyTokenBudget - snapshot.usedTokens))}</strong>
            </div>
          </div>
          <div className={styles.controls}>
            <label>
              Limite geral mensal (tokens)
              <input
                type="number"
                min="0"
                step="1"
                value={draft.total}
                disabled={!canManage || busy}
                onChange={event => setDraft({ ...draft, total: event.target.value })}
              />
            </label>
            <label>
              Distribuição
              <select
                value={draft.mode}
                disabled={!canManage || busy}
                onChange={event => setDraft({ ...draft, mode: event.target.value as Draft["mode"] })}
              >
                <option value="shared">Compartilhado pela equipe</option>
                <option value="allocated">Cotas por usuário</option>
              </select>
            </label>
          </div>
          <p>
            {draft.mode === "shared"
              ? "Todos os usuários autorizados compartilham o saldo geral, sem limite individual."
              : "Cada usuário consome somente sua cota. Usuário sem cota fica sem acesso às respostas por IA; saldo não distribuído permanece reservado."}
          </p>
          {draft.mode === "allocated" && (
            <div className={styles.distribution}>
              <span>
                Distribuído: <b>{Number.isSafeInteger(allocated) ? number(allocated) : "—"}</b> · Não distribuído:{" "}
                <b>{Number.isSafeInteger(total - allocated) ? number(Math.max(0, total - allocated)) : "—"}</b>
              </span>
              <button
                type="button"
                disabled={!canManage || busy || !active.length || !Number.isSafeInteger(total) || total < 0}
                onClick={() => {
                  setDraft({
                    ...draft,
                    quotas: Object.fromEntries(
                      distributeBudgetEqually(
                        total,
                        active.map(user => user.userId),
                      ).map(item => [item.userId, String(item.monthlyTokenBudget)]),
                    ),
                  });
                  setFeedback(undefined);
                }}
              >
                Dividir igualmente entre {active.length} usuários ativos
              </button>
            </div>
          )}
          {draft.mode === "allocated" && allocated > total && (
            <p className={styles.error} role="alert">
              A soma das cotas ultrapassa o limite geral em {number(allocated - total)} tokens.
            </p>
          )}
          <div className={styles.tableWrap}>
            <table>
              <caption>Consumo da equipe nesta competência</caption>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Cota mensal</th>
                  <th>Uso e reservas</th>
                  <th>Saldo individual</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.users.map(user => {
                  const quota = numeric(draft.quotas[user.userId] ?? "0");
                  return (
                    <tr key={user.userId}>
                      <td>
                        <strong>{user.name}</strong>
                        <small>
                          {user.status === "active"
                            ? "Ativo"
                            : user.status === "suspended"
                              ? "Suspenso"
                              : user.status === "pending"
                                ? "Pendente"
                                : "Sem vínculo atual"}
                        </small>
                      </td>
                      <td>
                        {draft.mode === "allocated" ? (
                          <input
                            aria-label={`Cota mensal de ${user.name}`}
                            type="number"
                            min="0"
                            max={user.status === "active" ? Number.MAX_SAFE_INTEGER : 0}
                            step="1"
                            disabled={!canManage || busy}
                            value={draft.quotas[user.userId] ?? "0"}
                            onChange={event =>
                              setDraft({ ...draft, quotas: { ...draft.quotas, [user.userId]: event.target.value } })
                            }
                          />
                        ) : (
                          "Compartilhado"
                        )}
                      </td>
                      <td>{number(user.usedTokens)}</td>
                      <td>
                        {draft.mode === "allocated" && Number.isSafeInteger(quota)
                          ? number(Math.max(0, quota - user.usedTokens))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {snapshot.users.length === 0 && <p>Nenhum usuário vinculado a esta organização.</p>}
          </div>
          {snapshot.usedTokens > individualUsed && (
            <p className={styles.note}>
              {number(snapshot.usedTokens - individualUsed)} tokens do total geral não têm atribuição individual no
              histórico disponível. Continuam descontados do saldo geral.
            </p>
          )}
          <p className={styles.note}>
            Renovação mensal em UTC, sem acumular saldo. Uso inclui reservas de consultas ainda não confirmadas. Cada
            consulta exige saldo para a reserva antes de começar; o débito é ajustado após confirmar o uso. Reduzir
            limites não apaga consumo.
          </p>
          <div className={styles.actions}>
            <button type="submit" disabled={!canManage || busy}>
              {busy ? "Aguarde…" : "Salvar limites"}
            </button>
            {demoMode && <small>Demonstração · sem alteração em produção</small>}
            {!canManage && <small>Somente quem administra configurações pode alterar limites.</small>}
          </div>
        </form>
      ) : (
        <p>{busy ? "Carregando limites…" : "Limites indisponíveis. Use Atualizar consumo para tentar novamente."}</p>
      )}
      {feedback && (
        <p className={feedback.error ? styles.error : styles.success} role={feedback.error ? "alert" : "status"}>
          {feedback.text}
        </p>
      )}
    </section>
  );
}
