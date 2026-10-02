"use client";
/**
 * Resumo da fila "Exceções por alçada": quantas operações e decisões aguardam cada alçada.
 * Clicar numa alçada filtra a lista abaixo; "Todas" volta à fila completa.
 */
import { type AuthorityQueueEntry } from "@/src/domain/eligibility/authority-queue";

export function AuthorityQueueBar({
  entries,
  selected,
  onSelect,
}: {
  entries: AuthorityQueueEntry[];
  selected: string;
  onSelect: (authority: string) => void;
}) {
  if (!entries.length)
    return (
      <div className="authority-queue-bar empty">
        <span>Nenhuma exceção aguardando alçada. Operações dentro da política seguem sem intervenção.</span>
      </div>
    );
  return (
    <div className="authority-queue-bar" role="group" aria-label="Filtrar por alçada">
      <button className={selected === "Todas" ? "active" : ""} onClick={() => onSelect("Todas")}>
        <strong>Todas as alçadas</strong>
        <small>{entries.reduce((sum, entry) => sum + entry.decisions, 0)} decisão(ões)</small>
      </button>
      {entries.map(entry => (
        <button
          key={entry.authority}
          className={selected === entry.authority ? "active" : ""}
          onClick={() => onSelect(entry.authority)}
        >
          <strong>{entry.authority}</strong>
          <small>
            {entry.operations} operação(ões) · {entry.decisions} decisão(ões)
          </small>
        </button>
      ))}
    </div>
  );
}
