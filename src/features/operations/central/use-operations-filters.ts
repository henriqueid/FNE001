/**
 * Estado de fila, visualização, período e filtros da central de operações,
 * com as listas derivadas (empresa → período → filtros de tela → fila).
 */
import { type Operation } from "@/src/domain/core/types";
import { localDateISO, operationDateISO, releaseDateISO } from "@/src/domain/operations/dates";
import { useMemo, useState } from "react";
import {
  type DatePreset,
  type DisplayMode,
  inQueue,
  matchesScreenFilters,
  type QueueScope,
  type ScreenFilters,
} from "./central-model";

export function useOperationsFilters(operations: Operation[], companyScope: string) {
  const [scope, setScope] = useState<QueueScope>("active");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sourceFilter, setSourceFilter] = useState("Todas");
  const today = localDateISO();
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const companyOperations = useMemo(
    () => (companyScope === "Consolidado" ? operations : operations.filter(op => op.vehicle === companyScope)),
    [operations, companyScope],
  );
  const scopedOperations = useMemo(
    () =>
      companyOperations.filter(op => {
        if (datePreset === "all") return true;
        const operationDate = operationDateISO(op);
        const releasedDate = releaseDateISO(op);
        return (
          (operationDate >= dateFrom && operationDate <= dateTo) ||
          (Boolean(releasedDate) && releasedDate! >= dateFrom && releasedDate! <= dateTo)
        );
      }),
    [companyOperations, datePreset, dateFrom, dateTo],
  );
  const screenOperations = useMemo(
    () => scopedOperations.filter(op => matchesScreenFilters(op, { query, stageFilter, statusFilter, sourceFilter })),
    [scopedOperations, query, stageFilter, statusFilter, sourceFilter],
  );
  const filtered = useMemo(() => screenOperations.filter(op => inQueue(op, scope)), [screenOperations, scope]);
  const screenFilters: ScreenFilters = { query, stageFilter, statusFilter, sourceFilter };

  const rangeLabel = `${new Date(`${dateFrom}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${dateTo}T12:00:00`).toLocaleDateString("pt-BR")}`;
  const periodLabel = datePreset === "today" ? "Hoje" : datePreset === "all" ? "Todo o histórico" : rangeLabel;
  const activeFilterCount = [
    stageFilter !== "Todas",
    statusFilter !== "Todos",
    sourceFilter !== "Todas",
    Boolean(query.trim()),
  ].filter(Boolean).length;
  const filterContext = [
    companyScope === "Consolidado" ? "Consolidado" : companyScope,
    periodLabel,
    activeFilterCount ? `${activeFilterCount} filtro(s) aplicado(s)` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const selectQueue = (next: QueueScope) => {
    setScope(next);
    if (next !== "active") setDisplayMode("list");
  };
  const selectToday = () => {
    setDatePreset("today");
    setDateFrom(today);
    setDateTo(today);
  };
  const changeDateFrom = (next: string) => {
    setDateFrom(next);
    if (next > dateTo) setDateTo(next);
    setDatePreset("custom");
  };
  const changeDateTo = (next: string) => {
    setDateTo(next);
    setDatePreset("custom");
  };
  const clearFilters = () => {
    setDatePreset("today");
    setDateFrom(today);
    setDateTo(today);
    setStageFilter("Todas");
    setStatusFilter("Todos");
    setSourceFilter("Todas");
    setQuery("");
  };

  return {
    scope,
    selectQueue,
    displayMode,
    setDisplayMode,
    query,
    setQuery,
    showFilters,
    setShowFilters,
    stageFilter,
    setStageFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    datePreset,
    setDatePreset,
    dateFrom,
    dateTo,
    selectToday,
    changeDateFrom,
    changeDateTo,
    clearFilters,
    scopedOperations,
    screenOperations,
    filtered,
    screenFilters,
    rangeLabel,
    filterContext,
  };
}
