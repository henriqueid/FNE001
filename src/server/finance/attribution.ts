/** A autoria dos fatos novos é sempre a sessão do servidor; a trilha anterior permanece verificável. */
import type { FinanceState, HistoryEntry } from "@/src/domain/finance/model";

export function attributeFinanceChanges(
  previous: FinanceState | null,
  next: FinanceState,
  actorId: string,
  at = new Date().toISOString(),
): FinanceState {
  const priorTitles = new Map(previous?.titles.map(title => [title.id, title]) ?? []);
  const priorMovements = new Map(previous?.movements.map(movement => [movement.id, movement]) ?? []);
  const priorJournal = new Set(previous?.journal.map(entry => entry.id) ?? []);
  const priorStatement = new Set(previous?.statement.map(line => line.id) ?? []);
  const priorClosures = new Set(previous?.periodClosures?.map(closure => closure.id) ?? []);
  const attributeHistory = (oldHistory: HistoryEntry[], history: HistoryEntry[]) =>
    history.map((event, index) => (index < oldHistory.length ? event : { ...event, by: actorId, at }));
  return {
    ...next,
    titles: next.titles.map(title => ({
      ...title,
      history: attributeHistory(priorTitles.get(title.id)?.history ?? [], title.history),
    })),
    movements: next.movements.map(movement => ({
      ...movement,
      history: attributeHistory(priorMovements.get(movement.id)?.history ?? [], movement.history),
    })),
    journal: next.journal.map(entry =>
      priorJournal.has(entry.id) ? entry : { ...entry, createdBy: actorId, createdAt: at },
    ),
    statement: next.statement.map(line =>
      priorStatement.has(line.id) ? line : { ...line, importedBy: actorId, importedAt: at },
    ),
    periodClosures: next.periodClosures?.map(closure =>
      priorClosures.has(closure.id) ? closure : { ...closure, closedBy: actorId, closedAt: at },
    ),
  };
}
