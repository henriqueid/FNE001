"use client";

/**
 * Alertas operacionais do sino: bloqueios, liberações pendentes e ritmo fora do padrão.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
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
  items,
  onClose,
  onInspect,
  onSeeAll,
}: {
  items: AttentionItem[];
  onClose: () => void;
  onInspect: (item: AttentionItem) => void;
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
    <div className="sx-popover" ref={ref} role="dialog" aria-label="Central de notificações">
      <header>
        <strong>Central de notificações</strong>
        <small>
          {items.length
            ? items.length === 1
              ? "1 tarefa pede atenção"
              : `${items.length} tarefas pedem atenção`
            : "Seu dia está em ordem"}
        </small>
      </header>
      {items.length ? (
        <ul>
          {items.slice(0, 6).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onInspect(item)}>
                <span className={`sx-signal ${item.tone}`}>
                  {item.tone === "critical" ? <AlertIcon /> : item.tone === "warning" ? <ClockIcon /> : <ArrowIcon />}
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.summary}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sx-empty">Nenhuma decisão, atraso, liberação ou cobrança pendente no seu escopo.</p>
      )}
      <footer>
        <button type="button" onClick={onSeeAll}>
          Abrir Central do Dia <ArrowIcon />
        </button>
      </footer>
    </div>
  );
}
