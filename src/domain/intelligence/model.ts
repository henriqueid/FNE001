export type AIStatus = "AI_DISABLED" | "AI_AVAILABLE" | "AI_DEGRADED" | "AI_UNAVAILABLE" | "AI_PROCESSING";

export type IntelligenceState = {
  version: 1;
  tenantId: string;
  contracted: boolean;
  enabled: boolean;
  status: AIStatus;
  monthlyTokenBudget: number;
  usedTokens: number;
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

export function migrateIntelligenceState(value: unknown): IntelligenceState {
  const seed = seedIntelligenceState();
  if (!value || typeof value !== "object") return seed;
  const state = value as Partial<IntelligenceState>;
  if (state.version !== 1) return seed;
  return { ...seed, ...state };
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
