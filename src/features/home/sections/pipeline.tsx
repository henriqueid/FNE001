"use client";
/**
 * Esteira de operações: contagem e volume por etapa, liberadas e a operação mais distante do padrão.
 */
import { type Operation } from "@/src/domain/core/types";
import { isActive, isReleased, stageName } from "@/src/domain/home/metrics";
import { AlertIcon, ArrowIcon, CheckIcon, ClockIcon } from "@/src/ui/icons";
import { compact, duration } from "@/src/features/home/widgets";

export function Pipeline({ operations, onOpen }: { operations: Operation[]; onOpen: (op: Operation) => void }) {
  const active = operations.filter(isActive);
  const released = operations.filter(isReleased);
  const total = active.reduce((s, op) => s + op.amount, 0) || 1;
  const furthest = [...active]
    .filter(op => op.clientAverageMinutes > 0)
    .sort((a, b) => b.elapsedMinutes - b.clientAverageMinutes - (a.elapsedMinutes - a.clientAverageMinutes))[0];
  return (
    <>
      <div className="vg-pipeline">
        {[1, 2, 3, 4, 5, 6].map(stage => {
          const ops = active.filter(op => op.stage === stage);
          const amount = ops.reduce((s, op) => s + op.amount, 0);
          const blocked = ops.filter(op => op.blockers > 0).length;
          return (
            <div key={stage} className={`vg-stage ${ops.length ? "" : "empty"} ${blocked ? "blocked" : ""}`}>
              <span className="vg-stage-name">
                <em>{stage}</em>
                {stageName(stage)}
              </span>
              <strong>{ops.length}</strong>
              <small>{amount ? compact(amount) : "—"}</small>
              <div className="vg-track">
                <i style={{ width: `${ops.length ? Math.max(6, (amount / total) * 100) : 0}%` }} />
              </div>
              {blocked > 0 ? (
                <span className="vg-stage-flag bad">
                  <AlertIcon /> {blocked} bloqueada{blocked > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="vg-stage-flag">{ops.length ? "fluindo" : "vazia"}</span>
              )}
            </div>
          );
        })}
        <div className={`vg-stage released ${released.length ? "" : "empty"}`}>
          <span className="vg-stage-name">
            <em>
              <CheckIcon />
            </em>
            Liberadas
          </span>
          <strong>{released.length}</strong>
          <small>{released.length ? compact(released.reduce((s, op) => s + op.amount, 0)) : "—"}</small>
          <div className="vg-track">
            <i style={{ width: released.length ? "100%" : "0%" }} />
          </div>
          <span className="vg-stage-flag">no financeiro</span>
        </div>
      </div>
      {furthest && (
        <button className="vg-callout" onClick={() => onOpen(furthest)}>
          <ClockIcon />
          <span>
            Mais distante do padrão: <b>{furthest.cedent}</b> em {stageName(furthest.stage)} há{" "}
            {duration(furthest.elapsedMinutes)} (padrão do cliente {duration(furthest.clientAverageMinutes)})
          </span>
          <ArrowIcon />
        </button>
      )}
    </>
  );
}
