"use client";

/**
 * Peças compartilhadas do Financeiro: formatação, parser monetário pt-BR, modal, campo, status e baixa/estorno.
 */
import { accountBalance } from "@/src/domain/finance/banking";
import { cancelTitle, reverseSettlement, settleTitle } from "@/src/domain/finance/titles";
import { useState } from "react";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { AlertIcon, CloseIcon, UndoIcon } from "@/src/ui/icons";

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number) => brl.format(v);
export const compact = (v: number) => {
  const a = Math.abs(v),
    s = v < 0 ? "−" : "";
  return a >= 1e6
    ? `${s}R$ ${(a / 1e6).toFixed(2).replace(".", ",")} mi`
    : a >= 1e3
      ? `${s}R$ ${(a / 1e3).toFixed(1).replace(".", ",")} mil`
      : `${s}${brl.format(a)}`;
};
export const br = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
export const BY = "Henrique";

/** Converte valor digitado em pt-BR ("1.500,55", "1500,55", "1.500") ou com ponto decimal ("1500.55").
    Parser único para todo o financeiro — evita gravar 100× o valor. */
export function parseMoneyBR(input: string | number): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  let v = String(input).replace(/[R$\s]/g, "");
  if (!v) return 0;
  const negative = v.startsWith("-") || v.startsWith("−");
  v = v.replace(/^[-−]/, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if ((v.match(/\./g) ?? []).length > 1) v = v.replace(/\./g, "");
  else if (/^\d{1,3}\.\d{3}$/.test(v)) v = v.replace(".", "");
  const n = Number(v);
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
}
export const formatMoneyInput = (v: number) =>
  v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop fn-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`fn-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="fn-modal-body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`fn-field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function StatusChip({ title, today }: { title: FinanceTitle; today: string }) {
  if (title.status === "Cancelado") return <span className="fn-chip muted">Excluído</span>;
  if (title.status === "Baixado")
    return (
      <span className="fn-chip ok">
        {title.kind === "Pagar" ? "Pago" : "Recebido"} {br(title.settledAt).slice(0, 5)}
      </span>
    );
  if (title.dueDate < today) return <span className="fn-chip bad">Vencido</span>;
  if (title.dueDate === today) return <span className="fn-chip warn">Vence hoje</span>;
  return <span className="fn-chip">Em aberto</span>;
}

export type Action = { type: "settle" | "cancel" | "reverse"; title: FinanceTitle } | null;

export function TitleActionModal({
  action,
  state,
  onClose,
  onApply,
}: {
  action: NonNullable<Action>;
  state: FinanceState;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const { title } = action;
  const accounts = state.accounts.filter(
    a => a.active && a.company === title.company && (title.kind === "Pagar" ? a.usage.payments : a.usage.receipts),
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState(title.kind === "Pagar" ? "PIX" : "Crédito em conta");
  const [reason, setReason] = useState("");
  const [cashMoved, setCashMoved] = useState<"" | "sim" | "nao">("");
  const [sure, setSure] = useState(false);
  const [principal, setPrincipal] = useState(title.amount.toFixed(2).replace(".", ","));
  const [interest, setInterest] = useState("");
  const [discount, setDiscount] = useState("");
  const num = parseMoneyBR;
  const netValue = num(principal) + num(interest) - num(discount);
  const verbPast = title.kind === "Pagar" ? "saiu do" : "entrou no";
  const balance = accountId ? accountBalance(state, accountId) : 0;

  if (action.type === "settle")
    return (
      <Modal
        title={title.kind === "Pagar" ? "Registrar pagamento" : "Registrar recebimento"}
        subtitle={`${title.id} · ${title.description} · ${title.counterparty}`}
        onClose={onClose}
        footer={
          <>
            <button className="fn-btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="fn-btn primary"
              disabled={!accountId}
              onClick={() =>
                onApply(
                  settleTitle(
                    state,
                    title.id,
                    {
                      accountId,
                      date,
                      method,
                      amount: num(principal),
                      interest: num(interest),
                      discount: num(discount),
                    },
                    BY,
                  ),
                )
              }
            >
              {title.kind === "Pagar" ? "Confirmar pagamento" : "Confirmar recebimento"} · {money(netValue)}
            </button>
          </>
        }
      >
        {accounts.length === 0 && (
          <p className="fn-warning">
            <AlertIcon /> Nenhuma conta de {title.company} habilitada para{" "}
            {title.kind === "Pagar" ? "pagamentos" : "recebimentos"}. Configure na aba Bancos.
          </p>
        )}
        <div className="fn-form">
          <Field label="Conta bancária">
            <select value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nickname} · {a.bankCode} ag {a.agency} cc {a.account}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Forma">
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {["PIX", "TED", "Boleto", "Débito em conta", "Crédito em conta", "Retorno CNAB", "Dinheiro"].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Valor a baixar (R$)"
            hint={
              num(principal) < title.amount - 0.004
                ? `Baixa parcial: saldo de ${money(title.amount - num(principal))} fica em aberto`
                : "Valor total do lançamento"
            }
          >
            <input
              inputMode="decimal"
              value={principal}
              onChange={e => setPrincipal(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </Field>
          <Field label="Juros e multa (R$)" hint={title.kind === "Pagar" ? "Despesa 5.1.10" : "Receita 4.1.03"}>
            <input
              inputMode="decimal"
              value={interest}
              onChange={e => setInterest(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0,00"
            />
          </Field>
          <Field label="Desconto (R$)" hint={title.kind === "Pagar" ? "Receita 4.1.05" : "Despesa 5.1.11"}>
            <input
              inputMode="decimal"
              value={discount}
              onChange={e => setDiscount(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0,00"
            />
          </Field>
        </div>
        <div className="fn-impact">
          <span>Valor efetivo {title.kind === "Pagar" ? "pago" : "recebido"}</span>
          <b>{money(netValue)}</b>
        </div>
        {accountId && (
          <div className="fn-impact">
            <span>Saldo da conta</span>
            <b>{money(balance)}</b>
            <span>Após a baixa</span>
            <b className={title.kind === "Pagar" && balance - netValue < 0 ? "bad" : ""}>
              {money(title.kind === "Pagar" ? balance - netValue : balance + netValue)}
            </b>
          </div>
        )}
        <p className="fn-note">
          Gera o movimento no extrato da conta e o lançamento contábil: débito em{" "}
          {title.kind === "Pagar" ? title.settlementLedger : "banco"}, crédito em{" "}
          {title.kind === "Pagar" ? "banco" : title.settlementLedger}.
        </p>
      </Modal>
    );

  if (action.type === "cancel")
    return (
      <Modal
        title="Excluir lançamento"
        subtitle={`${title.id} · ${title.description} · ${money(title.amount)}`}
        onClose={onClose}
        footer={
          <>
            <button className="fn-btn ghost" onClick={onClose}>
              Manter lançamento
            </button>
            <button
              className="fn-btn danger"
              disabled={!reason.trim() || !sure}
              onClick={() => onApply(cancelTitle(state, title.id, reason, BY))}
            >
              Excluir lançamento
            </button>
          </>
        }
      >
        <p className="fn-note">
          O lançamento fica como <b>excluído</b> no histórico.{" "}
          {title.competenceEntryId
            ? `O lançamento contábil de competência (${title.competenceEntryId}) é estornado com a data de hoje.`
            : "Não há lançamento contábil de competência."}{" "}
          Nada é apagado.
        </p>
        <Field label="Motivo da exclusão" wide>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex.: despesa lançada em duplicidade"
          />
        </Field>
        <label className="fn-check">
          <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Tenho certeza de que quero
          excluir este lançamento.
        </label>
      </Modal>
    );

  const movement = state.movements.find(m => m.id === title.movementId);
  const account = state.accounts.find(a => a.id === movement?.accountId);
  return (
    <Modal
      title={title.kind === "Pagar" ? "Estornar pagamento" : "Estornar recebimento"}
      subtitle={`${title.id} · ${title.description} · ${money(title.amount)} · ${account?.nickname ?? ""} em ${br(title.settledAt)}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Não estornar
          </button>
          <button
            className="fn-btn danger"
            disabled={!reason.trim() || !cashMoved || !sure || Boolean(movement?.reconciled)}
            onClick={() => onApply(reverseSettlement(state, title.id, { reason, cashMoved: cashMoved === "sim" }, BY))}
          >
            <UndoIcon /> Estornar
          </button>
        </>
      }
    >
      {movement?.reconciled && (
        <p className="fn-warning">
          <AlertIcon /> Este movimento já foi conciliado com o extrato. Desconcilie na aba Extrato antes de estornar.
        </p>
      )}
      <fieldset className="fn-question">
        <legend>O valor já {verbPast} caixa de verdade?</legend>
        <label className={cashMoved === "sim" ? "selected" : ""}>
          <input type="radio" name="cash" checked={cashMoved === "sim"} onChange={() => setCashMoved("sim")} />
          <span>
            <b>Sim, o dinheiro já {verbPast} banco</b>
            <small>
              {title.kind === "Pagar"
                ? "O saldo do banco não muda. O sistema cria um lançamento a receber para recuperar o valor de "
                : "O saldo do banco não muda. O sistema cria um lançamento a pagar para devolver o valor a "}
              {title.counterparty}.
            </small>
          </span>
        </label>
        <label className={cashMoved === "nao" ? "selected" : ""}>
          <input type="radio" name="cash" checked={cashMoved === "nao"} onChange={() => setCashMoved("nao")} />
          <span>
            <b>Não, a baixa foi registrada por engano</b>
            <small>
              O movimento é estornado no extrato de {account?.nickname ?? "banco"} e o saldo volta ao que era.
            </small>
          </span>
        </label>
      </fieldset>
      <Field label="Motivo do estorno" wide>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex.: TED devolvida pelo banco do favorecido"
        />
      </Field>
      <label className="fn-check">
        <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Tenho certeza. Entendo que o
        estorno fica registrado no histórico e na contabilidade.
      </label>
      <p className="fn-note">
        O lançamento volta para “em aberto”. A contabilidade recebe a contrapartida do lançamento original; nada é
        apagado.
      </p>
    </Modal>
  );
}
