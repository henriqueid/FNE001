"use client";

/**
 * Extrato por conta com saldo acumulado, estorno e transferência.
 */
import { accountBalance, scopedAccounts, transfer } from "@/src/domain/finance/banking";
import { addDays, round2, todayIso, type Result } from "@/src/domain/finance/ledger";
import { type CompanyBankAccount, type FinanceState } from "@/src/domain/finance/model";
import { BY, Field, Modal, br, money, parseMoneyBR, type Action } from "@/src/features/finance/finance-ui";
import { AlertIcon, CheckIcon, UndoIcon } from "@/src/ui/icons";
import { useState } from "react";

export function ExtractTab({
  state,
  scope,
  accountId,
  setAccountId,
  onApply,
  onAction,
}: {
  state: FinanceState;
  scope: string;
  accountId: string;
  setAccountId: (id: string) => void;
  onApply: (r: Result) => void;
  onAction: (a: NonNullable<Action>) => void;
}) {
  const today = todayIso();
  const accounts = scopedAccounts(state, scope);
  const account = accounts.find(a => a.id === accountId) ?? accounts[0];
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [showTransfer, setShowTransfer] = useState(false);
  if (!account)
    return (
      <section className="fn-card">
        <div className="fn-empty">Nenhuma conta nesta empresa.</div>
      </section>
    );
  const opening = accountBalance(state, account.id, addDays(from, -1));
  const moves = state.movements
    .filter(m => m.accountId === account.id && m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const rows = moves.reduce<{ m: (typeof moves)[number]; running: number }[]>((acc, m) => {
    const previous = acc.length ? acc[acc.length - 1].running : opening;
    acc.push({ m, running: round2(previous + m.amount) });
    return acc;
  }, []);
  const ins = moves.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0),
    outs = moves.filter(m => m.amount < 0).reduce((s, m) => s - m.amount, 0);
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Extrato da conta</h2>
          <p>
            {account.bankName} · ag {account.agency} · cc {account.account} · {account.company}
          </p>
        </div>
        <button className="fn-btn ghost" onClick={() => setShowTransfer(true)}>
          Transferência entre contas
        </button>
      </header>
      <div className="fn-toolbar">
        <Field label="Conta">
          <select value={account.id} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.nickname} · {a.company.split(" ·")[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="De">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="fn-sums">
        <span>
          Saldo anterior <b>{money(opening)}</b>
        </span>
        <span>
          Entradas <b className="good">{money(ins)}</b>
        </span>
        <span>
          Saídas <b className="bad">{money(outs)}</b>
        </span>
        <span>
          Saldo final <b>{money(opening + ins - outs)}</b>
        </span>
        <span>
          A conciliar <b>{moves.filter(m => !m.reconciled).length}</b>
        </span>
      </div>
      <div className="fn-table-scroll">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Histórico</th>
              <th>Tipo</th>
              <th className="num">Valor</th>
              <th className="num">Saldo</th>
              <th>Conciliação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className="opening">
              <td className="date">{br(addDays(from, -1))}</td>
              <td colSpan={3}>Saldo anterior</td>
              <td className="num">
                <b>{money(opening)}</b>
              </td>
              <td />
              <td />
            </tr>
            {rows.map(({ m, running: r }) => {
              const title = state.titles.find(t => t.id === m.titleId);
              return (
                <tr key={m.id} className={m.reversedBy || m.kind === "Estorno" ? "reversed" : ""}>
                  <td className="date">{br(m.date)}</td>
                  <td>
                    <b>{m.description}</b>
                    <small>
                      {m.id}
                      {m.titleId ? ` · ${m.titleId}` : ""}
                      {m.reversedBy ? ` · estornado por ${m.reversedBy}` : ""}
                      {m.reversalOf ? ` · estorno de ${m.reversalOf}` : ""}
                    </small>
                  </td>
                  <td>
                    <span className={`fn-chip ${m.kind === "Estorno" ? "warn" : ""}`}>{m.kind}</span>
                  </td>
                  <td className={`num ${m.amount < 0 ? "bad" : "good"}`}>{money(m.amount)}</td>
                  <td className="num">{money(r)}</td>
                  <td>
                    {m.reconciled ? (
                      <span className="fn-chip ok" title={m.matchGroup}>
                        <CheckIcon /> Conciliado
                      </span>
                    ) : (
                      <span className="fn-chip warn">A conciliar</span>
                    )}
                  </td>
                  <td className="actions">
                    {title && title.status === "Baixado" && title.movementId === m.id && !m.reversedBy && (
                      <button className="fn-btn small ghost" onClick={() => onAction({ type: "reverse", title })}>
                        <UndoIcon /> Estornar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showTransfer && (
        <TransferModal
          state={state}
          accounts={accounts}
          defaultFrom={account.id}
          onClose={() => setShowTransfer(false)}
          onApply={r => {
            onApply(r);
            if (!r.error) setShowTransfer(false);
          }}
        />
      )}
    </section>
  );
}

export function TransferModal({
  state,
  accounts,
  defaultFrom,
  onClose,
  onApply,
}: {
  state: FinanceState;
  accounts: CompanyBankAccount[];
  defaultFrom: string;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const fromAcc = accounts.find(a => a.id === from);
  const targets = accounts.filter(a => a.id !== from && a.company === fromAcc?.company);
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const value = parseMoneyBR(amount);
  return (
    <Modal
      title="Transferência entre contas"
      subtitle="Somente entre contas da mesma empresa. Entre empresas, lance pagamento e recebimento."
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            disabled={!value || !to}
            onClick={() =>
              onApply(
                transfer(
                  state,
                  { from, to: to || targets[0]?.id, date, amount: value, description: description || "Transferência" },
                  BY,
                ),
              )
            }
          >
            Transferir {money(value)}
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="De">
          <select value={from} onChange={e => setFrom(e.target.value)}>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.nickname} · {money(accountBalance(state, a.id))}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Para">
          <select value={to} onChange={e => setTo(e.target.value)}>
            {targets.map(a => (
              <option key={a.id} value={a.id}>
                {a.nickname}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor (R$)">
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field label="Data">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Descrição" wide>
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
      </div>
      {!targets.length && (
        <p className="fn-warning">
          <AlertIcon /> Esta empresa tem só uma conta.
        </p>
      )}
    </Modal>
  );
}
