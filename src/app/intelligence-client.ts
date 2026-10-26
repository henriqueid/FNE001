import { type DeskReply } from "@/src/domain/copilot/desk-assistant";
import { type SystemKnowledge } from "@/src/domain/copilot/system-query";
import type { AIBudgetInput, AIBudgetSnapshot } from "@/src/domain/intelligence/budget";
import type { IntelligenceState } from "@/src/domain/intelligence/model";
import { getStratoTenantId } from "./tenant";
import type { CopilotReport } from "@/src/domain/copilot/report";
import type { BehaviorEvent, MemoryDraft } from "@/src/domain/copilot/behavior";

export type AIProviderConfiguration = {
  provider: "openai";
  configured: boolean;
  model: string;
  endpoint: string;
  keyHint?: string;
};

const headers = () => ({
  "content-type": "application/json",
  "x-strato-tenant-id": getStratoTenantId(),
});

async function bodyOf<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "A solicitação de IA não pôde ser concluída.");
  return body;
}

export async function loadAIConfiguration() {
  const response = await fetch("/api/intelligence/configuration", { cache: "no-store", headers: headers() });
  return (await bodyOf<{ configuration: AIProviderConfiguration }>(response)).configuration;
}

export async function testAIConfiguration() {
  const response = await fetch("/api/intelligence/configuration", { method: "POST", headers: headers(), body: "{}" });
  return bodyOf<{
    configuration: AIProviderConfiguration;
    test: { ok: boolean; model: string; usage: { totalTokens: number } };
  }>(response);
}

export async function loadIntelligenceState() {
  const response = await fetch("/api/intelligence/state", { cache: "no-store", headers: headers() });
  return (await bodyOf<{ state: IntelligenceState }>(response)).state;
}

export async function persistIntelligenceState(state: IntelligenceState) {
  const response = await fetch("/api/intelligence/state", {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ state }),
  });
  return (await bodyOf<{ state: IntelligenceState }>(response)).state;
}

export async function askConfiguredCopilot(
  question: string,
  _knowledge?: SystemKnowledge,
  options: {
    allowInterpretation?: boolean;
    previousReportId?: string;
    refreshReportId?: string;
    filters?: { company?: string; document?: string };
  } = {},
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 80_000);
  try {
    const response = await fetch("/api/copilot/chat", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ question, ...options }),
      signal: controller.signal,
    });
    return await bodyOf<{
      reply: DeskReply;
      requestId?: string;
      usedTokens?: number;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    }>(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("A resposta demorou mais que o esperado. Tente novamente em instantes.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadCopilotReport(id: string) {
  return (
    await bodyOf<{ report: CopilotReport }>(
      await fetch(`/api/copilot/reports?id=${encodeURIComponent(id)}`, { cache: "no-store", headers: headers() }),
    )
  ).report;
}
export async function loadCopilotHistory() {
  return (
    await bodyOf<{ history: { question: string; reply: DeskReply }[] }>(
      await fetch("/api/copilot/reports", { cache: "no-store", headers: headers() }),
    )
  ).history;
}
export async function saveCopilotMemory(draft: MemoryDraft) {
  return bodyOf<{ event: BehaviorEvent }>(
    await fetch("/api/copilot/memory", { method: "POST", headers: headers(), body: JSON.stringify(draft) }),
  );
}
export async function loadCopilotMemories() {
  return (
    await bodyOf<{ events: BehaviorEvent[] }>(
      await fetch("/api/copilot/memory", { headers: headers(), cache: "no-store" }),
    )
  ).events;
}
export async function reviewCopilotMemory(id: string, status: "validated" | "rejected" | "revoked", rationale: string) {
  return bodyOf<{ ok: true }>(
    await fetch("/api/copilot/memory", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id, status, rationale }),
    }),
  );
}

export async function loadAIBudget() {
  const response = await fetch("/api/intelligence/budget", { cache: "no-store", headers: headers() });
  return (await bodyOf<{ budget: AIBudgetSnapshot }>(response)).budget;
}
export async function saveAIBudget(input: AIBudgetInput) {
  const response = await fetch("/api/intelligence/budget", {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(input),
  });
  return (await bodyOf<{ budget: AIBudgetSnapshot }>(response)).budget;
}
