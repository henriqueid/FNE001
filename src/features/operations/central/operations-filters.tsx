"use client";
/**
 * Barra da lista (título da fila, período rápido, Lista/Kanban, busca e botão
 * de filtros) e o painel de filtros operacionais (datas, etapa, status, origem).
 */
import { stages } from "@/src/domain/core/stages";
import { statusClass } from "@/src/features/operations/components/status";
import { sourceOptions } from "@/src/features/operations/new-operation/new-operation-modal";
import { ActivityIcon, GridIcon, SearchIcon, SlidersIcon } from "@/src/ui/icons";
import { type DatePreset, type DisplayMode, type QueueScope } from "./central-model";

export function OperationsToolbar({
  scope,
  displayMode,
  onDisplayModeChange,
  datePreset,
  rangeLabel,
  onSelectToday,
  onSelectHistory,
  query,
  onQueryChange,
  showFilters,
  onToggleFilters,
}: {
  scope: QueueScope;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  datePreset: DatePreset;
  rangeLabel: string;
  onSelectToday: () => void;
  onSelectHistory: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}) {
  return (
    <div className="list-top">
      <div className="queue-heading">
        <strong>
          {displayMode === "kanban"
            ? "Fluxo operacional"
            : scope === "active"
              ? "Todas as operações ativas"
              : scope === "intervention"
                ? "Operações que precisam de ação"
                : scope === "formalization"
                  ? "Operações prontas para envio"
                  : scope === "released"
                    ? "Operações liberadas ao financeiro"
                    : "Operações canceladas"}
        </strong>
        <span>
          {datePreset === "today"
            ? "Operações de hoje · altere o período nos filtros para consultar o histórico"
            : datePreset === "all"
              ? "Todo o histórico operacional"
              : `Período de ${rangeLabel}`}
        </span>
      </div>
      <div className="list-actions">
        <div className="date-quick-filter">
          <button className={datePreset === "today" ? "active" : ""} onClick={onSelectToday}>
            Hoje
          </button>
          <button className={datePreset === "all" ? "active" : ""} onClick={onSelectHistory}>
            Histórico
          </button>
        </div>
        {scope === "active" && (
          <div className="view-switch" aria-label="Alternar visualização">
            <button className={displayMode === "list" ? "active" : ""} onClick={() => onDisplayModeChange("list")}>
              <ActivityIcon /> Lista
            </button>
            <button className={displayMode === "kanban" ? "active" : ""} onClick={() => onDisplayModeChange("kanban")}>
              <GridIcon /> Kanban
            </button>
          </div>
        )}
        <label className="compact-search">
          <SearchIcon />
          <input
            aria-label="Buscar em todos os dados da operação"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Aditivo, borderô, cedente, CNPJ..."
          />
        </label>
        <button
          className={`icon-button ${showFilters ? "active" : ""}`}
          aria-label="Filtros operacionais"
          onClick={onToggleFilters}
        >
          <SlidersIcon />
        </button>
      </div>
    </div>
  );
}

export function OperationsFilterPanel({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  stageFilter,
  onStageFilterChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  stageFilter: string;
  onStageFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="operational-filters">
      <label>
        <span>DATA INICIAL</span>
        <input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} />
      </label>
      <label>
        <span>DATA FINAL</span>
        <input type="date" value={dateTo} min={dateFrom} onChange={e => onDateToChange(e.target.value)} />
      </label>
      <label>
        <span>ETAPA</span>
        <select value={stageFilter} onChange={e => onStageFilterChange(e.target.value)}>
          <option>Todas</option>
          {stages.map(stage => (
            <option value={String(stage.id)} key={stage.id}>
              {stage.id}. {stage.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>STATUS</span>
        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)}>
          <option>Todos</option>
          {Object.keys(statusClass).map(status => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label>
        <span>ORIGEM</span>
        <select value={sourceFilter} onChange={e => onSourceFilterChange(e.target.value)}>
          <option>Todas</option>
          {sourceOptions.map(option => (
            <option value={option.source} key={option.source}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button onClick={onClear}>Limpar filtros</button>
    </div>
  );
}
