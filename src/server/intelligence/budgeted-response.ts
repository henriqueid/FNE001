/** Orquestra chamadas com reserva conservadora antes de acessar o provedor. */
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { createOpenAIResponse, openAIConfiguration } from "./openai-gateway";
import { loadIntelligenceState, reserveIntelligenceTokens } from "./repository";

export async function createBudgetedOpenAIResponse(
  db: DecisionDatabase,
  tenantId: string,
  input: string,
  instructions: string,
  options: { actorId: string; maxOutputTokens?: number; timeoutMs?: number; fetcher?: typeof fetch },
) {
  if (!openAIConfiguration().configured) throw new Error("OPENAI_API_KEY não foi configurada no servidor.");
  const maxOutputTokens = options.maxOutputTokens ?? 700;
  // Bytes UTF-8 limitam conservadoramente os tokens de texto; margem para enquadramento do provedor.
  const reservedTokens = new TextEncoder().encode(input + instructions).length + maxOutputTokens + 2048;
  const reservation = await reserveIntelligenceTokens(db, tenantId, reservedTokens, options.actorId);
  const result = await createOpenAIResponse(input, instructions, { ...options, maxOutputTokens });
  const { inputTokens, outputTokens, totalTokens } = result.usage;
  const counts = [inputTokens, outputTokens, totalTokens];
  const actualTokens = counts.every(value => Number.isSafeInteger(value) && value >= 0)
    ? Math.max(totalTokens, inputTokens + outputTokens)
    : 0;
  await reservation.settle(actualTokens);
  const state = await loadIntelligenceState(db, tenantId, options.actorId);
  return { ...result, usedTokens: state?.usedTokens };
}
