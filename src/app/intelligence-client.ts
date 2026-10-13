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

function compactKnowledge(knowledge: SystemKnowledge) {
  return {
    referenceDate: knowledge.today,
    operations: knowledge.operations.map(operation => ({
      id: operation.id,
      cedent: operation.cedent,
      document: operation.document,
      amount: operation.amount,
      status: operation.status,
      stage: operation.stage,
      vehicle: operation.vehicle,
      institution: operation.institution,
      blockers: operation.blockers,
    })),
    cedents: knowledge.cedents.map(cedent => ({
      id: cedent.id,
      name: cedent.name,
      document: cedent.document,
      score: cedent.score,
      creditLimit: cedent.creditLimit,
      usedLimit: cedent.usedLimit,
      settlements: cedent.settlements,
      lateSettlements: cedent.lateSettlements,
      averageDelayDays: cedent.averageDelayDays,
      repurchases: cedent.repurchases,
    })),
    portfolio: knowledge.titles.map(title => ({
      debtor: title.debtorName,
      cedentDocument: title.ownerDocument,
      amount: title.amount,
      dueDate: title.dueDate,
      source: title.source,
      vehicle: title.vehicle,
    })),
    policies: knowledge.policies.map(policy => ({
      id: policy.id,
      name: policy.name,
      company: policy.company,
      status: policy.status,
      version: policy.version,
      bindings: policy.bindings,
    })),
  };
}

export async function askConfiguredCopilot(question: string, knowledge: SystemKnowledge) {
  const response = await fetch("/api/copilot/chat", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ question, context: compactKnowledge(knowledge) }),
  });
  return bodyOf<{
    reply: DeskReply;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  }>(response);
}
