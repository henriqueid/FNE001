"use client";

/**
 * A pagar e a receber: filtros, seleção múltipla e ações em massa.
 */
import {
  type Bulk,
  BulkCancelModal,
  BulkReverseModal,
  BulkSettleModal,
  RescheduleModal,
} from "@/src/features/finance/titles/bulk-modals";
import { EditModal } from "@/src/features/finance/titles/edit-title-modal";
import { ImportModal } from "@/src/features/finance/titles/import-titles-modal";
import { NewTitleModal } from "@/src/features/finance/titles/new-title-modal";
import { HistoryModal } from "@/src/features/finance/titles/title-history-modal";

import { inScope } from "@/src/domain/finance/banking";
import { addDays, todayIso, type Result } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { CheckIcon, ClockIcon, PlusIcon, SearchIcon, SlidersIcon, UndoIcon } from "@/src/ui/icons";
import { useState } from "react";
import { Field, StatusChip, br, money, parseMoneyBR, type Action } from "@/src/features/finance/finance-ui";

export const num = (v: string) => parseMoneyBR(v);
export const moneyInput = (v: string) => v.replace(/[^\d.,]/g, "");
/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function TitlesTab({
  state,
  scope,
  onAction,
  onNew,
  onApply,
}: {
  state: FinanceState;
  scope: string;
  onAction: (a: NonNullable<Action>) => void;
  onNew: () => void;
  onApply: (r: Result) => boolean;
}) {
  const today = todayIso();
  const [kind, setKind] = useState<"todos" | "Pagar" | "Receber">("todos");
  const [situation, setSituation] = useState<
    "aberto" | "vencido" | "hoje" | "semana" | "baixado" | "excluido" | "todos"
  >("aberto");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [includeReleases, setIncludeReleases] = useState(false);
  const [historyOf, setHistoryOf] = useState<FinanceTitle | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [bulk, setBulk] = useState<Bulk>(null);
  const [editing, setEditing] = useState<FinanceTitle | null>(null);
  const [duplicating, setDuplicating] = useState<FinanceTitle | null>(null);
  const [copied, setCopied] = useState("");

  const list = state.titles
    .filter(t => inScope(t.company, scope) && (includeReleases || t.origin !== "Liberação de operação"))
    .filter(t => kind === "todos" || t.kind === kind)
    .filter(t =>
      situation === "todos"
        ? true
        : situation === "aberto"
          ? t.status === "Em aberto"
          : situation === "vencido"
            ? t.status === "Em aberto" && t.dueDate < today
            : situation === "hoje"
              ? t.status === "Em aberto" && t.dueDate === today
              : situation === "semana"
                ? t.status === "Em aberto" && t.dueDate >= today && t.dueDate <= addDays(today, 7)
                : situation === "baixado"
                  ? t.status === "Baixado"
                  : t.status === "Cancelado",
    )
    .filter(
      t => (!from || t.dueDate >= from) && (!to || t.dueDate <= to) && (!categoryId || t.categoryId === categoryId),
    )
    .filter(
      t =>
        !query.trim() ||
        `${t.id} ${t.description} ${t.counterparty} ${t.counterpartyDocument ?? ""} ${t.company} ${t.amount.toFixed(2)}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  const picked = state.titles.filter(t => selected.has(t.id));
  const allVisible = list.length > 0 && list.every(t => selected.has(t.id));
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisible) list.forEach(t => next.delete(t.id));
      else list.forEach(t => next.add(t.id));
      return next;
    });
  const sumOf = (arr: FinanceTitle[], k: "Pagar" | "Receber") =>
    arr.filter(t => t.kind === k && t.status !== "Cancelado").reduce((s, t) => s + t.amount, 0);
  const counts = {
    open: picked.filter(t => t.status === "Em aberto").length,
    settled: picked.filter(t => t.status === "Baixado").length,
    deletable: picked.filter(t => t.status === "Em aberto" && t.origin !== "Liberação de operação").length,
  };
  const openPicked = picked.filter(t => t.status === "Em aberto");
  const settleLabel =
    openPicked.length && openPicked.every(t => t.kind === "Pagar")
      ? "Pagar"
      : openPicked.length && openPicked.every(t => t.kind === "Receber")
        ? "Receber"
        : "Baixar";
  const done = (r: Result) => {
    if (onApply(r)) {
      setBulk(null);
      setEditing(null);
      setDuplicating(null);
      setSelected(new Set());
    }
  };

  const table = (rows: FinanceTitle[]) => [
    [
      "Código",
      "Tipo",
      "Descrição",
      "Favorecido",
      "CPF/CNPJ",
      "Categoria",
      "Empresa",
      "Competência",
      "Vencimento",
      "Valor",
      "Situação",
      "Baixa",
    ],
    ...rows.map(t => [
      t.id,
      t.kind,
      t.description,
      t.counterparty,
      t.counterpartyDocument ?? "",
      state.categories.find(c => c.id === t.categoryId)?.name ?? t.origin,
      t.company,
      br(t.competenceDate),
      br(t.dueDate),
      t.amount.toFixed(2).replace(".", ","),
      t.status,
      t.settledAt ? br(t.settledAt) : "",
    ]),
  ];
  async function copyRows() {
    const rows = picked.length ? picked : list;
    const tsv = table(rows)
      .map(r => r.join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(`${rows.length} linha(s) copiadas. Cole no Excel.`);
    } catch {
      setCopied("Não foi possível copiar automaticamente neste navegador.");
    }
    setMenu(false);
  }
  function exportCsv() {
    const rows = picked.length ? picked : list;
    const csv =
      "﻿" +
      table(rows)
        .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `lancamentos-${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMenu(false);
  }
  const fn = (label: string, hint: string, enabled: boolean, onClick: () => void, tone = "") => (
    <button
      className={`fn-menu-item ${tone}`}
      disabled={!enabled}
      onClick={() => {
        setMenu(false);
        onClick();
      }}
    >
      <b>{label}</b>
      <small>{hint}</small>
    </button>
  );

  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Contas a pagar e a receber</h2>
          <p>Clique nas linhas para selecionar e use a barra de ações. Importar, exportar e lançar ficam em Funções.</p>
        </div>
        <div className="fn-head-actions">
          <div className="fn-menu-wrap">
            <button className="fn-btn ghost fn-functions" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <SlidersIcon /> Funções{picked.length ? <b>{picked.length}</b> : null}
            </button>
            {menu && (
              <>
                <div className="fn-menu-backdrop" role="presentation" onClick={() => setMenu(false)} />
                <div className="fn-menu" role="menu">
                  <span className="fn-menu-label">Com os selecionados ({picked.length})</span>
                  {fn(
                    "Baixar em massa",
                    `${counts.open} em aberto`,
                    counts.open > 0,
                    () => setBulk("settle"),
                    "release",
                  )}
                  {fn(
                    "Estornar baixas em massa",
                    `${counts.settled} baixado(s)`,
                    counts.settled > 0,
                    () => setBulk("reverse"),
                    "danger",
                  )}
                  {fn("Alterar vencimento", `${counts.open} em aberto`, counts.open > 0, () => setBulk("reschedule"))}
                  {fn(
                    "Excluir em massa",
                    `${counts.deletable} excluível(is)`,
                    counts.deletable > 0,
                    () => setBulk("cancel"),
                    "danger",
                  )}
                  {fn("Duplicar", "Abre um novo lançamento com os mesmos dados", picked.length === 1, () =>
                    setDuplicating(picked[0]),
                  )}
                  <span className="fn-menu-label">Lançar</span>
                  {fn("Novo lançamento", "Único, nota parcelada ou recorrente", true, onNew)}
                  {fn("Importar de planilha", "Cole linhas do Excel", true, () => setBulk("import"))}
                  <span className="fn-menu-label">Exportar {picked.length ? "selecionados" : "a lista filtrada"}</span>
                  {fn("Copiar para o Excel", "Copia as linhas para colar numa planilha", true, copyRows)}
                  {fn("Baixar CSV", "Arquivo para Excel ou contador", true, exportCsv)}
                </div>
              </>
            )}
          </div>
          <button className="fn-btn primary" onClick={onNew}>
            <PlusIcon /> Novo lançamento
          </button>
        </div>
      </header>

      <div className="fn-toolbar">
        <div className="fn-seg">
          {(
            [
              ["todos", "Todos"],
              ["Pagar", "A pagar"],
              ["Receber", "A receber"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={kind === id ? "active" : ""} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="fn-seg">
          {(
            [
              ["aberto", "Em aberto"],
              ["vencido", "Vencidos"],
              ["hoje", "Vence hoje"],
              ["semana", "Próx. 7 dias"],
              ["baixado", "Baixados"],
              ["excluido", "Excluídos"],
              ["todos", "Todos"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={situation === id ? "active" : ""} onClick={() => setSituation(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="fn-toolbar">
        <label className="fn-search">
          <SearchIcon />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Descrição, favorecido, CNPJ, código ou valor"
          />
        </label>
        <Field label="Vencimento de">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="até">
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="fn-check inline">
          <input type="checkbox" checked={includeReleases} onChange={e => setIncludeReleases(e.target.checked)} />{" "}
          Incluir liberações de operações
        </label>
        {(from || to || categoryId || query) && (
          <button
            className="fn-btn small link"
            onClick={() => {
              setFrom("");
              setTo("");
              setCategoryId("");
              setQuery("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>
      <div className="fn-sums">
        <span>
          A pagar <b className="bad">{money(sumOf(list, "Pagar"))}</b>
        </span>
        <span>
          A receber <b className="good">{money(sumOf(list, "Receber"))}</b>
        </span>
        <span>
          Saldo <b>{money(sumOf(list, "Receber") - sumOf(list, "Pagar"))}</b>
        </span>
        <span>{list.length} lançamento(s)</span>
      </div>
      {copied && (
        <p className="fn-note">
          <CheckIcon /> {copied}
        </p>
      )}

      <div
        className={`fn-actionbar ${picked.length ? "has-selection" : ""}`}
        role="toolbar"
        aria-label="Ações com os lançamentos selecionados"
      >
        <div className="fn-actionbar-info">
          {picked.length ? (
            <>
              <b>{picked.length} selecionado(s)</b>
              <span>
                A pagar <strong className="bad">{money(sumOf(picked, "Pagar"))}</strong>
              </span>
              <span>
                A receber <strong className="good">{money(sumOf(picked, "Receber"))}</strong>
              </span>
            </>
          ) : (
            <span>Selecione um ou mais lançamentos na lista para agir</span>
          )}
        </div>
        <div className="fn-actionbar-buttons">
          <button
            className="fn-act settle"
            disabled={!counts.open}
            onClick={() =>
              counts.open === 1
                ? onAction({ type: "settle", title: picked.find(t => t.status === "Em aberto")! })
                : setBulk("settle")
            }
          >
            <CheckIcon />
            {settleLabel}
            {counts.open > 1 ? <b>{counts.open}</b> : null}
          </button>
          <button
            className="fn-act"
            disabled={!(picked.length === 1 && picked[0].status === "Em aberto")}
            onClick={() => setEditing(picked[0])}
          >
            Editar
          </button>
          <button className="fn-act" disabled={!counts.open} onClick={() => setBulk("reschedule")}>
            <ClockIcon />
            Prorrogar
          </button>
          <button className="fn-act" disabled={picked.length !== 1} onClick={() => setDuplicating(picked[0])}>
            Duplicar
          </button>
          <button className="fn-act" disabled={picked.length !== 1} onClick={() => setHistoryOf(picked[0])}>
            Histórico
          </button>
          <span className="fn-act-sep" />
          <button
            className="fn-act warn"
            disabled={!counts.settled}
            onClick={() =>
              counts.settled === 1
                ? onAction({ type: "reverse", title: picked.find(t => t.status === "Baixado")! })
                : setBulk("reverse")
            }
          >
            <UndoIcon />
            Estornar{counts.settled > 1 ? <b>{counts.settled}</b> : null}
          </button>
          <button
            className="fn-act danger"
            disabled={!counts.deletable}
            onClick={() =>
              counts.deletable === 1
                ? onAction({
                    type: "cancel",
                    title: picked.find(t => t.status === "Em aberto" && t.origin !== "Liberação de operação")!,
                  })
                : setBulk("cancel")
            }
          >
            Excluir{counts.deletable > 1 ? <b>{counts.deletable}</b> : null}
          </button>
          {picked.length > 0 && (
            <button className="fn-act link" onClick={() => setSelected(new Set())}>
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="fn-table-scroll">
        <table className="fn-table fn-titles">
          <thead>
            <tr>
              <th className="sel">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os lançamentos visíveis"
                  checked={allVisible}
                  onChange={toggleAll}
                />
              </th>
              <th>Vencimento</th>
              <th>Lançamento</th>
              <th>Categoria</th>
              <th>Empresa</th>
              <th className="num">Valor</th>
              <th>Situação</th>
              <th className="hist" aria-label="Histórico" />
            </tr>
          </thead>
          <tbody>
            {list.map(t => {
              const category = state.categories.find(c => c.id === t.categoryId);
              return (
                <tr
                  key={t.id}
                  className={`clickable ${t.status === "Cancelado" ? "cancelled" : ""} ${selected.has(t.id) ? "selected" : ""}`}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest("input,button")) return;
                    toggle(t.id);
                  }}
                >
                  <td className="sel">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${t.id}`}
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                  </td>
                  <td className="date">{br(t.dueDate)}</td>
                  <td>
                    <b className={`fn-kind-dot ${t.kind === "Pagar" ? "pay" : "receive"}`}>{t.description}</b>
                    <small>
                      {t.id} · {t.counterparty}
                      {t.origin !== "Manual" ? ` · ${t.origin}` : ""}
                      {t.linkedTitleId ? ` · ligado a ${t.linkedTitleId}` : ""}
                    </small>
                  </td>
                  <td>
                    {category ? (
                      <>
                        {category.name}
                        <small>{category.ledgerCode}</small>
                      </>
                    ) : (
                      <small>{t.settlementLedger}</small>
                    )}
                  </td>
                  <td>
                    <small>{t.company}</small>
                  </td>
                  <td className={`num ${t.kind === "Pagar" ? "bad" : "good"}`}>
                    {t.kind === "Pagar" ? "−" : "+"} {money(t.amount)}
                  </td>
                  <td>
                    <StatusChip title={t} today={today} />
                  </td>
                  <td className="hist">
                    <button
                      className="fn-icon-btn"
                      aria-label={`Histórico de ${t.id}`}
                      title="Histórico"
                      onClick={() => setHistoryOf(t)}
                    >
                      <ClockIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <div className="fn-empty">Nenhum lançamento neste filtro.</div>}

      {bulk === "settle" && (
        <BulkSettleModal state={state} titles={picked} onClose={() => setBulk(null)} onApply={done} />
      )}
      {bulk === "reverse" && (
        <BulkReverseModal state={state} titles={picked} onClose={() => setBulk(null)} onApply={done} />
      )}
      {bulk === "cancel" && (
        <BulkCancelModal state={state} titles={picked} onClose={() => setBulk(null)} onApply={done} />
      )}
      {bulk === "reschedule" && (
        <RescheduleModal state={state} titles={picked} onClose={() => setBulk(null)} onApply={done} />
      )}
      {bulk === "import" && (
        <ImportModal state={state} defaultCompany={scope} onClose={() => setBulk(null)} onApply={done} />
      )}
      {editing && <EditModal state={state} title={editing} onClose={() => setEditing(null)} onApply={done} />}
      {historyOf && (
        <HistoryModal
          state={state}
          title={state.titles.find(t => t.id === historyOf.id) ?? historyOf}
          onClose={() => setHistoryOf(null)}
        />
      )}
      {duplicating && (
        <NewTitleModal
          state={state}
          defaultCompany={scope}
          template={duplicating}
          onClose={() => setDuplicating(null)}
          onApply={done}
        />
      )}
    </section>
  );
}
