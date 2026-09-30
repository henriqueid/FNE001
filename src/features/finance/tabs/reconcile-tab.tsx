"use client";

/**
 * Conciliação bancária: importação de OFX, sugestão de pares e conciliação automática e manual.
 */
import { accountBalance, scopedAccounts } from "@/src/domain/finance/banking";
import {
  autoReconcile,
  importStatement,
  launchDifference,
  launchFromStatement,
  parseOfx,
  reconcileManual,
  suggestFor,
  undoReconcile,
} from "@/src/domain/finance/reconciliation";
import { useState } from "react";
import { round2, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, Movement, StatementLine } from "@/src/domain/finance/model";
import { AlertIcon, CheckIcon, SparkIcon, UndoIcon } from "@/src/ui/icons";
import { BY, Field, Modal, br, money } from "@/src/features/finance/finance-ui";

type View = "pendentes" | "conciliados" | "todos";

function LaunchModal({
  state,
  line,
  onClose,
  onApply,
}: {
  state: FinanceState;
  line: StatementLine;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const kind = line.amount < 0 ? "Despesa" : "Receita";
  const cats = state.categories.filter(c => c.kind === kind);
  const [mode, setMode] = useState<"categoria" | "identificar">("categoria");
  const guess =
    cats.find(c =>
      /tarifa|ted|doc|pacote/i.test(line.memo)
        ? c.id === "cat-tarifa-banco"
        : /rend|aplic/i.test(line.memo)
          ? c.id === "cat-financeira"
          : false,
    ) ?? cats[0];
  const [categoryId, setCategoryId] = useState(guess?.id ?? "");
  const [description, setDescription] = useState(line.memo);
  const [counterparty, setCounterparty] = useState("");
  return (
    <Modal
      title="Lançar a partir do extrato"
      subtitle={`${br(line.date)} · ${line.memo} · ${money(line.amount)}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            disabled={mode === "categoria" && !categoryId}
            onClick={() =>
              onApply(launchFromStatement(state, line.id, { mode, categoryId, description, counterparty }, BY))
            }
          >
            Lançar e conciliar
          </button>
        </>
      }
    >
      <div className="fn-mode">
        <button className={mode === "categoria" ? "active" : ""} onClick={() => setMode("categoria")}>
          {line.amount < 0 ? "É uma despesa" : "É uma receita"}
        </button>
        <button className={mode === "identificar" ? "active" : ""} onClick={() => setMode("identificar")}>
          {line.amount < 0 ? "Saída a identificar" : "Crédito a identificar"}
        </button>
      </div>
      <div className="fn-form">
        {mode === "categoria" && (
          <Field label="Categoria">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {cats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.group} · {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Descrição">
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
        <Field label={line.amount < 0 ? "Favorecido" : "Pagador"}>
          <input
            value={counterparty}
            onChange={e => setCounterparty(e.target.value)}
            placeholder={mode === "identificar" ? "A identificar" : "Banco"}
          />
        </Field>
      </div>
      <p className="fn-note">
        {mode === "categoria"
          ? "Cria o título já baixado na data do extrato (competência e caixa) e concilia com esta linha."
          : line.amount < 0
            ? "Registra a saída em Valores a recuperar (1.1.3.02) até descobrir o que foi."
            : "Registra o crédito em Créditos a identificar (2.1.6). Quando descobrir quem pagou, baixe o título certo contra esse valor."}
      </p>
    </Modal>
  );
}

function DiffModal({
  state,
  lineIds,
  movementIds,
  diff,
  onClose,
  onApply,
}: {
  state: FinanceState;
  lineIds: string[];
  movementIds: string[];
  diff: number;
  onClose: () => void;
  onApply: (r: Result) => void;
}) {
  const cats = state.categories.filter(c => c.kind === (diff < 0 ? "Despesa" : "Receita"));
  const [categoryId, setCategoryId] = useState(
    cats.find(c => c.id === (diff < 0 ? "cat-tarifa-banco" : "cat-financeira"))?.id ?? cats[0]?.id ?? "",
  );
  const [description, setDescription] = useState(
    diff < 0 ? "Tarifa bancária cobrada na operação" : "Crédito bancário não previsto",
  );
  return (
    <Modal
      title="Lançar a diferença e conciliar"
      subtitle={`O extrato está ${money(Math.abs(diff))} ${diff < 0 ? "abaixo (saiu mais do banco)" : "acima (entrou mais no banco)"} do sistema`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() => onApply(launchDifference(state, lineIds, movementIds, { categoryId, description }, BY))}
          >
            Lançar {money(Math.abs(diff))} e conciliar
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Categoria">
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {cats.map(c => (
              <option key={c.id} value={c.id}>
                {c.group} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
      </div>
      <p className="fn-note">
        Cria um lançamento baixado com a diferença e concilia tudo junto: {lineIds.length} linha(s) do extrato ×{" "}
        {movementIds.length + 1} lançamento(s) do sistema.
      </p>
    </Modal>
  );
}

export function ReconcileTab({
  state,
  scope,
  accountId,
  setAccountId,
  onApply,
}: {
  state: FinanceState;
  scope: string;
  accountId: string;
  setAccountId: (id: string) => void;
  onApply: (r: Result) => boolean;
}) {
  const accounts = scopedAccounts(state, scope);
  const account = accounts.find(a => a.id === accountId) ?? accounts[0];
  const [view, setView] = useState<View>("pendentes");
  const [tolerance, setTolerance] = useState(3);
  const [bankSel, setBankSel] = useState<Set<string>>(new Set());
  const [sysSel, setSysSel] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState<StatementLine | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [importInfo, setImportInfo] = useState("");
  if (!account)
    return (
      <section className="fn-card">
        <div className="fn-empty">Nenhuma conta nesta empresa.</div>
      </section>
    );
  const statement = (state.statement ?? [])
    .filter(l => l.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const moves = state.movements
    .filter(m => m.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const filterBy = <T extends { matchGroup?: string }>(arr: T[], done: (x: T) => boolean) =>
    arr.filter(x => (view === "todos" ? true : view === "pendentes" ? !done(x) : done(x)));
  const bankRows = filterBy(statement, l => l.status === "Conciliado");
  const sysRows = filterBy(moves, m => m.reconciled);
  const bankPicked = statement.filter(l => bankSel.has(l.id)),
    sysPicked = moves.filter(m => sysSel.has(m.id));
  const bankSum = round2(bankPicked.reduce((s, l) => s + l.amount, 0)),
    sysSum = round2(sysPicked.reduce((s, m) => s + m.amount, 0));
  const diff = round2(bankSum - sysSum);
  const pendingBank = statement.filter(l => l.status === "Pendente"),
    pendingSys = moves.filter(m => !m.reconciled);
  const clear = () => {
    setBankSel(new Set());
    setSysSel(new Set());
  };
  const apply = (r: Result) => {
    if (onApply(r)) {
      clear();
      setLaunching(null);
      setDiffOpen(false);
    }
  };
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseOfx(text);
    if (!parsed.lines.length) {
      onApply({ state, error: "Não encontrei lançamentos neste arquivo. Confira se é um OFX do banco." });
      return;
    }
    const guess = accounts.find(
      a => parsed.accountId && a.account.replace(/\D/g, "").endsWith(parsed.accountId.replace(/\D/g, "").slice(-5)),
    );
    const target = guess ?? account;
    if (guess && guess.id !== account.id) setAccountId(guess.id);
    if (onApply(importStatement(state, target.id, parsed.lines, file.name, BY)))
      setImportInfo(
        `${file.name}: ${parsed.lines.length} lançamento(s) de ${br(parsed.lines[0].date)} a ${br(parsed.lines[parsed.lines.length - 1].date)}${parsed.ledgerBalance !== undefined ? ` · saldo informado pelo banco ${money(parsed.ledgerBalance)} × sistema ${money(accountBalance(state, target.id))}` : ""}`,
      );
  }

  const groupOf = (g?: string) =>
    g ? (
      <span className="fn-chip ok" title={g}>
        <CheckIcon /> {g}
      </span>
    ) : null;
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Conciliação bancária</h2>
          <p>
            Esquerda: o que veio do banco (OFX). Direita: o que está no sistema. Case os pares e trate o que sobrar.
          </p>
        </div>
        <div className="fn-head-actions">
          <label className="fn-btn ghost fn-file">
            Importar OFX
            <input
              type="file"
              accept=".ofx,.OFX,.txt"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <button
            className="fn-btn primary"
            onClick={() => apply(autoReconcile(state, account.id, BY, { toleranceDays: tolerance }))}
          >
            <SparkIcon /> Conciliar automaticamente
          </button>
        </div>
      </header>
      <div className="fn-toolbar">
        <Field label="Conta">
          <select
            value={account.id}
            onChange={e => {
              setAccountId(e.target.value);
              clear();
            }}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.nickname} · {a.company.split(" ·")[0]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tolerância de data">
          <select value={tolerance} onChange={e => setTolerance(Number(e.target.value))}>
            {[0, 1, 2, 3, 5, 7].map(d => (
              <option key={d} value={d}>
                {d === 0 ? "Mesmo dia" : `± ${d} dia(s)`}
              </option>
            ))}
          </select>
        </Field>
        <div className="fn-seg">
          {(
            [
              ["pendentes", "Pendentes"],
              ["conciliados", "Conciliados"],
              ["todos", "Todos"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {importInfo && (
        <p className="fn-note">
          <CheckIcon /> {importInfo}
        </p>
      )}
      <div className="fn-rec-summary">
        <div>
          <span>Extrato pendente</span>
          <b>{pendingBank.length}</b>
          <small>{money(pendingBank.reduce((s, l) => s + l.amount, 0))}</small>
        </div>
        <div>
          <span>Sistema pendente</span>
          <b>{pendingSys.length}</b>
          <small>{money(pendingSys.reduce((s, m) => s + m.amount, 0))}</small>
        </div>
        <div>
          <span>Conciliados</span>
          <b>{statement.filter(l => l.status === "Conciliado").length}</b>
          <small>de {statement.length} linhas do extrato</small>
        </div>
        <div>
          <span>Saldo no sistema</span>
          <b>{money(accountBalance(state, account.id))}</b>
          <small>
            {account.bankName} · cc {account.account}
          </small>
        </div>
      </div>

      <div
        className={`fn-rec-bar ${bankPicked.length || sysPicked.length ? "active" : ""} ${Math.abs(diff) < 0.005 && (bankPicked.length || sysPicked.length) ? "ok" : ""}`}
      >
        <span>
          Extrato <b>{money(bankSum)}</b> <small>({bankPicked.length})</small>
        </span>
        <span>
          Sistema <b>{money(sysSum)}</b> <small>({sysPicked.length})</small>
        </span>
        <span className={Math.abs(diff) < 0.005 ? "good" : "bad"}>
          Diferença <b>{money(diff)}</b>
        </span>
        <div>
          <button
            className="fn-btn small release"
            disabled={!(bankPicked.length || sysPicked.length) || Math.abs(diff) > 0.005}
            onClick={() => apply(reconcileManual(state, [...bankSel], [...sysSel], BY))}
          >
            <CheckIcon /> Conciliar selecionados
          </button>
          <button
            className="fn-btn small ghost"
            disabled={!(bankPicked.length || sysPicked.length) || Math.abs(diff) < 0.005}
            onClick={() => setDiffOpen(true)}
          >
            Lançar diferença e conciliar
          </button>
          <button className="fn-btn small link" disabled={!(bankPicked.length || sysPicked.length)} onClick={clear}>
            Limpar
          </button>
        </div>
        {(bankPicked.length || sysPicked.length) && Math.abs(diff) > 0.005 ? (
          <p>
            <AlertIcon />{" "}
            {diff < 0
              ? `Saiu ${money(-diff)} a mais no banco do que no sistema`
              : `Entrou ${money(diff)} a mais no banco do que no sistema`}
            . Selecione mais itens, lance a diferença (tarifa, juros, IOF) ou corrija o lançamento do sistema.
          </p>
        ) : null}
      </div>

      <div className="fn-rec-grids">
        <div className="fn-rec-col">
          <h3>
            Extrato do banco (OFX) <small>{bankRows.length}</small>
          </h3>
          <div className="fn-table-scroll">
            <table className="fn-table fn-rec">
              <thead>
                <tr>
                  <th className="sel" />
                  <th>Data</th>
                  <th>Histórico do banco</th>
                  <th className="num">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bankRows.map(l => {
                  const suggestions = l.status === "Pendente" ? suggestFor(state, l.id) : [];
                  return (
                    <tr
                      key={l.id}
                      className={`${bankSel.has(l.id) ? "selected" : ""} ${l.status === "Conciliado" ? "matched" : ""}`}
                    >
                      <td className="sel">
                        {l.status === "Pendente" && (
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${l.memo}`}
                            checked={bankSel.has(l.id)}
                            onChange={() => toggle(bankSel, setBankSel, l.id)}
                          />
                        )}
                      </td>
                      <td className="date">{br(l.date)}</td>
                      <td>
                        <b>{l.memo}</b>
                        <small>
                          FITID {l.fitid} · {l.file}
                        </small>
                        {suggestions.map(sg => (
                          <button
                            key={sg.m.id}
                            className="fn-suggest"
                            onClick={() => {
                              setBankSel(new Set([l.id]));
                              setSysSel(new Set([sg.m.id]));
                            }}
                          >
                            Possível par: {sg.m.description.split(" · ")[0]} {br(sg.m.date).slice(0, 5)}{" "}
                            {money(sg.m.amount)}
                            {Math.abs(sg.diff) > 0.005
                              ? ` · diferença ${money(sg.diff)}`
                              : ` · ${sg.days} dia(s) de diferença`}
                          </button>
                        ))}
                      </td>
                      <td className={`num ${l.amount < 0 ? "bad" : "good"}`}>{money(l.amount)}</td>
                      <td className="actions">
                        {l.status === "Pendente" ? (
                          <button className="fn-btn small ghost" onClick={() => setLaunching(l)}>
                            Lançar
                          </button>
                        ) : (
                          <>
                            {groupOf(l.matchGroup)}
                            <button
                              className="fn-btn small link"
                              onClick={() => apply(undoReconcile(state, l.matchGroup!, BY))}
                            >
                              <UndoIcon /> Desfazer
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {bankRows.length === 0 && (
            <div className="fn-empty">
              {statement.length ? "Nada neste filtro." : "Nenhum extrato importado para esta conta. Use Importar OFX."}
            </div>
          )}
        </div>
        <div className="fn-rec-col">
          <h3>
            Lançamentos do sistema <small>{sysRows.length}</small>
          </h3>
          <div className="fn-table-scroll">
            <table className="fn-table fn-rec">
              <thead>
                <tr>
                  <th className="sel" />
                  <th>Data</th>
                  <th>Lançamento</th>
                  <th className="num">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sysRows.map((m: Movement) => (
                  <tr
                    key={m.id}
                    className={`${sysSel.has(m.id) ? "selected" : ""} ${m.reconciled ? "matched" : ""} ${m.kind === "Estorno" || m.reversedBy ? "reversed" : ""}`}
                  >
                    <td className="sel">
                      {!m.reconciled && (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${m.id}`}
                          checked={sysSel.has(m.id)}
                          onChange={() => toggle(sysSel, setSysSel, m.id)}
                        />
                      )}
                    </td>
                    <td className="date">{br(m.date)}</td>
                    <td>
                      <b>{m.description}</b>
                      <small>
                        {m.id} · {m.kind}
                        {m.titleId ? ` · ${m.titleId}` : ""}
                        {m.reversedBy ? ` · estornado por ${m.reversedBy}` : ""}
                        {m.reversalOf ? ` · estorno de ${m.reversalOf}` : ""}
                      </small>
                    </td>
                    <td className={`num ${m.amount < 0 ? "bad" : "good"}`}>{money(m.amount)}</td>
                    <td className="actions">
                      {m.reconciled ? (
                        <>
                          {groupOf(m.matchGroup)}
                          {m.matchGroup && (
                            <button
                              className="fn-btn small link"
                              onClick={() => apply(undoReconcile(state, m.matchGroup!, BY))}
                            >
                              <UndoIcon /> Desfazer
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="fn-chip warn">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sysRows.length === 0 && <div className="fn-empty">Nada neste filtro.</div>}
        </div>
      </div>
      <p className="fn-note">
        Dica: um movimento e o seu estorno que não chegaram ao banco podem ser conciliados juntos, sem linha do extrato,
        porque se anulam. Pagamentos agrupados pelo banco (1 linha × vários lançamentos) também fecham pela soma.
      </p>
      {launching && <LaunchModal state={state} line={launching} onClose={() => setLaunching(null)} onApply={apply} />}
      {diffOpen && (
        <DiffModal
          state={state}
          lineIds={[...bankSel]}
          movementIds={[...sysSel]}
          diff={diff}
          onClose={() => setDiffOpen(false)}
          onApply={apply}
        />
      )}
    </section>
  );
}
