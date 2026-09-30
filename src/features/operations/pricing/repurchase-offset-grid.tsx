"use client";
/**
 * Grade de itens disponíveis para compor a recompra: títulos (com taxa VP,
 * correção/mora, multa, tratamento e valor parcial editáveis) e ajustes de
 * liquidação (pendências e créditos, apenas selecionáveis).
 */
import { preciseMoney } from "@/src/domain/core/format";
import { formatBrazilianDate, formatFlowMoney } from "@/src/domain/operations/format";
import {
  formatRate,
  type OffsetRow,
  type RepurchaseRow,
  type RepurchaseTerms,
  type SettlementAdjustmentRow,
} from "./pricing-model";

/** Converte o texto do input numérico em valor não negativo (vazio/inválido vira 0). */
function nonNegative(value: string) {
  return Math.max(0, Number(value) || 0);
}

type RepurchaseOffsetGridProps = {
  rows: OffsetRow[];
  availableCount: number;
  onToggleTitle: (id: string) => void;
  onToggleAdjustment: (id: string) => void;
  onUpdateTerms: (id: string, changes: Partial<RepurchaseTerms>) => void;
  onRestoreRate: (id: string) => void;
  onSelectVisibleOverdue: () => void;
};

export function RepurchaseOffsetGrid({
  rows,
  availableCount,
  onToggleTitle,
  onToggleAdjustment,
  onUpdateTerms,
  onRestoreRate,
  onSelectVisibleOverdue,
}: RepurchaseOffsetGridProps) {
  return (
    <div className="offset-modal-body">
      <div className="offset-list-toolbar">
        <div>
          <strong>Itens disponíveis para composição</strong>
          <span>
            {rows.length} resultado(s) exibido(s) · {availableCount} disponível(is) considerando o grupo
          </span>
        </div>
        <button type="button" onClick={onSelectVisibleOverdue}>
          Selecionar vencidos visíveis
        </button>
      </div>
      {rows.length ? (
        <div className="offset-title-grid-scroll">
          <div className="offset-title-grid-head">
            <span></span>
            <span>ITEM / ORIGEM</span>
            <span>VENCIMENTO</span>
            <span>VALOR ORIGINAL</span>
            <span>TAXA VP</span>
            <span>CORREÇÃO / MORA</span>
            <span>MULTA</span>
            <span>TRATAMENTO</span>
            <span>VALOR PARCIAL</span>
            <span>VALOR CORRIGIDO</span>
          </div>
          {rows.map(item =>
            item.kind === "Título" ? (
              <TitleOffsetRow
                key={item.row.id}
                row={item.row}
                onToggle={onToggleTitle}
                onUpdateTerms={onUpdateTerms}
                onRestoreRate={onRestoreRate}
              />
            ) : (
              <AdjustmentOffsetRow key={item.row.id} row={item.row} onToggle={onToggleAdjustment} />
            ),
          )}
        </div>
      ) : (
        <div className="offset-empty">Nenhum item encontrado para os filtros informados.</div>
      )}
    </div>
  );
}

type TitleOffsetRowProps = {
  row: RepurchaseRow;
  onToggle: (id: string) => void;
  onUpdateTerms: (id: string, changes: Partial<RepurchaseTerms>) => void;
  onRestoreRate: (id: string) => void;
};

/** Linha de título em recompra, com os termos editáveis quando selecionado. */
function TitleOffsetRow({ row, onToggle, onUpdateTerms, onRestoreRate }: TitleOffsetRowProps) {
  return (
    <div className={`offset-title-grid-row${row.selected ? " selected" : ""}`}>
      <input
        aria-label={`Selecionar ${row.documentNumber}`}
        type="checkbox"
        checked={row.selected}
        onChange={() => onToggle(row.id)}
      />
      <div className="offset-title-id">
        <span className={`repurchase-status ${row.overdue ? "overdue" : "due"}`}>
          {row.overdue ? `Vencido há ${row.days}d` : `A vencer em ${row.days}d`}
        </span>
        <strong>{row.documentNumber}</strong>
        <small>{row.portfolioOwnerName ?? row.debtorName}</small>
        <em>
          {row.scope} · {row.acquisitionReference}
        </em>
      </div>
      <span className={`offset-due-date ${row.overdue ? "overdue" : "due"}`}>
        <strong>{formatBrazilianDate(row.dueDate)}</strong>
        <small>{row.overdue ? "Vencido" : "A vencer"}</small>
      </span>
      <span className="offset-face">{preciseMoney.format(row.faceAmount)}</span>
      <label className="offset-rate">
        <input
          aria-label={`Taxa VP ${row.documentNumber}`}
          type="number"
          step="0.01"
          value={row.appliedRate}
          disabled={!row.selected}
          onChange={event => onUpdateTerms(row.id, { rateOverride: nonNegative(event.target.value) })}
        />
        <b>%</b>
        <button
          type="button"
          disabled={!row.selected || row.terms.rateOverride === undefined}
          onClick={() => onRestoreRate(row.id)}
        >
          Original {formatRate(row.acquisitionMonthlyRate)}%
        </button>
      </label>
      <label className="offset-percent">
        <input
          aria-label={`Correção ou mora ${row.documentNumber}`}
          type="number"
          step="0.01"
          value={row.terms.lateInterestMonthly}
          disabled={!row.selected || !row.overdue}
          onChange={event => onUpdateTerms(row.id, { lateInterestMonthly: nonNegative(event.target.value) })}
        />
        <b>% a.m.</b>
      </label>
      <label className="offset-percent">
        <input
          aria-label={`Multa ${row.documentNumber}`}
          type="number"
          step="0.01"
          value={row.terms.penaltyPercent}
          disabled={!row.selected || !row.overdue}
          onChange={event => onUpdateTerms(row.id, { penaltyPercent: nonNegative(event.target.value) })}
        />
        <b>%</b>
      </label>
      <select
        aria-label={`Tratamento ${row.documentNumber}`}
        value={row.terms.action ?? "Recompra"}
        disabled={!row.selected}
        onChange={event => {
          const action = event.target.value as NonNullable<RepurchaseTerms["action"]>;
          onUpdateTerms(row.id, {
            action,
            partialAmount:
              action === "Recompra parcial"
                ? (row.terms.partialAmount ?? Math.min(row.faceAmount, row.fullRegressValue))
                : row.terms.partialAmount,
          });
        }}
      >
        <option>Recompra</option>
        <option>Baixar do banco</option>
        <option>Baixar somente do sistema</option>
        <option>Recompra parcial</option>
      </select>
      <label className="offset-partial">
        <span>R$</span>
        <input
          aria-label={`Valor parcial ${row.documentNumber}`}
          type="number"
          step="0.01"
          value={row.terms.partialAmount ?? 0}
          disabled={!row.selected || row.terms.action !== "Recompra parcial"}
          onChange={event =>
            onUpdateTerms(row.id, {
              partialAmount: Math.min(row.fullRegressValue, nonNegative(event.target.value)),
            })
          }
        />
      </label>
      <div className="offset-total">
        <strong className="negative">{formatFlowMoney(-row.presentValue)}</strong>
        <small>
          {row.overdue
            ? `Reduz o líquido · correção ${preciseMoney.format(row.adjustment)} · mora ${preciseMoney.format(row.lateInterest)} · multa ${preciseMoney.format(row.penalty)}`
            : `Reduz o líquido · deságio ${preciseMoney.format(row.adjustment)}`}
        </small>
      </div>
    </div>
  );
}

type AdjustmentOffsetRowProps = {
  row: SettlementAdjustmentRow;
  onToggle: (id: string) => void;
};

/** Linha de pendência ou crédito: apenas seleção, sem termos editáveis. */
function AdjustmentOffsetRow({ row, onToggle }: AdjustmentOffsetRowProps) {
  const isCredit = row.kind === "Crédito";
  return (
    <div className={`offset-title-grid-row offset-adjustment-row${row.selected ? " selected" : ""}`}>
      <input
        aria-label={`Selecionar ${row.description}`}
        type="checkbox"
        checked={row.selected}
        onChange={() => onToggle(row.id)}
      />
      <div className="offset-title-id">
        <span className={`offset-kind-badge ${isCredit ? "credit" : "debit"}`}>{row.kind}</span>
        <strong>{row.description}</strong>
        <small>{row.ownerName}</small>
        <em>
          {row.scope} · {row.reference}
        </em>
      </div>
      <span className="offset-placeholder">—</span>
      <span className="offset-face">{preciseMoney.format(row.amount)}</span>
      <span className="offset-placeholder">—</span>
      <span className="offset-placeholder">—</span>
      <span className="offset-placeholder">—</span>
      <span className="offset-treatment-static">Compensação</span>
      <span className="offset-placeholder">—</span>
      <div className="offset-total">
        <strong className={isCredit ? "positive" : "negative"}>
          {formatFlowMoney(isCredit ? row.amount : -row.amount)}
        </strong>
        <small>{isCredit ? "Crédito que compensa a recompra" : "Pendência que reduz o líquido"}</small>
      </div>
    </div>
  );
}
