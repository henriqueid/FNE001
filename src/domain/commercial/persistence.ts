import { funnelStages, type CommercialState } from "./types";

export function validateCommercialState(state: CommercialState): string | null {
  if (state.version !== 1) return "Versão do Comercial inválida.";
  if (!Array.isArray(state.prospects) || !Array.isArray(state.committees) || !Array.isArray(state.links))
    return "Estrutura comercial inválida.";
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
  if (invalid || !previous) return invalid;
  for (const committee of previous.committees) {
    const candidate = next.committees.find(item => item.id === committee.id);
    if (!candidate) return "O histórico de comitês não pode ser apagado.";
    if ((candidate.history?.length ?? 0) < (committee.history?.length ?? 0))
      return "A trilha de decisão do comitê não pode ser reduzida.";
  }
  for (const prospect of previous.prospects) {
    const candidate = next.prospects.find(item => item.id === prospect.id);
    if (!candidate && !prospect.convertedAt) return "Leads só podem sair da esteira após conversão registrada.";
    if (candidate && (candidate.history?.length ?? 0) < (prospect.history?.length ?? 0))
      return "O histórico do lead não pode ser reduzido.";
  }
  return null;
}
