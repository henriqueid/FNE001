"use client";
/**
 * Últimas 5 operações do cedente, com detalhe da operação selecionada.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type CedentRecentOperation, confirmationTone, percent } from "./cedent-portfolio-model";

export function CedentHistoryList({
  operations,
  selected,
  onToggle,
}: {
  operations: CedentRecentOperation[];
  selected: CedentRecentOperation | null;
  onToggle: (operation: CedentRecentOperation) => void;
}) {
  return (
    <section className="cedent-history-section">
      <div className="cedent-section-title">
        <span>ÚLTIMAS 5 OPERAÇÕES</span>
        <small>Clique em uma operação para abrir os detalhes</small>
      </div>
      <div className="cedent-history-head">
        <span>ADITIVO</span>
        <span>DATA</span>
        <span>VALOR</span>
        <span>TÍTULOS</span>
        <span>CONFIRMAÇÃO</span>
        <span>STATUS</span>
      </div>
      {operations.map(item => (
        <button
          className={`cedent-history-row ${selected?.aditivo === item.aditivo ? "selected" : ""}`}
          key={item.aditivo}
          onClick={() => onToggle(item)}
        >
          <strong>{item.aditivo}</strong>
          <span>{item.date}</span>
          <b>{preciseMoney.format(item.amount)}</b>
          <span>{item.titles}</span>
          <span className={confirmationTone(item.confirmation)}>{percent(item.confirmation)}%</span>
          <em>{item.status}</em>
        </button>
      ))}
      {selected && (
        <div className="cedent-selection-detail">
          <div>
            <span>OPERAÇÃO SELECIONADA</span>
            <strong>Aditivo {selected.aditivo}</strong>
            <small>
              {selected.date} · {selected.status}
            </small>
          </div>
          <div>
            <span>VOLUME</span>
            <strong>{preciseMoney.format(selected.amount)}</strong>
            <small>{selected.titles} títulos processados</small>
          </div>
          <div>
            <span>CONFIRMAÇÃO</span>
            <strong className={selected.confirmation >= 90 ? "positive" : "warning-text"}>
              {percent(selected.confirmation)}%
            </strong>
            <small>Amostra confirmada na operação</small>
          </div>
        </div>
      )}
    </section>
  );
}
