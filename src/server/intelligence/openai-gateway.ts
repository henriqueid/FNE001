export type AIProviderStatus = {
  provider: "openai";
  configured: boolean;
  model: string;
  endpoint: string;
  keyHint?: string;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AICompletion = {
  text: string;
  model: string;
  requestId?: string;
  usage: AIUsage;
};

type OpenAIResponse = {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string; type?: string };
};

const DEFAULT_ENDPOINT = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-6-luna";

function cleanEndpoint(value: string | undefined) {
  return (value?.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, "");
}

export function openAIConfiguration(): AIProviderStatus {
  const key = process.env.OPENAI_API_KEY?.trim();
  return {
    provider: "openai",
    configured: Boolean(key),
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    endpoint: cleanEndpoint(process.env.OPENAI_BASE_URL),
    keyHint: key ? `••••${key.slice(-4)}` : undefined,
  };
}

function responseText(body: OpenAIResponse) {
  if (body.output_text?.trim()) return body.output_text.trim();
  return (body.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(item => item.type === "output_text" && item.text)
    .map(item => item.text?.trim())
    .filter(Boolean)
    .join("\n\n");
}

function safeProviderError(status: number, body: OpenAIResponse) {
  if (status === 401 || status === 403) return "A credencial da OpenAI foi recusada.";
  if (status === 404) return "O modelo configurado não está disponível para este projeto.";
  if (status === 429 && body.error?.code === "credit_balance_exhausted")
    return "A chave está autorizada, mas a organização da OpenAI vinculada a ela está sem créditos de API.";
  if (status === 429 && body.error?.code === "project_spend_limit_exceeded")
    return "O limite mensal de gastos do projeto da OpenAI foi atingido.";
  if (status === 429 && body.error?.code === "organization_spend_limit_exceeded")
    return "O limite mensal de gastos da organização da OpenAI foi atingido.";
  if (status === 429) return "O limite de uso da OpenAI foi atingido. Tente novamente mais tarde.";
  if (status >= 500) return "A OpenAI está temporariamente indisponível.";
  return body.error?.message?.slice(0, 240) || "A OpenAI não conseguiu concluir a solicitação.";
}

export async function createOpenAIResponse(
  input: string,
  instructions: string,
  options: { maxOutputTokens?: number; timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<AICompletion> {
  const configuration = openAIConfiguration();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY não foi configurada no servidor.");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 75_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetcher ?? fetch)(`${configuration.endpoint}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: configuration.model,
        instructions,
        input,
        max_output_tokens: options.maxOutputTokens ?? 700,
        store: false,
      }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as OpenAIResponse;
    if (!response.ok) throw new Error(safeProviderError(response.status, body));
    const text = responseText(body);
    if (!text) throw new Error("O modelo não retornou uma resposta em texto.");
    return {
      text,
      model: body.model || configuration.model,
      requestId: response.headers.get("x-request-id") ?? body.id,
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
        totalTokens: body.usage?.total_tokens ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(`A OpenAI não respondeu dentro de ${Math.round(timeoutMs / 1_000)} segundos.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testOpenAIConnection(fetcher?: typeof fetch) {
  const result = await createOpenAIResponse(
    "Responda somente com a palavra OK.",
    "Você está executando um teste de conectividade. Não inclua explicações.",
    { maxOutputTokens: 16, timeoutMs: 30_000, fetcher },
  );
  return { ...result, ok: result.text.trim().toLocaleUpperCase().includes("OK") };
}
