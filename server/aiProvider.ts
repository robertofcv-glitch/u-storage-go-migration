import OpenAI from "openai";

export const DEFAULT_AI_MODEL = "claude-sonnet-4-6";
export const FALLBACK_AI_MODEL = "gpt-5";

const RETIRED_CHAT_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4",
  "gpt-3.5-turbo",
  "o4-mini",
  "o3-mini",
]);

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: string | { url: string; detail?: string } };
export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<TextPart | ImagePart>;
};

export type AiCreateRequest = {
  model?: string;
  messages: AiMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" };
  jsonArray?: boolean;
  validateJson?: (value: unknown) => boolean;
};

export type AiCreateResponse = {
  choices: Array<{
    message: { role: "assistant"; content: string };
    finish_reason?: string | null;
  }>;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  fallbackUsed?: boolean;
};

type AnthropicTransport = (request: {
  url: string;
  apiKey: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
}) => Promise<unknown>;

type OpenAiTransport = (request: Record<string, unknown>) => Promise<unknown>;

export type AiClientOptions = {
  anthropicTransport?: AnthropicTransport;
  openAiTransport?: OpenAiTransport;
  env?: NodeJS.ProcessEnv;
  logger?: (event: Record<string, unknown>) => void;
  timeoutMs?: number;
};

type JsonRecord = Record<string, unknown>;

class SafetyRefusalError extends Error {
  constructor(provider: string) {
    super(`${provider} declined the request for safety reasons`);
    this.name = "SafetyRefusalError";
  }
}

class ProviderFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function resolveAiModel(model?: string | null): string {
  const normalized = model?.trim().toLowerCase();
  if (!normalized || RETIRED_CHAT_MODELS.has(normalized)) return DEFAULT_AI_MODEL;
  if (normalized === DEFAULT_AI_MODEL || normalized === FALLBACK_AI_MODEL) return normalized;
  throw new ProviderFailure(`Unsupported AI model: ${normalized}`);
}

function textFromContent(content: AiMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.filter((part): part is TextPart => part.type === "text").map((part) => part.text).join("\n");
}

function anthropicContent(content: AiMessage["content"]): unknown {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return part;
    const url = typeof part.image_url === "string" ? part.image_url : part.image_url.url;
    const inline = /^data:([^;,]+);base64,([\s\S]+)$/.exec(url);
    if (inline) {
      return {
        type: "image",
        source: { type: "base64", media_type: inline[1], data: inline[2] },
      };
    }
    return { type: "image", source: { type: "url", url } };
  });
}

function buildAnthropicBody(request: AiCreateRequest): JsonRecord {
  const systems = request.messages
    .filter((message) => message.role === "system")
    .map((message) => textFromContent(message.content))
    .filter(Boolean);
  if (request.response_format?.type === "json_object") {
    systems.push(request.jsonArray
      ? "Return only a valid JSON array. Do not use Markdown code fences."
      : "Return only a valid JSON object. Do not use Markdown code fences.");
  }
  const body: JsonRecord = {
    model: DEFAULT_AI_MODEL,
    max_tokens: request.max_tokens ?? 4096,
    messages: request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: anthropicContent(message.content) })),
  };
  if (systems.length) body.system = systems.join("\n\n");
  if (request.temperature !== undefined) body.temperature = request.temperature;
  return body;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function normalizeStructured(
  content: string,
  arrayExpected: boolean,
  validateJson?: (value: unknown) => boolean,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch {
    throw new ProviderFailure("AI provider returned malformed JSON");
  }
  const valid = arrayExpected
    ? Array.isArray(parsed)
    : typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  if (!valid) {
    throw new ProviderFailure(arrayExpected
      ? "AI provider returned JSON that is not an array"
      : "AI provider returned JSON that is not an object");
  }
  if (validateJson) {
    let shapeIsValid = false;
    try {
      shapeIsValid = validateJson(parsed);
    } catch {
      throw new ProviderFailure("AI provider returned JSON with an invalid shape");
    }
    if (!shapeIsValid) {
      throw new ProviderFailure("AI provider returned JSON with an invalid shape");
    }
  }
  return JSON.stringify(parsed);
}

function normalizeContent(content: string, request: AiCreateRequest, truncated: boolean): string {
  if (!content.trim()) throw new ProviderFailure("AI provider returned no content");
  if (truncated) throw new ProviderFailure("AI provider response was truncated");
  if (request.response_format?.type === "json_object") {
    return normalizeStructured(content, request.jsonArray === true, request.validateJson);
  }
  return content;
}

async function defaultAnthropicTransport(input: Parameters<AnthropicTransport>[0]): Promise<unknown> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  headers["x-api-key"] = input.apiKey;
  const response = await fetch(input.url, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
    signal: input.signal,
  });
  if (!response.ok) throw new ProviderFailure(`Anthropic request failed with status ${response.status}`);
  return response.json();
}

function anthropicCredentials(env: NodeJS.ProcessEnv): { apiKey: string; url: string } | null {
  if (env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    const baseURL = env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL.replace(/\/$/, "");
    return {
      apiKey: env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      url: `${baseURL}${baseURL.endsWith("/v1") ? "" : "/v1"}/messages`,
    };
  }
  return null;
}

function openAiCredentials(env: NodeJS.ProcessEnv): { apiKey: string; baseURL?: string } | null {
  if (!env.AI_INTEGRATIONS_OPENAI_API_KEY || !env.AI_INTEGRATIONS_OPENAI_BASE_URL) return null;
  return {
    apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  };
}

function safeMessage(error: unknown): string {
  if (error instanceof SafetyRefusalError) return error.message;
  if (error instanceof ProviderFailure) return error.message;
  return "AI provider request failed";
}

export function createAiClient(options: AiClientOptions = {}): {
  chat: { completions: { create(request: AiCreateRequest): Promise<AiCreateResponse> } };
} {
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const logger = options.logger ?? ((event) => console.warn(JSON.stringify(event)));

  const callOpenAi = async (request: AiCreateRequest, fallbackUsed: boolean): Promise<AiCreateResponse> => {
    const credentials = openAiCredentials(env);
    if (!credentials && !options.openAiTransport) throw new ProviderFailure("GPT-5 credentials are not configured");
    const messages = request.jsonArray
      ? [
          { role: "system", content: "Return only a valid JSON array. Do not use Markdown code fences." },
          ...request.messages,
        ]
      : request.messages;
    const payload: Record<string, unknown> = {
      model: FALLBACK_AI_MODEL,
      messages,
      max_completion_tokens: request.max_tokens ?? 4096,
      reasoning_effort: "minimal",
    };
    // OpenAI's json_object mode rejects a top-level array, so arrays are
    // requested in the system instruction and validated locally instead.
    if (request.response_format && !request.jsonArray) payload.response_format = request.response_format;
    const transport = options.openAiTransport ?? (async (body) => {
      const client = new OpenAI({ ...credentials!, timeout: timeoutMs, maxRetries: 0 });
      return client.chat.completions.create(body as never);
    });
    const raw = await transport(payload) as JsonRecord;
    const choice = (raw.choices as JsonRecord[] | undefined)?.[0];
    const message = choice?.message as JsonRecord | undefined;
    if (message?.refusal || choice?.finish_reason === "content_filter") throw new SafetyRefusalError("GPT-5");
    const content = typeof message?.content === "string" ? message.content : "";
    const normalized = normalizeContent(content, request, choice?.finish_reason === "length");
    return {
      choices: [{ message: { role: "assistant", content: normalized }, finish_reason: choice?.finish_reason as string | undefined }],
      model: typeof raw.model === "string" ? raw.model : FALLBACK_AI_MODEL,
      usage: raw.usage as AiCreateResponse["usage"],
      ...(fallbackUsed ? { fallbackUsed: true } : {}),
    };
  };

  const create = async (request: AiCreateRequest): Promise<AiCreateResponse> => {
    const model = resolveAiModel(request.model);
    if (model === FALLBACK_AI_MODEL) {
      try {
        return await callOpenAi(request, false);
      } catch (error) {
        if (error instanceof SafetyRefusalError) throw error;
        throw new ProviderFailure(`GPT-5 request failed: ${safeMessage(error)}`);
      }
    }

    let primaryError: unknown;
    try {
      const credentials = anthropicCredentials(env);
      if (!credentials && !options.anthropicTransport) throw new ProviderFailure("Claude credentials are not configured");
      const transport = options.anthropicTransport ?? defaultAnthropicTransport;
      const raw = await transport({
        url: credentials?.url ?? "",
        apiKey: credentials?.apiKey ?? "",
        body: buildAnthropicBody(request),
        signal: AbortSignal.timeout(timeoutMs),
      }) as JsonRecord;
      const blocks = raw.content as JsonRecord[] | undefined;
      if (raw.stop_reason === "refusal" || blocks?.some((block) => block.type === "refusal")) {
        throw new SafetyRefusalError("Claude");
      }
      const content = blocks?.filter((block) => block.type === "text")
        .map((block) => String(block.text ?? "")).join("") ?? "";
      const normalized = normalizeContent(content, request, raw.stop_reason === "max_tokens");
      const usage = raw.usage as JsonRecord | undefined;
      return {
        choices: [{ message: { role: "assistant", content: normalized }, finish_reason: raw.stop_reason as string | undefined }],
        model: typeof raw.model === "string" ? raw.model : DEFAULT_AI_MODEL,
        usage: usage ? {
          prompt_tokens: usage.input_tokens as number | undefined,
          completion_tokens: usage.output_tokens as number | undefined,
          total_tokens: typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
            ? usage.input_tokens + usage.output_tokens : undefined,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof SafetyRefusalError) throw error;
      primaryError = error;
    }

    const primaryConfigured = anthropicCredentials(env) !== null;
    logger({
      event: "ai_provider_fallback",
      from: DEFAULT_AI_MODEL,
      to: FALLBACK_AI_MODEL,
      primaryConfigured,
      primaryAttempted: primaryConfigured || options.anthropicTransport !== undefined,
      reason: !primaryConfigured && options.anthropicTransport === undefined
        ? "credentials_missing"
        : primaryError instanceof ProviderFailure ? primaryError.message : "provider_error",
    });
    try {
      return await callOpenAi(request, true);
    } catch (fallbackError) {
      if (fallbackError instanceof SafetyRefusalError) throw fallbackError;
      throw new ProviderFailure(
        `AI providers failed (Claude: ${safeMessage(primaryError)}; GPT-5: ${safeMessage(fallbackError)})`,
      );
    }
  };

  return { chat: { completions: { create } } };
}

export type AiProviderStatus = {
  connected: boolean;
  primaryModel: typeof DEFAULT_AI_MODEL;
  fallbackModel: typeof FALLBACK_AI_MODEL;
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  models: string[];
  error?: string;
};

export function getAiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatus {
  const primaryConfigured = anthropicCredentials(env) !== null;
  const fallbackConfigured = openAiCredentials(env) !== null;
  return {
    connected: primaryConfigured || fallbackConfigured,
    primaryModel: DEFAULT_AI_MODEL,
    fallbackModel: FALLBACK_AI_MODEL,
    primaryConfigured,
    fallbackConfigured,
    models: [
      ...(primaryConfigured ? [DEFAULT_AI_MODEL] : []),
      ...(fallbackConfigured ? [FALLBACK_AI_MODEL] : []),
    ],
    ...(!primaryConfigured && !fallbackConfigured
      ? { error: "No supported AI provider credentials are configured" }
      : {}),
  };
}