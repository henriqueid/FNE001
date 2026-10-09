"use client";

/**
 * Ações em massa sobre títulos: baixar, estornar, excluir e prorrogar.
 */
import { defaultAccountFor } from "@/src/domain/finance/banking";
import { addDays, todayIso, type Effect, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { cancelTitle, rescheduleTitles, reverseSettlement, settleTitle } from "@/src/domain/finance/titles";
import { br, BY, Field, Modal, money } from "@/src/features/finance/finance-ui";
import { AlertIcon, UndoIcon } from "@/src/ui/icons";
import { useState } from "react";
/* aplica uma função a vários lançamentos, acumulando o estado e os erros */
export function runMany(
  state: FinanceState,
  ids: string[],
  fn: (s: FinanceState, id: string) => Result,
  verb: string,
): Result {
  let current = state;
  const errors: string[] = [];
  const effects: Effect[] = [];
  let ok = 0;
  ids.forEach(id => {
    const r = fn(current, id);
    if (r.error) errors.push(r.error);
    else {
      current = r.state;
      ok++;
      effects.push(...(r.effects ?? []));
    }
  });
  if (!ok) return { state, error: errors[0] ?? `Nenhum lançamento ${verb}.` };
  return {
    state: current,
    effects,
    message: `${ok} lançamento(s) ${verb}${errors.length ? `. ${errors.length} não processado(s): ${errors.slice(0, 2).join(" · ")}${errors.length > 2 ? "…" : ""}` : "."}`,
  };
}

/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function BulkSettleModal({
  state,
  titles,
  onClose,
  onApply,
}: {
  state: FinanceState;
  titles: FinanceTitle[];
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const open = titles.filter(t => t.status === "Em aberto");
  const companies = [...new Set(open.map(t => t.company))];
  const [accountId, setAccountId] = useState("auto");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("PIX");
  const [sure, setSure] = useState(false);
  const pay = open.filter(t => t.kind === "Pagar").reduce((s, t) => s + t.amount, 0),
    receive = open.filter(t => t.kind === "Receber").reduce((s, t) => s + t.amount, 0);
  const options = state.accounts.filter(a => a.active && companies.includes(a.company));
  const missing = accountId === "auto" ? open.filter(t => !defaultAccountFor(state, t.company, t.kind)) : [];
  return (
    <Modal
      wide
      title="Baixar em massa"
      subtitle={`${open.length} lançamento(s) em aberto de ${companies.length} empresa(s)${titles.length > open.length ? ` · ${titles.length - open.length} já baixado(s) ou excluído(s) serão ignorados` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            disabled={!open.length || !sure}
            onClick={() =>
              onApply(
                runMany(
                  state,
                  open.map(t => t.id),
                  (s, id) => {
                    const t = s.titles.find(x => x.id === id)!;
                    const acc = accountId === "auto" ? defaultAccountFor(s, t.company, t.kind)?.id : accountId;
                    return acc
                      ? settleTitle(s, id, { accountId: acc, date, method }, BY)
                      : { state: s, error: `${id}: nenhuma conta padrão em ${t.company}` };
                  },
                  "baixado(s)",
                ),
              )
            }
          >
            Baixar {open.length} lançamento(s)
          </button>
        </>
      }
    >
      <div className="fn-sums">
        <span>
          Pagamentos <b className="bad">{money(pay)}</b>
        </span>
        <span>
          Recebimentos <b className="good">{money(receive)}</b>
        </span>
        <span>
          Efeito no caixa <b>{money(receive - pay)}</b>
        </span>
      </div>
      <div className="fn-form">
        <Field
          label="Conta"
          hint={
            accountId === "auto"
              ? "Usa a primeira conta habilitada de cada empresa"
              : "Só lançamentos da mesma empresa da conta serão baixados"
          }
        >
          <select value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="auto">Conta padrão de cada empresa</option>
            {options.map(a => (
              <option key={a.id} value={a.id}>
                {a.nickname} · {a.company.split(" ·")[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data da baixa">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Forma">
          <select value={method} onChange={e => setMethod(e.target.value)}>
            {["PIX", "TED", "Boleto", "Débito em conta", "Crédito em conta", "Retorno CNAB"].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      {missing.length > 0 && (
        <p className="fn-warning">
          <AlertIcon /> {missing.length} lançamento(s) sem conta habilitada na empresa; eles serão ignorados.
        </p>
      )}
      <div className="fn-mini-list">
        {open.slice(0, 8).map(t => (
          <p key={t.id}>
            <span>
              {br(t.dueDate)} · {t.description}
            </span>
            <b className={t.kind === "Pagar" ? "bad" : "good"}>
              {t.kind === "Pagar" ? "−" : "+"} {money(t.amount)}
            </b>
          </p>
        ))}
        {open.length > 8 && (
          <p>
            <span>e mais {open.length - 8}…</span>
          </p>
        )}
      </div>
      <p className="fn-note">
        Baixa pelo valor integral, sem juros ou desconto. Para baixa parcial ou com juros, use o botão da linha.
      </p>
      <label className="fn-check">
        <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Confirmo a baixa de{" "}
        {open.length} lançamento(s) na data {br(date)}.
      </label>
    </Modal>
  );
}

/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function BulkReverseModal({
  state,
  titles,
  onClose,
  onApply,
}: {
  state: FinanceState;
  titles: FinanceTitle[];
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const settled = titles.filter(t => t.status === "Baixado");
  const reconciled = settled.filter(t => state.movements.find(m => m.id === t.movementId)?.reconciled);
  const [reason, setReason] = useState("");
  const [cash, setCash] = useState<"" | "sim" | "nao">("");
  const [sure, setSure] = useState(false);
  return (
    <Modal
      wide
      title="Estornar baixas em massa"
      subtitle={`${settled.length} lançamento(s) baixado(s) · ${money(settled.reduce((s, t) => s + t.amount, 0))}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Não estornar
          </button>
          <button
            className="fn-btn danger"
            disabled={!settled.length || !reason.trim() || !cash || !sure}
            onClick={() =>
              onApply(
                runMany(
                  state,
                  settled.map(t => t.id),
                  (s, id) => reverseSettlement(s, id, { reason, cashMoved: cash === "sim" }, BY),
                  "estornado(s)",
                ),
              )
            }
          >
            <UndoIcon /> Estornar {settled.length}
          </button>
        </>
      }
    >
      {reconciled.length > 0 && (
        <p className="fn-warning">
          <AlertIcon /> {reconciled.length} já conciliado(s) no extrato não serão estornados. Desconcilie antes.
        </p>
      )}
      <fieldset className="fn-question">
        <legend>O valor destes lançamentos já saiu ou entrou no caixa de verdade?</legend>
        <label className={cash === "sim" ? "selected" : ""}>
          <input type="radio" name="bcash" checked={cash === "sim"} onChange={() => setCash("sim")} />
          <span>
            <b>Sim, o dinheiro já movimentou o banco</b>
            <small>
              O saldo não muda. Para cada um, o sistema cria um lançamento para recuperar (pagamentos) ou devolver
              (recebimentos) o valor.
            </small>
          </span>
        </label>
        <label className={cash === "nao" ? "selected" : ""}>
          <input type="radio" name="bcash" checked={cash === "nao"} onChange={() => setCash("nao")} />
          <span>
            <b>Não, as baixas foram registradas por engano</b>
            <small>Os movimentos são estornados no extrato e os saldos voltam.</small>
          </span>
        </label>
      </fieldset>
      <Field label="Motivo do estorno" wide>
        <textarea
          rows={2}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex.: lote de pagamentos rejeitado pelo banco"
        />
      </Field>
      <label className="fn-check">
        <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Tenho certeza. Cada estorno
        fica no histórico e na contabilidade.
      </label>
    </Modal>
  );
}

/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function BulkCancelModal({
  state,
  titles,
  onClose,
  onApply,
}: {
  state: FinanceState;
  titles: FinanceTitle[];
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const open = titles.filter(t => t.status === "Em aberto" && t.origin !== "Liberação de operação");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  return (
    <Modal
      title="Excluir lançamentos"
      subtitle={`${open.length} lançamento(s) em aberto · ${money(open.reduce((s, t) => s + t.amount, 0))}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Manter
          </button>
          <button
            className="fn-btn danger"
            disabled={!open.length || !reason.trim() || !sure}
            onClick={() =>
              onApply(
                runMany(
                  state,
                  open.map(t => t.id),
                  (s, id) => cancelTitle(s, id, reason, BY),
                  "excluído(s)",
                ),
              )
            }
          >
            Excluir {open.length}
          </button>
        </>
      }
    >
      {titles.length > open.length && (
        <p className="fn-warning">
          <AlertIcon /> {titles.length - open.length} selecionado(s) não podem ser excluídos (baixados, já excluídos ou
          liberações de operação).
        </p>
      )}
      <p className="fn-note">Ficam como excluídos no histórico e a competência contábil é estornada. Nada é apagado.</p>
      <Field label="Motivo" wide>
        <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
      <label className="fn-check">
        <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Tenho certeza de que quero
        excluir estes lançamentos.
      </label>
    </Modal>
  );
}

/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function RescheduleModal({
  state,
  titles,
  onClose,
  onApply,
}: {
  state: FinanceState;
  titles: FinanceTitle[];
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const open = titles.filter(t => t.status === "Em aberto");
  const [mode, setMode] = useState<"data" | "dias">("dias");
  const [date, setDate] = useState(addDays(todayIso(), 7));
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Alterar vencimento"
      subtitle={`${open.length} lançamento(s) em aberto`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            disabled={!open.length || !reason.trim()}
            onClick={() =>
              onApply(
                rescheduleTitles(
                  state,
                  open.map(t => t.id),
                  mode === "data" ? { newDate: date, reason } : { days, reason },
                  BY,
                ),
              )
            }
          >
            Alterar {open.length} vencimento(s)
          </button>
        </>
      }
    >
      <div className="fn-mode">
        {(
          [
            ["dias", "Adiar em dias"],
            ["data", "Nova data para todos"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="fn-form">
        {mode === "dias" ? (
          <Field label="Dias (negativo antecipa)">
            <input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 0)} />
          </Field>
        ) : (
          <Field label="Nova data">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Motivo" wide>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: negociado com o fornecedor" />
      </Field>
      <p className="fn-note">Muda só o fluxo de caixa. A competência e a contabilidade não mudam.</p>
    </Modal>
  );
}

export type Bulk = "settle" | "reverse" | "cancel" | "reschedule" | "import" | null;
