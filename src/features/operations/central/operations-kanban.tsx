"use client";
/**
 * Visualização kanban da central: colunas do fluxo operacional com contagem,
 * valor e cartões filtrados pelos filtros de tela.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { paceFor } from "@/src/domain/operations/pace";
import { StatusBadge } from "@/src/features/operations/components/status";
import { ClockIcon } from "@/src/ui/icons";
import { type KanbanColumn, matchesScreenFilters, type ScreenFilters } from "./central-model";

export function OperationsKanban({
  columns,
  filters,
  onOpen,
}: {
  columns: KanbanColumn[];
  filters: ScreenFilters;
  onOpen: (op: Operation) => void;
}) {
  return (
    <div className="operations-kanban">
      {columns.map(column => {
        const visible = column.operations.filter(op => matchesScreenFilters(op, filters));
        const columnValue = visible.reduce((sum, op) => sum + op.amount, 0);
        return (
          <section className={`kanban-column ${column.tone}`} key={column.id}>
            <header>
              <div>
                <span>{column.title}</span>
                <small>{column.description}</small>
              </div>
              <b>{visible.length}</b>
              <strong>{money.format(columnValue)}</strong>
            </header>
            <div className="kanban-stack">
              {visible.map(op => (
                <KanbanCard key={op.id} op={op} onOpen={onOpen} />
              ))}
              {visible.length === 0 && (
                <div className="kanban-empty">
                  <span>Nenhuma operação</span>
                  <small>Nesta fila e com os filtros atuais</small>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({ op, onOpen }: { op: Operation; onOpen: (op: Operation) => void }) {
  const pace = paceFor(op);
  return (
    <button className="kanban-card" onClick={() => onOpen(op)}>
      <div className="kanban-card-top">
        <span>Aditivo {op.aditivoNumber}</span>
        <StatusBadge status={op.status} />
      </div>
      <strong>{op.cedent}</strong>
      <small>
        Borderô {op.borderoNumber} · {op.titleCount} títulos
      </small>
      <div className="kanban-card-stage">
        <span>
          {stages[op.stage - 1].short} · {op.stage}/6
        </span>
        <b>{money.format(op.amount)}</b>
      </div>
      <div className="mini-progress">
        <i style={{ width: `${(op.stage / 6) * 100}%` }} />
      </div>
      <div className="kanban-card-action">
        <span>
          <i>{op.ownerInitials}</i>
          <b>{op.owner}</b>
        </span>
        <small>{op.nextAction}</small>
      </div>
      <div className={`kanban-card-sla pace-${pace.tone}`}>
        <ClockIcon />
        <span>
          <b>{op.waitingFor}</b>
          <small>{pace.label}</small>
        </span>
      </div>
    </button>
  );
}
