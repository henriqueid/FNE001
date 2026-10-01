"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import {
  type PortfolioDisplayStatus,
  type PortfolioState,
  type PortfolioTitleRecord,
} from "@/src/domain/portfolio/model";
import { br, money } from "@/src/features/finance/finance-ui";
import { SlidersIcon } from "@/src/ui/icons";
import { PortfolioTitleDetails } from "./portfolio-title-details";

export type PortfolioGridRow = Omit<PortfolioTitleRecord, "source"> & {
  source: "Carteira" | "Operação liberada";
  amount: number;
  reference: string;
  originLabel: string;
  displayStatus: PortfolioDisplayStatus;
  late: number;
  repId?: string;
};

type ColumnKey =
  | "title"
  | "status"
  | "cedent"
  | "debtor"
  | "company"
  | "operation"
  | "origin"
  | "issueDate"
  | "dueDate"
  | "late"
  | "originalAmount"
  | "paidAmount"
  | "paymentDate"
  | "paymentBank"
  | "repurchasedAmount"
  | "discount"
  | "abatement"
  | "balance"
  | "nfeKey"
  | "ourNumber"
  | "bank"
  | "boleto"
  | "commercial"
  | "cfop"
  | "observation"
  | "lastCollection"
  | "nextContact"
  | "confirmation"
  | "lastEvent"
  | "details";

type Column = {
  key: ColumnKey;
  label: string;
  width: number;
  align?: "right";
  value: (row: PortfolioGridRow) => string | number;
  render: (row: PortfolioGridRow) => ReactNode;
};

const defaultVisible: ColumnKey[] = [
  "title",
  "status",
  "cedent",
  "debtor",
  "company",
  "operation",
  "origin",
  "issueDate",
  "dueDate",
  "originalAmount",
  "paidAmount",
  "paymentDate",
  "paymentBank",
  "balance",
  "nfeKey",
  "ourNumber",
  "lastCollection",
  "nextContact",
  "confirmation",
  "lastEvent",
  "details",
];

const missing = <span className="pf-empty">—</span>;
const date = (value?: string) => (value ? br(value) : missing);

function statusChip(row: PortfolioGridRow) {
  if (row.displayStatus === "Vencido" && row.late > 30) return <span className="fn-chip bad">Vencido &gt; 30d</span>;
  if (row.displayStatus === "Vencido") return <span className="fn-chip warn">Vencido</span>;
  if (row.displayStatus === "A vencer") return <span className="fn-chip ok">A vencer</span>;
  if (["Pago", "Recomprado"].includes(row.displayStatus))
    return <span className="fn-chip ok">{row.displayStatus}</span>;
  if (["Protestado", "Em cartório"].includes(row.displayStatus))
    return <span className="fn-chip bad">{row.displayStatus}</span>;
  if (["Liquidado parcial", "Recomprado parcial", "Em cobrança"].includes(row.displayStatus))
    return <span className="fn-chip warn">{row.displayStatus}</span>;
  return <span className="fn-chip">{row.displayStatus}</span>;
}

function copyNfe(event: ReactMouseEvent, key: string) {
  event.stopPropagation();
  void navigator.clipboard?.writeText(key);
}

function gridColumns(repName: (id?: string) => string, onDetail: (row: PortfolioGridRow) => void): Column[] {
  return [
    {
      key: "title",
      label: "Título",
      width: 175,
      value: row => row.documentNumber,
      render: row => (
        <span className="pf-primary-cell">
          <b>{row.documentNumber}</b>
          <small>{row.receivableType ?? row.source}</small>
        </span>
      ),
    },
    { key: "status", label: "Situação", width: 140, value: row => row.displayStatus, render: statusChip },
    {
      key: "cedent",
      label: "Cedente",
      width: 225,
      value: row => row.ownerName,
      render: row => (
        <>
          {row.ownerName}
          <small>{row.ownerDocument}</small>
        </>
      ),
    },
    {
      key: "debtor",
      label: "Sacado",
      width: 225,
      value: row => row.debtorName,
      render: row => (
        <>
          {row.debtorName}
          <small>{row.debtorDocument}</small>
        </>
      ),
    },
    {
      key: "company",
      label: "Empresa / veículo",
      width: 230,
      value: row => row.company ?? "",
      render: row => (
        <>
          {row.company ?? missing}
          <small>{row.institution}</small>
        </>
      ),
    },
    {
      key: "operation",
      label: "Operação de origem",
      width: 200,
      value: row => `${row.proposal ?? ""} ${row.aditivoNumber ?? ""} ${row.borderoNumber ?? ""}`,
      render: row => (
        <span className="pf-origin-cell">
          <b>{row.proposal ?? "Operação histórica"}</b>
          <small>Aditivo {row.aditivoNumber ?? "—"}</small>
          <small>Borderô {row.borderoNumber ?? "—"}</small>
        </span>
      ),
    },
    {
      key: "origin",
      label: "Origem / importação",
      width: 180,
      value: row => `${row.originLabel} ${row.operationType ?? ""}`,
      render: row => (
        <>
          {row.originLabel}
          <small>{row.operationType}</small>
        </>
      ),
    },
    {
      key: "issueDate",
      label: "Emissão",
      width: 115,
      value: row => row.issueDate ?? "",
      render: row => date(row.issueDate),
    },
    {
      key: "dueDate",
      label: "Vencimento",
      width: 145,
      value: row => row.dueDate,
      render: row => (
        <>
          {br(row.dueDate)}
          <small>
            {row.dueDate !== row.originalDueDate ? `Original ${br(row.originalDueDate)}` : "Vencimento atual"}
          </small>
        </>
      ),
    },
    {
      key: "late",
      label: "Prazo / atraso",
      width: 120,
      align: "right",
      value: row => row.late,
      render: row => (row.late > 0 ? `${row.late} dia(s)` : row.late === 0 ? "Hoje" : `Em ${-row.late} dia(s)`),
    },
    {
      key: "originalAmount",
      label: "Valor original",
      width: 135,
      align: "right",
      value: row => row.originalAmount,
      render: row => money(row.originalAmount),
    },
    {
      key: "paidAmount",
      label: "Valor pago",
      width: 125,
      align: "right",
      value: row => row.paidAmount,
      render: row => (row.paidAmount ? <b className="ok">{money(row.paidAmount)}</b> : missing),
    },
    {
      key: "paymentDate",
      label: "Data pagamento",
      width: 140,
      value: row => row.payments?.at(-1)?.date ?? "",
      render: row => date(row.payments?.at(-1)?.date),
    },
    {
      key: "paymentBank",
      label: "Banco pagamento",
      width: 180,
      value: row => row.payments?.at(-1)?.bank ?? "",
      render: row => {
        const payment = row.payments?.at(-1);
        return payment ? (
          <>
            {payment.bank}
            <small>
              {payment.method ?? "—"} · {payment.reference ?? "Sem referência"}
            </small>
          </>
        ) : (
          missing
        );
      },
    },
    {
      key: "repurchasedAmount",
      label: "Valor recomprado",
      width: 145,
      align: "right",
      value: row => row.repurchasedAmount ?? 0,
      render: row => (row.repurchasedAmount ? money(row.repurchasedAmount) : missing),
    },
    {
      key: "discount",
      label: "Desconto",
      width: 120,
      align: "right",
      value: row => row.discountAmount,
      render: row => money(row.discountAmount),
    },
    {
      key: "abatement",
      label: "Abatimento",
      width: 120,
      align: "right",
      value: row => row.abatementAmount,
      render: row => money(row.abatementAmount),
    },
    {
      key: "balance",
      label: "Saldo",
      width: 135,
      align: "right",
      value: row => row.amount,
      render: row => <b>{money(row.amount)}</b>,
    },
    {
      key: "nfeKey",
      label: "Chave da NF-e",
      width: 310,
      value: row => row.nfeKey ?? "",
      render: row => {
        const key = row.nfeKey?.replace(/\D/g, "") ?? "";
        if (!key) return missing;
        return (
          <span className="pf-key-cell">
            <code title={key}>{key}</code>
            <span className={`fn-chip ${key.length === 44 ? "ok" : "bad"}`}>
              {key.length === 44 ? "44 dígitos" : "Inválida"}
            </span>
            <button type="button" onClick={event => copyNfe(event, key)} title="Copiar chave da NF-e">
              Copiar
            </button>
          </span>
        );
      },
    },
    {
      key: "ourNumber",
      label: "Nosso número",
      width: 145,
      value: row => row.ourNumber ?? "",
      render: row => row.ourNumber ?? missing,
    },
    {
      key: "bank",
      label: "Banco / conta",
      width: 190,
      value: row => `${row.bank ?? ""} ${row.agency ?? ""} ${row.account ?? ""}`,
      render: row => (
        <>
          {row.bank ?? missing}
          {(row.agency || row.account) && (
            <small>
              Ag. {row.agency ?? "—"} · C/C {row.account ?? "—"}
            </small>
          )}
          {(row.wallet || row.agreement) && (
            <small>
              Cart. {row.wallet ?? "—"} · Conv. {row.agreement ?? "—"}
            </small>
          )}
        </>
      ),
    },
    {
      key: "boleto",
      label: "Dados do boleto",
      width: 280,
      value: row => `${row.digitableLine ?? ""} ${row.barcode ?? ""}`,
      render: row => (
        <>
          {row.digitableLine ?? missing}
          {row.barcode && <small>Código {row.barcode}</small>}
          <small>{row.bankStatus}</small>
        </>
      ),
    },
    {
      key: "commercial",
      label: "Comercial",
      width: 165,
      value: row => repName(row.repId),
      render: row => repName(row.repId),
    },
    { key: "cfop", label: "CFOP", width: 90, value: row => row.cfop ?? "", render: row => row.cfop ?? missing },
    {
      key: "observation",
      label: "Observação",
      width: 280,
      value: row => row.observation ?? "",
      render: row => row.observation ?? missing,
    },
    {
      key: "lastCollection",
      label: "Última cobrança",
      width: 170,
      value: row => row.collectionOccurrences?.at(-1)?.chargedAt ?? "",
      render: row => {
        const occurrence = row.collectionOccurrences?.at(-1);
        return occurrence ? (
          <>
            {br(occurrence.chargedAt.slice(0, 10))}
            <small>
              {occurrence.channel} · {occurrence.outcome}
            </small>
          </>
        ) : (
          missing
        );
      },
    },
    {
      key: "nextContact",
      label: "Próximo contato",
      width: 165,
      value: row => row.collectionOccurrences?.at(-1)?.nextContactAt ?? "",
      render: row => {
        const next = row.collectionOccurrences?.at(-1)?.nextContactAt;
        return next ? (
          <span className="pf-followup-cell">
            <b>{br(next.slice(0, 10))}</b>
            <small>{next.includes("T") ? next.slice(11, 16) : "Retorno programado"}</small>
          </span>
        ) : (
          missing
        );
      },
    },
    {
      key: "confirmation",
      label: "Controladoria",
      width: 155,
      value: row => row.confirmation?.status ?? "Não iniciada",
      render: row => {
        const status = row.confirmation?.status ?? "Não iniciada";
        const tone =
          status === "Confirmado" ? "ok" : status === "Divergente" ? "bad" : status === "Pendente" ? "warn" : "";
        return <span className={`fn-chip ${tone}`}>{status}</span>;
      },
    },
    {
      key: "lastEvent",
      label: "Último evento",
      width: 230,
      value: row => row.events.at(-1)?.at ?? "",
      render: row => {
        const event = row.events.at(-1);
        return event ? (
          <>
            {event.action}
            <small>
              {event.at} · {event.by}
            </small>
          </>
        ) : (
          missing
        );
      },
    },
    {
      key: "details",
      label: "Detalhes",
      width: 115,
      value: () => "",
      render: row => (
        <button
          type="button"
          className="fn-btn ghost small pf-detail-trigger"
          onClick={event => {
            event.stopPropagation();
            onDetail(row);
          }}
        >
          Detalhes
        </button>
      ),
    },
  ];
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function PortfolioTitleGrid({
  rows,
  repName,
  portfolio,
  onPortfolio,
}: {
  rows: PortfolioGridRow[];
  repName: (id?: string) => string;
  portfolio: PortfolioState;
  onPortfolio: (state: PortfolioState) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? (rows.find(row => row.id === detailId) ?? null) : null;
  const columns = useMemo(() => gridColumns(repName, row => setDetailId(row.id)), [repName]);
  const [visible, setVisible] = useState<ColumnKey[]>(defaultVisible);
  const [columnMenu, setColumnMenu] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: ColumnKey; direction: "asc" | "desc" }>({ key: "dueDate", direction: "asc" });
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map(column => [column.key, column.width])),
  );
  const visibleColumns = columns.filter(column => visible.includes(column.key));
  const sorted = useMemo(() => {
    const column = columns.find(item => item.key === sort.key)!;
    return [...rows].sort((left, right) => {
      const a = column.value(left);
      const b = column.value(right);
      const result =
        typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR");
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, rows, sort]);
  const selectedVisible = sorted.filter(row => selected.includes(row.id));
  const allSelected = sorted.length > 0 && sorted.every(row => selected.includes(row.id));
  const totalWidth = 44 + visibleColumns.reduce((sum, column) => sum + widths[column.key], 0);

  function toggleAll() {
    const ids = sorted.map(row => row.id);
    setSelected(current =>
      allSelected ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])],
    );
  }

  function toggleRow(id: string) {
    setSelected(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
  }

  function changeSort(key: ColumnKey) {
    setSort(current => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }

  function resize(event: ReactPointerEvent, column: Column) {
    event.preventDefault();
    event.stopPropagation();
    const start = event.clientX;
    const initial = widths[column.key];
    const move = (moveEvent: PointerEvent) =>
      setWidths(current => ({ ...current, [column.key]: Math.max(80, initial + moveEvent.clientX - start) }));
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
  }

  function exportCsv() {
    const header = visibleColumns.map(column => csvCell(column.label)).join(";");
    const lines = sorted.map(row => visibleColumns.map(column => csvCell(column.value(row))).join(";"));
    const blob = new Blob([`\ufeff${[header, ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `carteira-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="pf-grid-toolbar">
        <div>
          <b>{rows.length} título(s)</b>
          <span>{money(rows.reduce((sum, row) => sum + row.amount, 0))} em saldo</span>
          {selectedVisible.length > 0 && <strong>{selectedVisible.length} selecionado(s)</strong>}
        </div>
        <div>
          <div className="pf-column-control">
            <button
              type="button"
              className="fn-btn ghost small"
              onClick={() => setColumnMenu(open => !open)}
              aria-expanded={columnMenu}
            >
              <SlidersIcon /> Colunas <span>{visible.length}</span>
            </button>
            {columnMenu && (
              <div className="pf-column-menu" role="dialog" aria-label="Escolher colunas do GRID">
                <header>
                  <b>Colunas do GRID</b>
                  <button type="button" onClick={() => setVisible(defaultVisible)}>
                    Restaurar padrão
                  </button>
                </header>
                <div>
                  {columns.map(column => (
                    <label key={column.key}>
                      <input
                        type="checkbox"
                        checked={visible.includes(column.key)}
                        onChange={() =>
                          setVisible(current =>
                            current.includes(column.key)
                              ? current.filter(key => key !== column.key)
                              : [...current, column.key],
                          )
                        }
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="fn-btn ghost small" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="fn-table-scroll pf-grid-scroll">
        <table className="fn-table pf-grid" style={{ width: totalWidth }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {visibleColumns.map(column => (
              <col key={column.key} style={{ width: widths[column.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="pf-select-column">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos os títulos exibidos"
                />
              </th>
              {visibleColumns.map(column => (
                <th
                  key={column.key}
                  className={`${column.align === "right" ? "num" : ""} ${column.key === "title" ? "pf-title-column" : ""} ${column.key === "details" ? "pf-details-column" : ""}`}
                >
                  <button type="button" className="pf-sort" onClick={() => changeSort(column.key)}>
                    {column.label}
                    {sort.key === column.key && <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span>}
                  </button>
                  <span
                    className="pf-resize"
                    role="separator"
                    aria-label={`Redimensionar ${column.label}`}
                    onPointerDown={event => resize(event, column)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.id} className={selected.includes(row.id) ? "selected" : ""}>
                <td className="pf-select-column">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Selecionar ${row.documentNumber}`}
                  />
                </td>
                {visibleColumns.map(column => (
                  <td
                    key={column.key}
                    className={`${column.align === "right" ? "num" : ""} ${column.key === "title" ? "pf-title-column" : ""} ${column.key === "details" ? "pf-details-column" : ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <PortfolioTitleDetails
          title={detail}
          repName={repName}
          portfolio={portfolio}
          onPortfolio={onPortfolio}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}
