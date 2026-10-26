"use client";

/**
 * Importação de títulos colados do Excel.
 */
import { useCompanyDestinations } from "@/src/app/company-context";
import { parseFinanceDate } from "@/src/domain/finance/date";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import { createTitle } from "@/src/domain/finance/titles";
import { br, BY, Field, Modal, money } from "@/src/features/finance/finance-ui";
import { parseMoneyBR as num } from "@/src/features/finance/finance-ui";
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
  const destinations = useCompanyDestinations();
  const [text, setText] = useState("");
  const today = todayIso();
  const fallbackCompany = defaultCompany === "Consolidado" ? (destinations[0]?.name ?? "") : defaultCompany;
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
      const companyQuery = (c[4] ?? "").toLocaleLowerCase();
      const exact = destinations.filter(item => item.name.toLocaleLowerCase() === companyQuery);
      const matches = exact.length
        ? exact
        : destinations.filter(item => item.name.toLocaleLowerCase().startsWith(companyQuery));
      const company = companyQuery
        ? matches.length === 1
          ? matches[0].name
          : ""
        : (destinations.find(item => item.name === fallbackCompany)?.name ?? "");
      const companyError =
        !company && (companyQuery && matches.length > 1 ? "empresa ambígua" : "empresa não encontrada");
      const due = parseFinanceDate(c[6] ?? "");
      const explicitCompetence = c[5] ?? "";
      const competence = explicitCompetence ? parseFinanceDate(explicitCompetence) : due || today;
      const amount = num(c[7] ?? "");
      const errors = [
        companyError,
        !kind && "tipo",
        !c[1] && "descrição",
        !c[2] && "favorecido",
        (!category || (kind && category.kind !== (kind === "Pagar" ? "Despesa" : "Receita"))) && "categoria",
        !due && "vencimento",
        !competence && "competência",
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
    if (!ok.length) return;
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
          placeholder="Cole aqui as linhas copiadas da sua planilha. Nenhum lançamento de exemplo será incluído."
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
                      {p.counterparty} · {p.company || "Empresa não resolvida"}
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
