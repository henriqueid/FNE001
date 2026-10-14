import { type DeskReply } from "@/src/domain/copilot/desk-assistant";
import { type SystemKnowledge } from "@/src/domain/copilot/system-query";
import { getStratoTenantId } from "./tenant";

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

export async function askConfiguredCopilot(question: string, _knowledge: SystemKnowledge) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 80_000);
  try {
    const response = await fetch("/api/copilot/chat", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
    return await bodyOf<{
      reply: DeskReply;
      requestId?: string;
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
