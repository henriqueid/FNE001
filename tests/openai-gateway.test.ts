import { afterEach, describe, expect, it } from "vitest";
import {
  createOpenAIResponse,
  openAIConfiguration,
  testOpenAIConnection,
} from "@/src/server/intelligence/openai-gateway";

const previous = {
  key: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  baseUrl: process.env.OPENAI_BASE_URL,
};

afterEach(() => {
  if (previous.key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previous.key;
  if (previous.model === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = previous.model;
  if (previous.baseUrl === undefined) delete process.env.OPENAI_BASE_URL;
  else process.env.OPENAI_BASE_URL = previous.baseUrl;
});

describe("gateway OpenAI do Copiloto", () => {
  it("não expõe a chave e normaliza a configuração do servidor", () => {
    process.env.OPENAI_API_KEY = "sk-project-secret-1234";
    process.env.OPENAI_MODEL = "modelo-teste";
    process.env.OPENAI_BASE_URL = "https://gateway.example/v1/";

    expect(openAIConfiguration()).toEqual({
      provider: "openai",
      configured: true,
      model: "modelo-teste",
      endpoint: "https://gateway.example/v1",
      keyHint: "••••1234",
    });
  });

  it("envia pela Responses API sem armazenar a resposta e lê uso", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "modelo-teste";
    const fetcher: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      expect(init?.headers).toMatchObject({ authorization: "Bearer sk-test" });
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: "modelo-teste", store: false });
      return Response.json(
        {
          model: "modelo-teste",
          output: [{ type: "message", content: [{ type: "output_text", text: "Resposta segura" }] }],
          usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 },
        },
        { headers: { "x-request-id": "req-1" } },
      );
    };

    await expect(createOpenAIResponse("pergunta", "instruções", { fetcher })).resolves.toEqual({
      text: "Resposta segura",
      model: "modelo-teste",
      requestId: "req-1",
      usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
    });
  });

  it("faz um teste de conectividade curto", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetcher: typeof fetch = async () => Response.json({ output_text: "OK" });
    await expect(testOpenAIConnection(fetcher)).resolves.toMatchObject({ ok: true, text: "OK" });
  });

  it("falha de forma clara quando não há credencial", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(createOpenAIResponse("pergunta", "instruções")).rejects.toThrow("OPENAI_API_KEY");
  });
});
