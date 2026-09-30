"use client";
/**
 * Abas das filas da central (andamento, intervenção, formalização,
 * liberadas e canceladas) com a contagem de cada uma.
 */
import { ActivityIcon, AlertIcon, CheckIcon, CloseIcon, WalletIcon } from "@/src/ui/icons";
import type { ReactNode } from "react";
import { type QueueScope } from "./central-model";

export function QueueTabs({
  scope,
  onSelect,
  counts,
}: {
  scope: QueueScope;
  onSelect: (scope: QueueScope) => void;
  counts: Record<QueueScope, number>;
}) {
  const queues: { id: QueueScope; className: string; icon: ReactNode; title: string; hint: string }[] = [
    {
      id: "active",
      className: "active-queue",
      icon: <ActivityIcon />,
      title: "Todas em andamento",
      hint: "Nenhuma operação ativa fica fora da fila",
    },
    {
      id: "intervention",
      className: "intervention",
      icon: <AlertIcon />,
      title: "Intervenção necessária",
      hint: "Bloqueios, decisões ou ritmo fora do padrão",
    },
    {
      id: "formalization",
      className: "formalization",
      icon: <CheckIcon />,
      title: "Prontas para formalização",
      hint: "Processadas automaticamente e dentro da política",
    },
    {
      id: "released",
      className: "released",
      icon: <WalletIcon />,
      title: "Liberadas ao financeiro",
      hint: "Resumo e status do pagamento",
    },
    {
      id: "cancelled",
      className: "cancelled",
      icon: <CloseIcon />,
      title: "Canceladas",
      hint: "Memória preservada para novas importações",
    },
  ];
  return (
    <div className="queue-tabs">
      {queues.map(queue => (
        <button
          key={queue.id}
          className={`queue-tab ${queue.className} ${scope === queue.id ? "active" : ""}`}
          onClick={() => onSelect(queue.id)}
        >
          <span className="queue-icon">{queue.icon}</span>
          <span className="queue-copy">
            <strong>{queue.title}</strong>
            <small>{queue.hint}</small>
          </span>
          <b>{counts[queue.id]}</b>
        </button>
      ))}
    </div>
  );
}
