"use client";
/**
 * Visualização em lista da central: aviso de liberadas fora da fila ativa,
 * tabela de operações e estado vazio.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import { paceFor } from "@/src/domain/operations/pace";
import { Badge, StatusBadge } from "@/src/features/operations/components/status";
import { financeStatusFor } from "@/src/features/operations/release/released-summary";
import { ArrowIcon, CheckIcon, ClockIcon, SearchIcon, WalletIcon } from "@/src/ui/icons";
import { type DatePreset } from "./central-model";

export function OperationsTable({
  operations,
  releasedCount,
  showReleasedHint,
  datePreset,
  onOpen,
  onShowReleased,
  onShowHistory,
}: {
  operations: Operation[];
  releasedCount: number;
  showReleasedHint: boolean;
  datePreset: DatePreset;
  onOpen: (op: Operation) => void;
  onShowReleased: () => void;
  onShowHistory: () => void;
}) {
  return (
    <>
      {showReleasedHint && (
        <div className="released-hint">
          <WalletIcon />
          <span>
            <b>{releasedCount} operação(ões) liberada(s) ao financeiro</b> não aparecem em &quot;Todas em
            andamento&quot;.
          </span>
          <button onClick={onShowReleased}>Ver liberadas</button>
        </div>
      )}
      <div className="table-head">
        <span>OPERAÇÃO / CEDENTE</span>
        <span>VEÍCULO</span>
        <span>ETAPA ATUAL</span>
        <span>VALOR</span>
        <span>RESPONSÁVEL</span>
        <span>RITMO</span>
        <span />
      </div>
      <div className="operation-rows">
        {operations.map(op => (
          <OperationRow key={op.id} op={op} onOpen={onOpen} />
        ))}
      </div>
      {operations.length === 0 && (
        <div className="empty-state">
          <SearchIcon />
          <strong>Nenhuma operação encontrada</strong>
          <span>
            {datePreset === "today"
              ? "O filtro está em Hoje. As operações de outros dias aparecem no histórico."
              : "Ajuste os filtros para ver outros resultados."}
          </span>
          {datePreset === "today" && (
            <button className="empty-state-action" onClick={onShowHistory}>
              Ver todo o histórico
            </button>
          )}
        </div>
      )}
    </>
  );
}

function OperationRow({ op, onOpen }: { op: Operation; onOpen: (op: Operation) => void }) {
  const pace = paceFor(op);
  return (
    <button className="operation-row" onClick={() => onOpen(op)}>
      <span className="operation-identity">
        <span className="proposal-line">
          <strong>Aditivo {op.aditivoNumber}</strong>
          <StatusBadge status={op.status} />
        </span>
        <b>{op.cedent}</b>
        <small>
          Borderô {op.borderoNumber} · {op.document} · {op.titleCount} títulos
        </small>
      </span>
      <span className="vehicle-cell">
        <Badge tone={op.institution.toLowerCase()}>{op.institution}</Badge>
        <b>{op.vehicle}</b>
        {op.fundClass && <small>{op.fundClass}</small>}
      </span>
      {op.status === "Liberada ao financeiro" ? (
        <span className="stage-cell">
          <small>Financeiro</small>
          <Badge tone={financeStatusFor(op).tone}>{financeStatusFor(op).label}</Badge>
        </span>
      ) : (
        <span className="stage-cell">
          <small>{op.stage} de 6</small>
          <b>{stages[op.stage - 1].short}</b>
          <span className="mini-progress">
            <i style={{ width: `${(op.stage / 6) * 100}%` }} />
          </span>
        </span>
      )}
      <span className="amount-cell">
        <b>{money.format(op.amount)}</b>
        <small>{op.titleCount} recebíveis</small>
      </span>
      <span className="owner-cell">
        <i>{op.ownerInitials}</i>
        <span>
          <b>{op.owner}</b>
          <small>{op.nextAction}</small>
        </span>
      </span>
      {op.status === "Liberada ao financeiro" ? (
        <span className="sla-cell">
          <CheckIcon />
          <span>
            <b>Liberada</b>
            <small>{op.releaseReview?.releasedAt ?? ""}</small>
            <em>Pagamento {formatBrazilianDate(op.releaseReview?.paymentDate)}</em>
          </span>
        </span>
      ) : (
        <span className={`sla-cell pace-${pace.tone}`}>
          <ClockIcon />
          <span>
            <b>{op.waitingFor}</b>
            <small>{pace.label}</small>
            <em>{pace.detail}</em>
          </span>
        </span>
      )}
      <span className="row-arrow">
        <ArrowIcon />
      </span>
    </button>
  );
}
