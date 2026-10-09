"use client";

/**
 * Edição de título em aberto (com motivo; estorna e relança a contabilidade quando necessário).
 */
import { type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { editTitle } from "@/src/domain/finance/titles";
import { BY, Field, Modal } from "@/src/features/finance/finance-ui";
import { moneyInput, num } from "@/src/features/finance/tabs/titles-tab";
import { AlertIcon } from "@/src/ui/icons";
import { useState } from "react";
/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function EditModal({
  state,
  title,
  onClose,
  onApply,
}: {
  state: FinanceState;
  title: FinanceTitle;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const cats = state.categories.filter(c => c.kind === (title.kind === "Pagar" ? "Despesa" : "Receita"));
  const [f, setF] = useState({
    description: title.description,
    counterparty: title.counterparty,
    counterpartyDocument: title.counterpartyDocument ?? "",
    categoryId: title.categoryId ?? "",
    competenceDate: title.competenceDate,
    dueDate: title.dueDate,
    amount: title.amount.toFixed(2).replace(".", ","),
  });
  const [reason, setReason] = useState("");
  const liberation = title.origin === "Liberação de operação";
  const accountingChange =
    Boolean(title.competenceEntryId) &&
    (num(f.amount) !== title.amount ||
      f.categoryId !== (title.categoryId ?? "") ||
      f.competenceDate !== title.competenceDate);
  return (
    <Modal
      wide
      title="Editar lançamento"
      subtitle={`${title.id} · ${title.kind === "Pagar" ? "a pagar" : "a receber"} · ${title.company}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            disabled={!reason.trim()}
            onClick={() =>
              onApply(
                editTitle(
                  state,
                  title.id,
                  {
                    description: f.description,
                    counterparty: f.counterparty,
                    counterpartyDocument: f.counterpartyDocument || undefined,
                    categoryId: f.categoryId || undefined,
                    competenceDate: f.competenceDate,
                    dueDate: f.dueDate,
                    amount: num(f.amount),
                  },
                  reason,
                  BY,
                ),
              )
            }
          >
            Salvar alterações
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Descrição" wide>
          <input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Favorecido/pagador">
          <input value={f.counterparty} onChange={e => setF({ ...f, counterparty: e.target.value })} />
        </Field>
        <Field label="CPF/CNPJ">
          <input value={f.counterpartyDocument} onChange={e => setF({ ...f, counterpartyDocument: e.target.value })} />
        </Field>
        {!liberation && title.categoryId && (
          <Field label="Categoria">
            <select value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}>
              {cats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.group} · {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!liberation && (
          <Field label="Competência">
            <input
              type="date"
              value={f.competenceDate}
              onChange={e => setF({ ...f, competenceDate: e.target.value })}
            />
          </Field>
        )}
        <Field label="Vencimento">
          <input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Valor (R$)">
          <input
            disabled={liberation}
            inputMode="decimal"
            value={f.amount}
            onChange={e => setF({ ...f, amount: moneyInput(e.target.value) })}
          />
        </Field>
      </div>
      {accountingChange && (
        <p className="fn-warning">
          <AlertIcon /> Valor, categoria ou competência mudaram: o lançamento contábil original será estornado e um novo
          será feito.
        </p>
      )}
      <Field label="Motivo da alteração" wide>
        <input value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
