/** Regressões do orçamento autoritativo de IA, sem banco ou provedor reais. */
import { describe, expect, it } from "vitest";
import { reserveIntelligenceTokens, saveIntelligenceState } from "@/src/server/intelligence/repository";
import { seedIntelligenceState } from "@/src/domain/intelligence/model";
import { IntelligenceDatabase } from "./helpers/intelligence-database";

function database(options: { contracted?: boolean; enabled?: boolean; budget?: number; used?: number } = {}) {
  const db = new IntelligenceDatabase();
  Object.assign(db.row, {
    contracted: options.contracted ?? true,
    enabled: options.enabled ?? true,
    monthly_token_budget: options.budget ?? 100,
    used_tokens: options.used ?? 0,
  });
  return { db, row: db.row };
}

describe("consumo de IA controlado pelo servidor", () => {
  it.each([{ contracted: false }, { enabled: false }, { budget: 9 }])(
    "nega reserva sem licença, habilitação ou saldo: %j",
    async options => {
      const { db, row } = database(options);
      await expect(reserveIntelligenceTokens(db, "tenant-a", 10, "actor-a")).rejects.toThrow();
      expect(row.used_tokens).toBe(0);
    },
  );
  it("reserva atomicamente entre chamadas concorrentes e liquida uma única vez", async () => {
    const { db, row } = database({ budget: 100 });
    const results = await Promise.allSettled([
      reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a"),
      reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(row.used_tokens).toBe(70);
    const reservation = results.find(result => result.status === "fulfilled");
    if (reservation?.status !== "fulfilled") throw new Error("Reserva ausente");
    await Promise.all([reservation.value.settle(30), reservation.value.settle(30)]);
    expect(row.used_tokens).toBe(30);
  });
  it("não permite reserva em outra organização", async () => {
    const { db, row } = database();
    await expect(reserveIntelligenceTokens(db, "tenant-b", 10, "actor-a")).rejects.toThrow();
    expect(row.used_tokens).toBe(0);
  });
  it("preserva reserva quando uso é ausente ou inválido", async () => {
    const { db, row } = database();
    const reservation = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
    await reservation.settle(0);
    expect(row.used_tokens).toBe(70);
  });
  it("cliente não consegue apagar consumo já contabilizado", async () => {
    const { db, row } = database({ used: 80 });
    await saveIntelligenceState(db, "tenant-a", "actor", { ...seedIntelligenceState(), usedTokens: 0 });
    expect(row.used_tokens).toBe(80);
  });
});

import { afterEach, vi } from "vitest";
import { createBudgetedOpenAIResponse } from "@/src/server/intelligence/budgeted-response";
afterEach(() => vi.unstubAllEnvs());

describe("chamada do provedor protegida por orçamento", () => {
  it("não envia nenhuma requisição quando o tenant está desativado", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const { db } = database({ enabled: false, budget: 10000 });
    let requests = 0;
    const fetcher = (async () => {
      requests++;
      throw new Error("Não deve chamar");
    }) as typeof fetch;
    await expect(
      createBudgetedOpenAIResponse(db, "tenant-a", "oi", "responda", { fetcher, actorId: "actor-a" }),
    ).rejects.toThrow();
    expect(requests).toBe(0);
  });
  it("contabiliza uso real e impõe limite de saída na requisição", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const { db, row } = database({ budget: 10000 });
    const fetcher = (async (_url, init) => {
      expect(row.used_tokens).toBeGreaterThan(700);
      expect(JSON.parse(String(init?.body)).max_output_tokens).toBe(700);
      return Response.json({ output_text: "Resposta", usage: { total_tokens: 25 } });
    }) as typeof fetch;
    await createBudgetedOpenAIResponse(db, "tenant-a", "oi", "responda", { fetcher, actorId: "actor-a" });
    expect(row.used_tokens).toBe(25);
  });
  it("falha de transporte mantém reserva para não devolver custo incerto", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const { db, row } = database({ budget: 10000 });
    const fetcher = (async () => {
      throw new Error("timeout");
    }) as typeof fetch;
    await expect(
      createBudgetedOpenAIResponse(db, "tenant-a", "oi", "responda", { fetcher, actorId: "actor-a" }),
    ).rejects.toThrow("timeout");
    expect(row.used_tokens).toBe(2758);
  });
});

describe("integridade do uso retornado pelo provedor", () => {
  it("não reduz consumo quando total diverge dos tokens de entrada e saída", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const { db, row } = database({ budget: 10000 });
    const fetcher = (async () =>
      Response.json({
        output_text: "Resposta",
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 1 },
      })) as typeof fetch;
    await createBudgetedOpenAIResponse(db, "tenant-a", "oi", "responda", { fetcher, actorId: "actor-a" });
    expect(row.used_tokens).toBe(30);
  });
});
