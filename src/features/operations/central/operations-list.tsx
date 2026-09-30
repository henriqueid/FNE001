"use client";
/**
 * Central de operações: compõe cabeçalho, indicadores, esteira, filas,
 * filtros e a visualização em lista ou kanban.
 */
import { type Operation } from "@/src/domain/core/types";
import { StagePipeline } from "@/src/features/operations/components/status";
import { Shell } from "@/src/features/shell/shell";
import { type AppView } from "@/src/features/shell/shell-context";
import { CentralHeader } from "./central-header";
import { CentralMetrics } from "./central-metrics";
import { centralMetricsFor, kanbanColumnsFor } from "./central-model";
import { OperationsFilterPanel, OperationsToolbar } from "./operations-filters";
import { OperationsKanban } from "./operations-kanban";
import { OperationsTable } from "./operations-table";
import { QueueTabs } from "./queue-tabs";
import { useOperationsFilters } from "./use-operations-filters";

export function OperationsList({
  operations,
  companyScope,
  onCompanyScopeChange,
  onOpen,
  onNew,
  onReset,
  onOpenSettings,
  onNavigate,
}: {
  operations: Operation[];
  companyScope: string;
  onCompanyScopeChange: (scope: string) => void;
  onOpen: (op: Operation) => void;
  onNew: () => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onNavigate?: (target: AppView) => void;
}) {
  const filters = useOperationsFilters(operations, companyScope);
  const { scope, displayMode, datePreset, filtered, scopedOperations, selectQueue } = filters;
  const metrics = centralMetricsFor(filters.screenOperations);
  const { inProgressOperations, releasedOperations } = metrics;
  const kanbanColumns = kanbanColumnsFor(inProgressOperations, releasedOperations);
  return (
    <Shell companyScope={companyScope} onOpenSettings={onOpenSettings} onNavigate={onNavigate}>
      <div className="page-wrap">
        <CentralHeader companyScope={companyScope} onCompanyScopeChange={onCompanyScopeChange} onNew={onNew} />
        <CentralMetrics metrics={metrics} filterContext={filters.filterContext} />
        <StagePipeline operations={inProgressOperations} />
        <section className="operations-card">
          <QueueTabs
            scope={scope}
            onSelect={selectQueue}
            counts={{
              active: inProgressOperations.length,
              intervention: metrics.interventionCount,
              formalization: metrics.formalizationCount,
              released: releasedOperations.length,
              cancelled: metrics.cancellationCount,
            }}
          />
          <OperationsToolbar
            scope={scope}
            displayMode={displayMode}
            onDisplayModeChange={filters.setDisplayMode}
            datePreset={datePreset}
            rangeLabel={filters.rangeLabel}
            onSelectToday={filters.selectToday}
            onSelectHistory={() => filters.setDatePreset("all")}
            query={filters.query}
            onQueryChange={filters.setQuery}
            showFilters={filters.showFilters}
            onToggleFilters={() => filters.setShowFilters(value => !value)}
          />
          {filters.showFilters && (
            <OperationsFilterPanel
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={filters.changeDateFrom}
              onDateToChange={filters.changeDateTo}
              stageFilter={filters.stageFilter}
              onStageFilterChange={filters.setStageFilter}
              statusFilter={filters.statusFilter}
              onStatusFilterChange={filters.setStatusFilter}
              sourceFilter={filters.sourceFilter}
              onSourceFilterChange={filters.setSourceFilter}
              onClear={filters.clearFilters}
            />
          )}
          {displayMode === "list" && (
            <OperationsTable
              operations={filtered}
              releasedCount={releasedOperations.length}
              showReleasedHint={scope === "active" && releasedOperations.length > 0}
              datePreset={datePreset}
              onOpen={onOpen}
              onShowReleased={() => selectQueue("released")}
              onShowHistory={() => filters.setDatePreset("all")}
            />
          )}
          {displayMode === "kanban" && (
            <OperationsKanban columns={kanbanColumns} filters={filters.screenFilters} onOpen={onOpen} />
          )}
          <div className="list-footer">
            <span>
              {displayMode === "kanban"
                ? `${inProgressOperations.length + releasedOperations.length} operações distribuídas no fluxo`
                : `Mostrando ${filtered.length} de ${scopedOperations.length} operações no período`}
            </span>
            <button onClick={onReset}>Restaurar dados de demonstração</button>
            <span>
              {datePreset === "today" ? "Hoje" : datePreset === "all" ? "Todo o histórico" : "Período personalizado"} ·
              atualizado agora
            </span>
          </div>
        </section>
      </div>
    </Shell>
  );
}
