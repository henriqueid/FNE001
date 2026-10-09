"use client";

/**
 * Novo lançamento: único, nota parcelada ou recorrente, com opção de lançar e baixar.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { addDays, round2, todayIso, type Effect, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { createTitle } from "@/src/domain/finance/titles";
import { BY, Field, Modal, money } from "@/src/features/finance/finance-ui";
import { moneyInput, num } from "@/src/features/finance/tabs/titles-tab";
import { useMemo, useState } from "react";

export const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type Installment = { due: string; amount: string };

export function NewTitleModal({
  state,
  defaultCompany,
  onClose,
  onApply,
  template,
}: {
  state: FinanceState;
  defaultCompany: string;
  onClose: () => void;
  onApply: (r: Result) => void;
  template?: FinanceTitle;
}) {
  const today = todayIso();
  const [kind, setKind] = useState<"Pagar" | "Receber">(template?.kind ?? "Pagar");
  const [company, setCompany] = useState(
    template?.company ?? (defaultCompany === "Consolidado" ? destinations[3].name : defaultCompany),
  );
  const cats = state.categories.filter(c => c.kind === (kind === "Pagar" ? "Despesa" : "Receita"));
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [counterparty, setCounterparty] = useState(template?.counterparty ?? "");
  const [cpf, setCpf] = useState(template?.counterpartyDocument ?? "");
  const [amount, setAmount] = useState(template ? template.amount.toFixed(2).replace(".", ",") : "");
  const [competence, setCompetence] = useState(today);
  const [firstDue, setFirstDue] = useState(today);
  const [mode, setMode] = useState<"unico" | "parcelado" | "recorrente">("unico");
  const [count, setCount] = useState(3);
  const [interval, setIntervalKind] = useState<"mensal" | "30" | "15" | "7">("mensal");
  const [valueIs, setValueIs] = useState<"total" | "parcela">("total");
  const [edited, setEdited] = useState<Installment[] | null>(null);
  const [settleNow, setSettleNow] = useState(false);
  const accounts = state.accounts.filter(
    a => a.active && a.company === company && (kind === "Pagar" ? a.usage.payments : a.usage.receipts),
  );
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState("PIX");
  const category = cats.find(c => c.id === categoryId) ?? cats[0];
  const value = num(amount);
  const n = mode === "unico" ? 1 : Math.max(2, count);

  const generated: Installment[] = useMemo(() => {
    const dueOf = (i: number) =>
      interval === "mensal" || mode === "recorrente" ? addMonths(firstDue, i) : addDays(firstDue, i * Number(interval));
    if (mode === "unico") return [{ due: firstDue, amount: value.toFixed(2) }];
    if (mode === "recorrente" || valueIs === "parcela")
      return Array.from({ length: n }, (_, i) => ({ due: dueOf(i), amount: value.toFixed(2) }));
    const base = Math.floor((value / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({
      due: dueOf(i),
      amount: (i === n - 1 ? round2(value - base * (n - 1)) : base).toFixed(2),
    }));
  }, [mode, n, interval, firstDue, value, valueIs]);
  const rows = edited && edited.length === generated.length ? edited : generated;
  const total = round2(rows.reduce((s, r) => s + num(r.amount.replace(".", ",")), 0));
  const setRow = (i: number, change: Partial<Installment>) =>
    setEdited(rows.map((r, k) => (k === i ? { ...r, ...change } : r)));
  const labelFor = (i: number) => {
    const base = [documentNumber ? `NF ${documentNumber}` : "", description].filter(Boolean).join(" · ");
    return mode === "unico" ? base : `${base} · ${mode === "parcelado" ? "parcela" : "mês"} ${i + 1}/${n}`;
  };

  function submit() {
    let current = state;
    const effects: Effect[] = [];
    for (let i = 0; i < rows.length; i++) {
      const competenceDate = mode === "recorrente" ? addMonths(competence, i) : competence;
      const r = createTitle(
        current,
        {
          kind,
          description: labelFor(i),
          counterparty,
          counterpartyDocument: cpf || undefined,
          categoryId: category?.id,
          company,
          competenceDate,
          dueDate: rows[i].due,
          amount: num(rows[i].amount.replace(".", ",")),
          origin: mode === "recorrente" ? "Recorrente" : "Manual",
        },
        BY,
        settleNow && i === 0 ? { accountId: accountId || accounts[0]?.id, date: rows[i].due, method } : undefined,
      );
      if (r.error) {
        onApply({ state, error: `Parcela ${i + 1}: ${r.error}` });
        return;
      }
      current = r.state;
      effects.push(...(r.effects ?? []));
    }
    onApply({
      state: current,
      effects,
      message:
        rows.length > 1
          ? `${rows.length} ${mode === "parcelado" ? "parcelas criadas" : "lançamentos mensais criados"} · total ${money(total)}.`
          : `Lançamento criado${settleNow ? " e baixado" : ""}.`,
    });
  }

  const valid =
    value > 0 &&
    description.trim() &&
    counterparty.trim() &&
    category &&
    rows.every(r => num(r.amount.replace(".", ",")) > 0 && r.due) &&
    (!settleNow || accounts.length);
  return (
    <Modal
      wide
      title={template ? "Duplicar lançamento" : "Novo lançamento"}
      subtitle="Único, nota parcelada ou recorrente. A competência vai para a DRE; cada vencimento vira um título no fluxo de caixa."
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="fn-btn primary" disabled={!valid} onClick={submit}>
            {settleNow ? "Lançar e baixar a 1ª" : `Lançar ${rows.length > 1 ? `${rows.length} títulos` : ""}`} ·{" "}
            {money(total)}
          </button>
        </>
      }
    >
      <div className="fn-kind">
        <button
          className={kind === "Pagar" ? "active pay" : ""}
          onClick={() => {
            setKind("Pagar");
            setCategoryId("");
          }}
        >
          Despesa · a pagar
        </button>
        <button
          className={kind === "Receber" ? "active receive" : ""}
          onClick={() => {
            setKind("Receber");
            setCategoryId("");
          }}
        >
          Receita · a receber
        </button>
      </div>
      <div className="fn-form">
        <Field label="Empresa ou veículo">
          <select value={company} onChange={e => setCompany(e.target.value)}>
            {destinations.map(d => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoria" hint={category ? `Conta contábil ${category.ledgerCode}` : undefined}>
          <select value={category?.id ?? ""} onChange={e => setCategoryId(e.target.value)}>
            {cats.map(c => (
              <option key={c.id} value={c.id}>
                {c.group} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={kind === "Pagar" ? "Ex.: Manutenção do ar-condicionado" : "Ex.: Tarifa de cadastro"}
          />
        </Field>
        <Field label="Nº da nota/documento">
          <input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label={kind === "Pagar" ? "Favorecido" : "Pagador"}>
          <input value={counterparty} onChange={e => setCounterparty(e.target.value)} />
        </Field>
        <Field label="CPF/CNPJ">
          <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Competência (data da nota)" hint="Mês em que entra na DRE">
          <input type="date" value={competence} onChange={e => setCompetence(e.target.value)} />
        </Field>
      </div>
      <div className="fn-mode">
        {(
          [
            ["unico", "Único"],
            ["parcelado", "Nota parcelada"],
            ["recorrente", "Recorrente mensal"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={mode === id ? "active" : ""}
            onClick={() => {
              setMode(id);
              setEdited(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="fn-form">
        <Field
          label={
            mode === "parcelado" && valueIs === "total"
              ? "Valor total da nota (R$)"
              : mode === "unico"
                ? "Valor (R$)"
                : "Valor de cada parcela (R$)"
          }
        >
          <input
            inputMode="decimal"
            value={amount}
            onChange={e => {
              setAmount(moneyInput(e.target.value));
              setEdited(null);
            }}
            placeholder="0,00"
          />
        </Field>
        <Field label={mode === "unico" ? "Vencimento" : "1º vencimento"}>
          <input
            type="date"
            value={firstDue}
            onChange={e => {
              setFirstDue(e.target.value);
              setEdited(null);
            }}
          />
        </Field>
        {mode !== "unico" && (
          <Field label={mode === "parcelado" ? "Parcelas" : "Meses"}>
            <input
              type="number"
              min={2}
              max={60}
              value={count}
              onChange={e => {
                setCount(Math.min(60, Math.max(2, Number(e.target.value) || 2)));
                setEdited(null);
              }}
            />
          </Field>
        )}
        {mode === "parcelado" && (
          <Field label="Intervalo">
            <select
              value={interval}
              onChange={e => {
                setIntervalKind(e.target.value as typeof interval);
                setEdited(null);
              }}
            >
              <option value="mensal">Mensal (mesmo dia)</option>
              <option value="30">A cada 30 dias</option>
              <option value="15">A cada 15 dias</option>
              <option value="7">Semanal</option>
            </select>
          </Field>
        )}
        {mode === "parcelado" && (
          <Field label="O valor informado é">
            <select
              value={valueIs}
              onChange={e => {
                setValueIs(e.target.value as typeof valueIs);
                setEdited(null);
              }}
            >
              <option value="total">O total da nota (divide)</option>
              <option value="parcela">O valor de cada parcela</option>
            </select>
          </Field>
        )}
      </div>
      {mode !== "unico" && value > 0 && (
        <div className="fn-installments">
          <div className="fn-installments-head">
            <b>
              {rows.length} {mode === "parcelado" ? "parcelas" : "lançamentos"}
            </b>
            <span>
              Total {money(total)}
              {mode === "parcelado" && valueIs === "total" && Math.abs(total - value) > 0.009 ? (
                <em className="bad"> · difere da nota em {money(total - value)}</em>
              ) : null}
            </span>
            {edited && (
              <button className="fn-btn small link" onClick={() => setEdited(null)}>
                Recalcular
              </button>
            )}
          </div>
          <div className="fn-installments-grid">
            {rows.map((r, i) => (
              <div key={i}>
                <span>
                  {i + 1}/{rows.length}
                </span>
                <input
                  type="date"
                  value={r.due}
                  onChange={e => setRow(i, { due: e.target.value })}
                  aria-label={`Vencimento da parcela ${i + 1}`}
                />
                <input
                  inputMode="decimal"
                  value={r.amount.replace(".", ",")}
                  onChange={e => setRow(i, { amount: moneyInput(e.target.value).replace(",", ".") })}
                  aria-label={`Valor da parcela ${i + 1}`}
                />
              </div>
            ))}
          </div>
          <p className="fn-note">
            Ajuste datas e valores de qualquer parcela antes de lançar. A descrição sai como “{labelFor(0) || "…"}”.
          </p>
        </div>
      )}
      <label className="fn-check">
        <input type="checkbox" checked={settleNow} onChange={e => setSettleNow(e.target.checked)} />{" "}
        {mode === "unico"
          ? `Já foi ${kind === "Pagar" ? "pago" : "recebido"}: lançar e baixar agora`
          : `A 1ª ${mode === "parcelado" ? "parcela" : "competência"} já foi ${kind === "Pagar" ? "paga" : "recebida"}`}
      </label>
      {settleNow && (
        <div className="fn-form">
          <Field label="Conta">
            <select value={accountId || accounts[0]?.id || ""} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nickname}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma">
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {["PIX", "TED", "Boleto", "Débito em conta", "Crédito em conta", "Dinheiro"].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
