"use client";
/**
 * Ranking dos 10 maiores sacados do cedente, com detalhe do sacado selecionado.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type CedentDebtorRanking, confirmationTone, percent } from "./cedent-portfolio-model";

export function CedentTopDebtors({
  debtors,
  selected,
  onToggle,
}: {
  debtors: CedentDebtorRanking[];
  selected: CedentDebtorRanking | null;
  onToggle: (debtor: CedentDebtorRanking) => void;
}) {
  return (
    <section className="cedent-ranking-section">
      <div className="cedent-section-title">
        <span>TOP 10 SACADOS</span>
        <small>Clique em um sacado para abrir os detalhes</small>
      </div>
      <div className="cedent-ranking-head">
        <span>#</span>
        <span>SACADO</span>
        <span>EXPOSIÇÃO</span>
        <span>CONCENTRAÇÃO</span>
        <span>SCORE</span>
        <span>CONFIRMAÇÃO</span>
      </div>
      {debtors.map((item, index) => (
        <button
          className={`cedent-ranking-row ${selected?.name === item.name ? "selected" : ""}`}
          key={item.name}
          onClick={() => onToggle(item)}
        >
          <b>{index + 1}</b>
          <span>
            <strong>{item.name}</strong>
            <small>{item.document}</small>
          </span>
          <strong>{preciseMoney.format(item.exposure)}</strong>
          <span>
            <i style={{ width: `${Math.min(100, item.share * 3.2)}%` }} />
            {percent(item.share)}%
          </span>
          <em className={item.score >= 700 ? "good" : item.score >= 600 ? "watch" : "bad"}>{item.score}</em>
          <strong className={confirmationTone(item.confirmation)}>{percent(item.confirmation)}%</strong>
        </button>
      ))}
      {selected && (
        <div className="cedent-selection-detail debtor-detail">
          <div>
            <span>SACADO SELECIONADO</span>
            <strong>{selected.name}</strong>
            <small>{selected.document}</small>
          </div>
          <div>
            <span>EXPOSIÇÃO / CONCENTRAÇÃO</span>
            <strong>{preciseMoney.format(selected.exposure)}</strong>
            <small>{percent(selected.share)}% da carteira do cedente</small>
          </div>
          <div>
            <span>SCORE / CONFIRMAÇÃO</span>
            <strong>
              {selected.score} · {percent(selected.confirmation)}%
            </strong>
            <small>
              {selected.score >= 700
                ? "Relacionamento positivo"
                : selected.score >= 600
                  ? "Relacionamento em atenção"
                  : "Relacionamento crítico"}
            </small>
          </div>
        </div>
      )}
    </section>
  );
}
