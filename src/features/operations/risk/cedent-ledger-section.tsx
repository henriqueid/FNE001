"use client";
/**
 * Coluna de extrato da carteira do cedente (situação, quantidade e valor) com total e destaque.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type ReactNode } from "react";
import { type CedentLedgerRow } from "./cedent-portfolio-model";

export function CedentLedgerSection({
  title,
  subtitle,
  rows,
  totalLabel,
  totalCount,
  totalAmount,
  highlightLabel,
  highlightValue,
  highlightClassName,
}: {
  title: string;
  subtitle: string;
  rows: CedentLedgerRow[];
  totalLabel: string;
  totalCount: number;
  totalAmount: number;
  highlightLabel: string;
  highlightValue: ReactNode;
  highlightClassName?: string;
}) {
  return (
    <section>
      <div className="cedent-section-title">
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      <div className="cedent-ledger-head">
        <span>Situação</span>
        <span>Qtd.</span>
        <span>Valor</span>
      </div>
      {rows.map(row => (
        <div className={`cedent-ledger-row ${row.tone}`} key={row.label}>
          <span>{row.label}</span>
          <b>{row.value.count}</b>
          <strong>{preciseMoney.format(row.value.amount)}</strong>
        </div>
      ))}
      <div className="cedent-ledger-total">
        <span>{totalLabel}</span>
        <b>{totalCount}</b>
        <strong>{preciseMoney.format(totalAmount)}</strong>
      </div>
      <div className="cedent-highlight-row">
        <span>{highlightLabel}</span>
        <strong className={highlightClassName}>{highlightValue}</strong>
      </div>
    </section>
  );
}
