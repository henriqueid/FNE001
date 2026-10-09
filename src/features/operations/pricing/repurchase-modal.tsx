"use client";
/**
 * Modal "Recompra e compensações": resumo do efeito no líquido, insights da
 * seleção, filtros (natureza, origem, grupo empresarial, busca), memória dos
 * itens reservados, grade de itens disponíveis e ações de limpar/aplicar.
 * Em condição salva, abre em modo de consulta (controles desabilitados).
 */
import { preciseMoney } from "@/src/domain/core/format";
import { formatFlowMoney } from "@/src/domain/operations/format";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, CloseIcon, SearchIcon } from "@/src/ui/icons";
import {
  type OffsetFilters,
  type OffsetMemoryGroup,
  type OffsetRow,
  type OffsetSourceFilter,
  type RepurchaseResult,
  type RepurchaseTerms,
  selectedCreditTotal,
  type SettlementAdjustmentResult,
} from "./pricing-model";
import { RepurchaseOffsetGrid } from "./repurchase-offset-grid";

/** Classe de cor do efeito no líquido: débito líquido é negativo, crédito líquido é positivo. */
function offsetEffectTone(totalOffsets: number) {
  return totalOffsets > 0 ? "negative" : totalOffsets < 0 ? "positive" : "";
}

type RepurchaseModalProps = {
  locked: boolean;
  cedent: string;
  commercialNet: number;
  totalOffsets: number;
  netAfterRepurchase: number;
  repurchase: RepurchaseResult;
  settlementAdjustments: SettlementAdjustmentResult;
  selectedCount: number;
  selectedOffsetMemory: OffsetMemoryGroup[];
  availableCount: number;
  filteredRows: OffsetRow[];
  filters: OffsetFilters;
  onFiltersChange: (changes: Partial<OffsetFilters>) => void;
  onToggleTitle: (id: string) => void;
  onToggleAdjustment: (id: string) => void;
  onUpdateTerms: (id: string, changes: Partial<RepurchaseTerms>) => void;
  onRestoreRate: (id: string) => void;
  onSelectVisibleOverdue: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function RepurchaseModal({
  locked,
  cedent,
  commercialNet,
  totalOffsets,
  netAfterRepurchase,
  repurchase,
  settlementAdjustments,
  selectedCount,
  selectedOffsetMemory,
  availableCount,
  filteredRows,
  filters,
  onFiltersChange,
  onToggleTitle,
  onToggleAdjustment,
  onUpdateTerms,
  onRestoreRate,
  onSelectVisibleOverdue,
  onClear,
  onClose,
}: RepurchaseModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section
        className={`offset-modal ${locked ? "readonly" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Recompra e compensações"
      >
        <div className="modal-head">
          <div>
            <Badge tone="eyebrow">RECOMPRA E COMPENSAÇÕES</Badge>
            <h2>{locked ? "Consultar recompra do borderô" : "Compor recompra do borderô"}</h2>
            <p>
              {cedent} ·{" "}
              {locked
                ? "condição salva em modo de consulta. Use Editar condição para fazer alterações."
                : "selecione os títulos da recompra e demais compensações financeiras."}
            </p>
          </div>
          <button aria-label="Fechar recompra e compensações" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="offset-modal-summary">
          <div>
            <span>LÍQUIDO COMERCIAL</span>
            <strong>{preciseMoney.format(commercialNet)}</strong>
          </div>
          <div>
            <span>EFEITO NO LÍQUIDO</span>
            <strong className={offsetEffectTone(totalOffsets)}>{formatFlowMoney(-totalOffsets)}</strong>
            <small>
              {totalOffsets > 0
                ? "Recompra e débitos superam os créditos"
                : totalOffsets < 0
                  ? "Créditos superam a recompra e os débitos"
                  : "Sem impacto financeiro selecionado"}
            </small>
          </div>
          <div>
            <span>LÍQUIDO DO BORDERÔ</span>
            <strong className={netAfterRepurchase > 0 ? "positive" : "negative"}>
              {preciseMoney.format(netAfterRepurchase)}
            </strong>
          </div>
        </div>
        <OffsetInsights
          selectedCount={selectedCount}
          repurchase={repurchase}
          settlementAdjustments={settlementAdjustments}
        />
        <fieldset className="offset-modal-controls" disabled={locked}>
          <OffsetFilterPanel filters={filters} onFiltersChange={onFiltersChange} />
          <OffsetSelectionMemory
            selectedCount={selectedCount}
            groups={selectedOffsetMemory}
            totalOffsets={totalOffsets}
          />
          <RepurchaseOffsetGrid
            rows={filteredRows}
            availableCount={availableCount}
            onToggleTitle={onToggleTitle}
            onToggleAdjustment={onToggleAdjustment}
            onUpdateTerms={onUpdateTerms}
            onRestoreRate={onRestoreRate}
            onSelectVisibleOverdue={onSelectVisibleOverdue}
          />
        </fieldset>
        <div className="offset-modal-note">
          <AlertIcon />
          <span>
            {locked
              ? "Esta condição está salva e protegida. Você pode consultar a composição; para alterar a recompra, feche esta janela e use Editar condição."
              : "A taxa VP parte da aquisição original e pode ser ajustada. Correção/mora e multa incidem nos vencidos. O tratamento define se haverá recompra integral, recompra parcial, baixa bancária ou baixa somente no sistema. Créditos selecionados compensam a recompra e aumentam o líquido final."}
          </span>
        </div>
        <div className="modal-actions offset-modal-actions">
          {!locked && (
            <button type="button" className="secondary-action" onClick={onClear}>
              Limpar recompra
            </button>
          )}
          <button type="button" className="primary-action" onClick={onClose}>
            {locked ? "Fechar consulta" : `Aplicar ao borderô · ${formatFlowMoney(-totalOffsets)} no líquido`}
          </button>
        </div>
      </section>
    </div>
  );
}

type OffsetInsightsProps = {
  selectedCount: number;
  repurchase: RepurchaseResult;
  settlementAdjustments: SettlementAdjustmentResult;
};

/** Leitura automática da seleção: vencidos, itens do grupo e créditos. */
function OffsetInsights({ selectedCount, repurchase, settlementAdjustments }: OffsetInsightsProps) {
  const overdueCount = repurchase.selected.filter(row => row.overdue).length;
  const groupCount =
    repurchase.selected.filter(row => row.scope === "Grupo empresarial").length +
    settlementAdjustments.selected.filter(row => row.scope === "Grupo empresarial").length;
  return (
    <section className="offset-insights">
      <div>
        <span>INSIGHTS DA COMPOSIÇÃO</span>
        <strong>{selectedCount ? "Leitura automática da seleção" : "Selecione itens para receber insights"}</strong>
      </div>
      {selectedCount ? (
        <div className="offset-insight-list">
          <span>
            <b>{overdueCount}</b> recompra(s) vencida(s) na seleção
          </span>
          <span>
            <b>{groupCount}</b> item(ns) originado(s) do grupo empresarial
          </span>
          <span>
            <b>{preciseMoney.format(selectedCreditTotal(settlementAdjustments))}</b> em créditos compensando o líquido
          </span>
        </div>
      ) : (
        <small>
          Ao selecionar recompras, pendências ou créditos, o sistema destacará vencidos, itens do grupo e compensações.
        </small>
      )}
    </section>
  );
}

type OffsetFilterPanelProps = {
  filters: OffsetFilters;
  onFiltersChange: (changes: Partial<OffsetFilters>) => void;
};

function OffsetFilterPanel({ filters, onFiltersChange }: OffsetFilterPanelProps) {
  return (
    <section className="offset-filter-panel">
      <div className="offset-nature-filter">
        <span>NATUREZA</span>
        {(["Todos", "Débitos", "Créditos"] as const).map(nature => (
          <button
            type="button"
            className={filters.nature === nature ? "selected" : ""}
            key={nature}
            onClick={() => onFiltersChange({ nature })}
          >
            {nature === "Todos" ? "Débitos e créditos" : nature}
          </button>
        ))}
      </div>
      <label>
        <span>ORIGEM</span>
        <select
          aria-label="Filtrar origem da compensação"
          value={filters.source}
          onChange={event => onFiltersChange({ source: event.target.value as OffsetSourceFilter })}
        >
          <option>Todos</option>
          <option>Títulos</option>
          <option>Pendências</option>
          <option>Créditos</option>
        </select>
      </label>
      <label className="offset-group-toggle">
        <input
          type="checkbox"
          checked={filters.includeGroup}
          onChange={event => onFiltersChange({ includeGroup: event.target.checked })}
        />
        <span>
          <b>Incluir grupo empresarial</b>
          <small>Buscar também posições das empresas relacionadas</small>
        </span>
      </label>
      <label className="offset-search">
        <span>BUSCAR</span>
        <div>
          <SearchIcon />
          <input
            aria-label="Buscar itens para compensação"
            value={filters.search}
            placeholder="Título, sacado, referência ou descrição"
            onChange={event => onFiltersChange({ search: event.target.value })}
          />
        </div>
      </label>
    </section>
  );
}

type OffsetSelectionMemoryProps = {
  selectedCount: number;
  groups: OffsetMemoryGroup[];
  totalOffsets: number;
};

/** Itens reservados agrupados por origem; a seleção persiste ao trocar filtros. */
function OffsetSelectionMemory({ selectedCount, groups, totalOffsets }: OffsetSelectionMemoryProps) {
  return (
    <section className="offset-selection-memory">
      <div className="offset-memory-head">
        <div>
          <span>MEMÓRIA DA SELEÇÃO</span>
          <strong>{selectedCount} item(ns) reservado(s)</strong>
        </div>
        <small>A seleção permanece salva ao alterar os filtros.</small>
      </div>
      {groups.length ? (
        <div className="offset-memory-groups">
          {groups.map(group => (
            <div key={group.label}>
              <span>{group.label}</span>
              <strong>{group.rows.length}</strong>
              <small>
                Face/original <b>{preciseMoney.format(group.face)}</b>
              </small>
              <small>
                Efeito no líquido{" "}
                <b className={group.impact >= 0 ? "positive" : "negative"}>{formatFlowMoney(group.impact)}</b>
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="offset-memory-empty">Nenhum item selecionado.</div>
      )}
      <div className="offset-memory-total">
        <span>EFEITO TOTAL NO LÍQUIDO</span>
        <b>{selectedCount} item(ns)</b>
        <strong className={offsetEffectTone(totalOffsets)}>{formatFlowMoney(-totalOffsets)}</strong>
      </div>
    </section>
  );
}
