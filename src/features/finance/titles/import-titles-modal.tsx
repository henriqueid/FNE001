"use client";

/**
 * Importação de títulos colados do Excel.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import { createTitle } from "@/src/domain/finance/titles";
import { br, BY, Field, Modal, money } from "@/src/features/finance/finance-ui";
import { num } from "@/src/features/finance/tabs/titles-tab";
import { useState } from "react";

/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function ImportModal({
  state,
  defaultCompany,
  onClose,
  onApply,
}: {
  state: FinanceState;
  defaultCompany: string;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const [text, setText] = useState("");
  const today = todayIso();
  const toIso = (v: string) => {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : "";
  };
  const fallbackCompany = defaultCompany === "Consolidado" ? destinations[3].name : defaultCompany;
  const parsed = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const c = line.split(/\t|;/).map(x => x.trim());
      const kind = /^rec/i.test(c[0]) ? ("Receber" as const) : /^pag/i.test(c[0]) ? ("Pagar" as const) : null;
      const category = state.categories.find(
        cat => cat.name.toLowerCase() === (c[3] ?? "").toLowerCase() || cat.id === c[3],
      );
      const company =
        destinations.find(d => d.name.toLowerCase().startsWith((c[4] || "").toLowerCase()) && c[4])?.name ??
        fallbackCompany;
      const due = toIso(c[6] ?? ""),
        competence = toIso(c[5] ?? "") || due || today;
      const amount = num(c[7] ?? "");
      const errors = [
        !kind && "tipo",
        !c[1] && "descrição",
        !c[2] && "favorecido",
        (!category || (kind && category.kind !== (kind === "Pagar" ? "Despesa" : "Receita"))) && "categoria",
        !due && "vencimento",
        !(amount > 0) && "valor",
      ].filter(Boolean) as string[];
      return {
        i: i + 1,
        kind,
        description: c[1] ?? "",
        counterparty: c[2] ?? "",
        category,
        company,
        competence,
        due,
        amount,
        errors,
      };
    });
  const ok = parsed.filter(p => !p.errors.length);
  function submit() {
    let current = state;
    for (const p of ok) {
      const r = createTitle(
        current,
        {
          kind: p.kind!,
          description: p.description,
          counterparty: p.counterparty,
          categoryId: p.category!.id,
          company: p.company,
          competenceDate: p.competence,
          dueDate: p.due,
          amount: p.amount,
        },
        BY,
      );
      if (r.error) {
        onApply({ state, error: `Linha ${p.i}: ${r.error}` });
        return;
      }
      current = r.state;
    }
    onApply({ state: current, message: `${ok.length} lançamento(s) importado(s).` });
  }
  return (
    <Modal
      wide
      title="Importar lançamentos de planilha"
      subtitle="Copie as linhas do Excel e cole abaixo. Colunas: Tipo · Descrição · Favorecido · Categoria · Empresa · Competência · Vencimento · Valor"
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="fn-btn primary" disabled={!ok.length} onClick={submit}>
            Importar {ok.length} lançamento(s)
          </button>
        </>
      }
    >
      <Field label="Linhas (separadas por tabulação ou ponto e vírgula)" wide>
        <textarea
          rows={6}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            "Pagar\tEnergia elétrica\tCopel\tDespesas gerais\tLastro Fomento\t01/10/2026\t15/10/2026\t1.240,50\nReceber\tTarifa de cadastro\tGZ Transportes\tTarifas e ad valorem\tÓrbita\t01/10/2026\t05/10/2026\t800,00"
          }
        />
      </Field>
      <p className="fn-note">
        Categorias disponíveis: {state.categories.map(c => c.name).join(", ")}. Empresa em branco usa {fallbackCompany}.
      </p>
      {parsed.length > 0 && (
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th className="num">Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map(p => (
                <tr key={p.i} className={p.errors.length ? "reversed" : ""}>
                  <td>{p.i}</td>
                  <td>{p.kind ?? "—"}</td>
                  <td>
                    <b>{p.description || "—"}</b>
                    <small>
                      {p.counterparty} · {p.company}
                    </small>
                  </td>
                  <td>{p.category?.name ?? "—"}</td>
                  <td>{p.due ? br(p.due) : "—"}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td>
                    {p.errors.length ? (
                      <span className="fn-chip bad">Revisar: {p.errors.join(", ")}</span>
                    ) : (
                      <span className="fn-chip ok">Pronto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
