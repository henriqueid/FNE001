export type AIStatus = "AI_DISABLED" | "AI_AVAILABLE" | "AI_DEGRADED" | "AI_UNAVAILABLE" | "AI_PROCESSING";

export type IntelligenceState = {
  version: 1;
  tenantId: string;
  contracted: boolean;
  enabled: boolean;
  status: AIStatus;
  monthlyTokenBudget: number;
  usedTokens: number;
  persistenceVersion?: number;
  updatedAt: string;
};

export const seedIntelligenceState = (): IntelligenceState => ({
  version: 1,
  tenantId: "strato-demo",
  contracted: true,
  enabled: true,
  status: "AI_AVAILABLE",
  monthlyTokenBudget: 1_000_000,
  usedTokens: 0,
  updatedAt: new Date().toISOString(),
});

/** Estado inicial de uma organização real antes de contratar e configurar IA. */
export const emptyIntelligenceState = (tenantId = "strato-demo"): IntelligenceState => ({
  version: 1,
  tenantId,
  contracted: false,
  enabled: false,
  status: "AI_DISABLED",
  monthlyTokenBudget: 0,
  usedTokens: 0,
  updatedAt: new Date().toISOString(),
});

export function migrateIntelligenceState(value: unknown): IntelligenceState {
  const seed = seedIntelligenceState();
  if (!value || typeof value !== "object") return seed;
  const state = value as Partial<IntelligenceState>;
  if (state.version !== 1) return seed;
  return { ...seed, ...state };
}

export function validateIntelligenceState(
  value: unknown,
  tenantId: string,
): { ok: true; state: IntelligenceState } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Configuração de IA inválida." };
  const candidate = value as Partial<IntelligenceState>;
  const statuses: AIStatus[] = ["AI_DISABLED", "AI_AVAILABLE", "AI_DEGRADED", "AI_UNAVAILABLE", "AI_PROCESSING"];
  if (
    candidate.version !== 1 ||
    typeof candidate.contracted !== "boolean" ||
    typeof candidate.enabled !== "boolean" ||
    !candidate.status ||
    !statuses.includes(candidate.status) ||
    !Number.isSafeInteger(candidate.monthlyTokenBudget) ||
    Number(candidate.monthlyTokenBudget) < 0 ||
    !Number.isSafeInteger(candidate.usedTokens) ||
    Number(candidate.usedTokens) < 0
  )
    return { ok: false, error: "Configuração de IA inválida." };
  if (!candidate.contracted && candidate.enabled)
    return { ok: false, error: "O Copiloto não pode ser ativado sem uma licença de IA." };
  const enabled = candidate.contracted && candidate.enabled;
  return {
    ok: true,
    state: {
      version: 1,
      tenantId,
      contracted: candidate.contracted,
      enabled,
      status: enabled ? candidate.status : "AI_DISABLED",
      monthlyTokenBudget: Number(candidate.monthlyTokenBudget),
      usedTokens: Number(candidate.usedTokens),
      persistenceVersion: candidate.persistenceVersion,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function effectiveAIStatus(state: IntelligenceState): AIStatus {
  if (!state.contracted || !state.enabled) return "AI_DISABLED";
  if (state.usedTokens >= state.monthlyTokenBudget) return "AI_UNAVAILABLE";
  return state.status;
}

export function canUseGenerativeAI(state: IntelligenceState) {
  return effectiveAIStatus(state) === "AI_AVAILABLE";
}

export function aiStatusLabel(state: IntelligenceState) {
  const status = effectiveAIStatus(state);
  if (status === "AI_DISABLED") return "IA desativada para esta organização";
  if (status === "AI_AVAILABLE") return "IA disponível";
  if (status === "AI_DEGRADED") return "IA com capacidade reduzida";
  if (status === "AI_PROCESSING") return "IA processando";
  return "IA indisponível · motor determinístico ativo";
}
