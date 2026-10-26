/** Política mensal de consumo: teto da organização e distribuição opcional por usuário. */
export type AIBudgetAllocation = { userId: string; monthlyTokenBudget: number };
export type AIBudgetPolicy = { mode: "shared" | "allocated"; allocations: AIBudgetAllocation[]; version: number };
export type AIBudgetInput = AIBudgetPolicy & { monthlyTokenBudget: number };
export type AIBudgetUser = { userId: string; name: string; status: string; usedTokens: number };
export type AIBudgetSnapshot = {
  policy: AIBudgetInput;
  period: string;
  usedTokens: number;
  users: AIBudgetUser[];
};

export function validateBudgetInput(value: unknown): { ok: true; input: AIBudgetInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Configuração de consumo inválida." };
  const input = value as Partial<AIBudgetInput>;
  if (
    !Number.isSafeInteger(input.monthlyTokenBudget) ||
    Number(input.monthlyTokenBudget) < 0 ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 0 ||
    !["shared", "allocated"].includes(String(input.mode)) ||
    !Array.isArray(input.allocations) ||
    input.allocations.length > 1000
  )
    return { ok: false, error: "Informe limites inteiros, positivos ou zero, e um modo de distribuição válido." };
  const ids = new Set<string>();
  let total = 0;
  for (const allocation of input.allocations) {
    if (
      !allocation ||
      typeof allocation.userId !== "string" ||
      !allocation.userId.trim() ||
      allocation.userId.length > 200 ||
      ids.has(allocation.userId) ||
      !Number.isSafeInteger(allocation.monthlyTokenBudget) ||
      allocation.monthlyTokenBudget < 0
    )
      return { ok: false, error: "Cotas inválidas ou usuário repetido na distribuição." };
    ids.add(allocation.userId);
    total += allocation.monthlyTokenBudget;
    if (!Number.isSafeInteger(total)) return { ok: false, error: "A soma das cotas excede o limite permitido." };
  }
  if (input.mode === "allocated" && total > Number(input.monthlyTokenBudget))
    return { ok: false, error: "A soma das cotas não pode ultrapassar o limite geral." };
  return {
    ok: true,
    input: {
      monthlyTokenBudget: Number(input.monthlyTokenBudget),
      mode: input.mode as AIBudgetPolicy["mode"],
      version: Number(input.version),
      allocations:
        input.mode === "allocated"
          ? input.allocations.map(item => ({ userId: item.userId, monthlyTokenBudget: item.monthlyTokenBudget }))
          : [],
    },
  };
}

export function distributeBudgetEqually(total: number, userIds: string[]): AIBudgetAllocation[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Limite geral inválido.");
  const ids = [...new Set(userIds)].sort();
  if (!ids.length) return [];
  const each = Math.floor(total / ids.length),
    remainder = total % ids.length;
  return ids.map((userId, index) => ({ userId, monthlyTokenBudget: each + (index < remainder ? 1 : 0) }));
}
