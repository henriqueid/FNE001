"use client";
/**
 * Alertas de risco: regras de limite, atraso, concentração e score já filtradas pelo perfil.
 */
import { type Operation } from "@/src/domain/core/types";
import type { HomeProfile } from "@/src/domain/home/settings";
import { Empty, type Severity } from "@/src/features/home/widgets";

export type Alert = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  profiles: HomeProfile[];
  action: string;
  op?: Operation;
};

export function Alerts({
  list,
  onOpen,
  onGoOperations,
}: {
  list: Alert[];
  onOpen: (op: Operation) => void;
  onGoOperations: () => void;
}) {
  if (!list.length) return <Empty>Nenhum alerta de risco nas regras monitoradas.</Empty>;
  return (
    <ul className="vg-alerts">
      {list.slice(0, 6).map(a => (
        <li key={a.id} className={`sev-${a.severity}`}>
          <div>
            <strong>{a.title}</strong>
            <small>{a.detail}</small>
          </div>
          <button className="vg-btn" onClick={() => (a.op ? onOpen(a.op) : onGoOperations())}>
            {a.action}
          </button>
        </li>
      ))}
    </ul>
  );
}
