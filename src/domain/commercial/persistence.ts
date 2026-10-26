import { funnelStages, type CommercialState } from "./types";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
};

export const sameCommercialValue = (left: unknown, right: unknown) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

const preservesHistory = (previous: unknown[] = [], next: unknown[] = []) =>
  next.length >= previous.length && previous.every((event, index) => sameCommercialValue(event, next[index]));

export function validateCommercialState(state: CommercialState): string | null {
  if (state.version !== 1) return "Versão do Comercial inválida.";
  if (!Array.isArray(state.prospects) || !Array.isArray(state.committees) || !Array.isArray(state.links))
    return "Estrutura comercial inválida.";
  const linkIds = new Set<string>();
  for (const link of state.links) {
    if (!link.id || linkIds.has(link.id)) return "Há vínculos duplicados ou sem identificação.";
    linkIds.add(link.id);
    if (!Number.isFinite(link.approvedLimit) || link.approvedLimit < 0)
      return "O limite do vínculo comercial é inválido.";
  }
  const prospectIds = new Set<string>();
  for (const prospect of state.prospects) {
    if (!prospect.id || prospectIds.has(prospect.id)) return "Há leads duplicados ou sem identificação.";
    prospectIds.add(prospect.id);
    if (!prospect.name.trim() || !funnelStages.includes(prospect.stage)) return "Lead comercial inválido.";
    if (prospect.potential < 0) return "O potencial do lead não pode ser negativo.";
    if (prospect.convertedAt && prospect.stage !== "Aprovado") return "Lead convertido precisa estar aprovado.";
    if (
      prospect.convertedAt &&
      !state.committees.some(
        committee =>
          committee.clientName === prospect.name &&
          (committee.status === "Aprovado" || committee.status === "Aprovado com ressalvas"),
      )
    )
      return "A conversão em cedente exige uma aprovação registrada pelo comitê.";
    if (
      prospect.rejectedAt &&
      !state.committees.some(committee => committee.clientName === prospect.name && committee.status === "Reprovado")
    )
      return "A reprovação do lead exige uma decisão registrada pelo comitê.";
  }
  const committeeIds = new Set<string>();
  for (const committee of state.committees) {
    if (!committee.id || committeeIds.has(committee.id)) return "Há comitês duplicados ou sem identificação.";
    committeeIds.add(committee.id);
    if (!committee.clientName.trim() || committee.requested < 0) return "Pedido de comitê inválido.";
  }
  return null;
}

export function validateCommercialTransition(previous: CommercialState | null, next: CommercialState): string | null {
  const invalid = validateCommercialState(next);
  if (invalid) return invalid;
  for (const committee of next.committees) {
    const prior = previous?.committees.find(item => item.id === committee.id);
    if (
      (committee.status === "Aprovado" || committee.status === "Aprovado com ressalvas") &&
      (!prior || prior.status === "Em pauta") &&
      !committee.riskOpinion?.trim()
    )
      return "Registre o parecer de risco para aprovar o comitê.";
  }
  if (!previous) return null;
  for (const committee of previous.committees) {
    const candidate = next.committees.find(item => item.id === committee.id);
    if (!candidate) return "O histórico de comitês não pode ser apagado.";
    if (!preservesHistory(committee.history, candidate.history))
      return "O histórico de decisão do comitê não pode ser alterado ou reduzido.";
    if (committee.status !== "Em pauta") {
      const { history: _oldHistory, ...oldDecision } = committee;
      const { history: _newHistory, ...newDecision } = candidate;
      if (!sameCommercialValue(oldDecision, newDecision))
        return "A decisão registrada do comitê não pode ser reescrita; registre nova pauta.";
    }
  }
  for (const prospect of previous.prospects) {
    const candidate = next.prospects.find(item => item.id === prospect.id);
    if (!candidate) return "O dossiê e histórico do lead não podem ser apagados, inclusive após conversão.";
    if (candidate && !preservesHistory(prospect.history, candidate.history))
      return "O histórico do lead não pode ser alterado ou reduzido.";
  }
  return null;
}
