"use client";
import { useRef, useState } from "react";
import type { FinanceState } from "@/src/domain/finance/model";
import { portfolioBalance, type PortfolioState } from "@/src/domain/portfolio/model";
import type { ReceivableCommand } from "@/src/server/portfolio/financial-commands";
import { todayIso } from "@/src/domain/finance/ledger";
import { Field, money } from "@/src/features/finance/finance-ui";

export function SettlementPanel({
  portfolio,
  finance,
  onCommand,
}: {
  portfolio: PortfolioState;
  finance: FinanceState;
  onCommand: (command: ReceivableCommand) => Promise<void>;
}) {
  const [titleId, setTitleId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [reason, setReason] = useState("");
  const [cashMoved, setCashMoved] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pendingCommand = useRef<{ payload: string; command: ReceivableCommand } | null>(null);
  const title = portfolio.titles.find(item => item.id === titleId);
  async function submit(paymentId?: string) {
    if (lock.current || !title) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const intent: ReceivableCommand = {
        action: paymentId ? "reverse" : "settle",
        titleId,
        commandId: crypto.randomUUID(),
        expectedFinanceVersion: finance.persistenceVersion ?? 0,
        expectedPortfolioVersion: portfolio.persistenceVersion ?? 0,
        date,
        accountId,
        principal: Number(principal),
        interest: Number(interest),
        discount: Number(discount),
        method: "Recebimento manual",
        paymentId,
        reason,
        cashMoved,
      };
      const payload = JSON.stringify({ ...intent, commandId: undefined });
      if (pendingCommand.current?.payload !== payload) pendingCommand.current = { payload, command: intent };
      await onCommand(pendingCommand.current.command);
      pendingCommand.current = null;
      setMessage(paymentId ? "Estorno confirmado." : "Recebimento confirmado na Carteira e no Financeiro.");
      setPrincipal("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="fn-card">
      <summary className="fn-card-head">
        <strong>Recebimento e estorno de títulos</strong>
      </summary>
      <fieldset className="fn-form" disabled={busy}>
        <Field label="Título" wide>
          <select
            value={titleId}
            onChange={event => {
              setTitleId(event.target.value);
              setAccountId("");
              setPrincipal("");
            }}
          >
            <option value="">Selecione</option>
            {portfolio.titles.map(item => (
              <option key={item.id} value={item.id}>
                {item.documentNumber} · {item.debtorName} · {money(portfolioBalance(item))}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data">
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </Field>
        <Field label="Conta de recebimento">
          <select value={accountId} onChange={event => setAccountId(event.target.value)}>
            <option value="">Selecione</option>
            {finance.accounts
              .filter(account => account.active && account.company === title?.company && account.usage.receipts)
              .map(account => (
                <option key={account.id} value={account.id}>
                  {account.nickname}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Principal baixado">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={principal}
            onChange={event => setPrincipal(event.target.value)}
          />
        </Field>
        <Field label="Juros recebidos">
          <input
            type="number"
            min="0"
            step="0.01"
            value={interest}
            onChange={event => setInterest(event.target.value)}
          />
        </Field>
        <Field label="Desconto concedido">
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={event => setDiscount(event.target.value)}
          />
        </Field>
        <button
          className="fn-btn primary"
          type="button"
          disabled={!title || !accountId || !principal}
          onClick={() => void submit()}
        >
          Confirmar recebimento
        </button>
        {!!title?.payments.some(payment => payment.financeTitleId && !payment.reversalOf && !payment.reversedBy) && (
          <div className="fn-field wide">
            <Field label="Motivo do estorno" wide>
              <input value={reason} onChange={event => setReason(event.target.value)} />
            </Field>
            <label className="fn-check">
              <input type="checkbox" checked={cashMoved} onChange={event => setCashMoved(event.target.checked)} />O
              valor foi recebido de fato; registrar obrigação de devolução
            </label>
            {title.payments
              .filter(payment => payment.financeTitleId && !payment.reversalOf && !payment.reversedBy)
              .map(payment => (
                <button
                  className="fn-btn ghost"
                  type="button"
                  disabled={!reason.trim()}
                  key={payment.id}
                  onClick={() => void submit(payment.id)}
                >
                  Estornar {money(payment.amount)} de {payment.date}
                </button>
              ))}
          </div>
        )}
      </fieldset>
      <p className="fn-note" role="status">
        {busy ? "Confirmando no servidor…" : message}
      </p>
    </details>
  );
}
