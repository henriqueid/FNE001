"use client";

/**
 * Alertas operacionais do sino: bloqueios, liberações pendentes e ritmo fora do padrão.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { AlertIcon, ArrowIcon, ClockIcon } from "@/src/ui/icons";
import { useEffect, useRef } from "react";

export function isOpen(operation: Operation) {
  return operation.status !== "Cancelada" && operation.status !== "Liberada ao financeiro";
}

export type Signal = {
  id: string;
  tone: "critical" | "warning" | "info";
  title: string;
  detail: string;
  operation: Operation;
};

export function operationSignals(operations: Operation[]): Signal[] {
  const signals: Signal[] = [];
  operations.filter(isOpen).forEach(operation => {
    const stage = stages.find(item => item.id === operation.stage)?.short ?? "";
    if (operation.blockers > 0)
      signals.push({
        id: `${operation.id}-b`,
        tone: "critical",
        title: `${operation.cedent}: ${operation.blockers} bloqueio(s)`,
        detail: `Aditivo ${operation.aditivoNumber} · ${stage} · ${money.format(operation.amount)}`,
        operation,
      });
    else if (operation.status === "Pronta para liberar")
      signals.push({
        id: `${operation.id}-l`,
        tone: "info",
        title: `Liberar ${operation.cedent}`,
        detail: `Aditivo ${operation.aditivoNumber} · líquido ${money.format(operation.netAmount)}`,
        operation,
      });
    else if (operation.clientAverageMinutes > 0 && operation.elapsedMinutes > operation.clientAverageMinutes * 1.5)
      signals.push({
        id: `${operation.id}-r`,
        tone: "warning",
        title: `${operation.cedent} acima do ritmo`,
        detail: `${stage} há ${Math.round(operation.elapsedMinutes / 60)}h · padrão ${Math.round(operation.clientAverageMinutes / 60)}h`,
        operation,
      });
  });
  const order = { critical: 0, warning: 1, info: 2 };
  return signals.sort((a, b) => order[a.tone] - order[b.tone]);
}

export function NotificationsPopover({
  signals,
  onClose,
  onOpen,
  onSeeAll,
}: {
  signals: Signal[];
  onClose: () => void;
  onOpen: (operation: Operation) => void;
  onSeeAll: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="sx-popover" ref={ref} role="dialog" aria-label="Alertas operacionais">
      <header>
        <strong>Alertas operacionais</strong>
        <small>{signals.length ? `${signals.length} item(ns) pedem atenção` : "Tudo em dia"}</small>
      </header>
      {signals.length ? (
        <ul>
          {signals.slice(0, 6).map(signal => (
            <li key={signal.id}>
              <button type="button" onClick={() => onOpen(signal.operation)}>
                <span className={`sx-signal ${signal.tone}`}>
                  {signal.tone === "critical" ? (
                    <AlertIcon />
                  ) : signal.tone === "warning" ? (
                    <ClockIcon />
                  ) : (
                    <ArrowIcon />
                  )}
                </span>
                <span>
                  <b>{signal.title}</b>
                  <small>{signal.detail}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sx-empty">Nenhuma operação com bloqueio, liberação pendente ou ritmo fora do padrão.</p>
      )}
      <footer>
        <button type="button" onClick={onSeeAll}>
          Abrir Central de Operações <ArrowIcon />
        </button>
      </footer>
    </div>
  );
}
