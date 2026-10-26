/** Atribui fatos comerciais novos à sessão e ao relógio do servidor. */
import type { CommercialState } from "@/src/domain/commercial/types";

export function attributeCommercialHistory(
  previous: CommercialState | null,
  next: CommercialState,
  actorName: string,
  at = new Date().toISOString(),
): CommercialState {
  const attributed = <T extends { at: string; by: string }>(history: T[] = [], length = 0) =>
    history.map((event, index) => (index < length ? event : { ...event, at, by: actorName }));
  return {
    ...next,
    committees: next.committees.map(committee => {
      const prior = previous?.committees.find(item => item.id === committee.id);
      const decided = committee.status !== "Em pauta" && (!prior || prior.status === "Em pauta");
      return {
        ...committee,
        ...(decided ? { decidedBy: actorName, decidedAt: at.slice(0, 10) } : {}),
        history: attributed(committee.history, prior?.history.length),
      };
    }),
    prospects: next.prospects.map(prospect => ({
      ...prospect,
      history: attributed(prospect.history, previous?.prospects.find(item => item.id === prospect.id)?.history?.length),
    })),
  };
}
