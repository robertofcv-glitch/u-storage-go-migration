import assert from "node:assert/strict";
import test from "node:test";
import {
  createAiClient,
  DEFAULT_AI_MODEL,
  FALLBACK_AI_MODEL,
  getAiProviderStatus,
  resolveAiModel,
} from "./aiProvider";

const claudeOk = (content = "ok") => ({
  model: DEFAULT_AI_MODEL,
  content: [{ type: "text", text: content }],
  stop_reason: "end_turn",
  usage: { input_tokens: 2, output_tokens: 3 },
});

test("maps only retired chat models and rejects unsupported and transcription models", () => {
  assert.equal(resolveAiModel("gpt-4o"), DEFAULT_AI_MODEL);
  assert.equal(resolveAiModel("o4-mini"), DEFAULT_AI_MODEL);
  assert.equal(resolveAiModel("o3-mini"), DEFAULT_AI_MODEL);
  assert.equal(resolveAiModel(""), DEFAULT_AI_MODEL);
  assert.equal(resolveAiModel(FALLBACK_AI_MODEL), FALLBACK_AI_MODEL);
  assert.throws(() => resolveAiModel("gpt-4o-transcribe"), /Unsupported/);
  assert.throws(() => resolveAiModel("some-model"), /Unsupported/);
});

test("converts system, text, inline images, and remote images for Claude", async () => {
  let sent: any;
  const client = createAiClient({
    env: {},
    anthropicTransport: async (input) => {
      sent = input;
      return claudeOk();
    },
  });
  await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "rules" },
      { role: "user", content: [
        { type: "text", text: "look" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        { type: "image_url", image_url: "https://example.com/a.jpg" },
      ] },
    ],
    max_tokens: 100,
    temperature: 0.2,
  });
  assert.equal(sent.body.system, "rules");
  assert.deepEqual(sent.body.messages[0].content, [
    { type: "text", text: "look" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
    { type: "image", source: { type: "url", url: "https://example.com/a.jpg" } },
  ]);
  assert.equal(sent.body.temperature, 0.2);
});

test("uses GPT-5 parameters without temperature or the custom jsonArray property", async () => {
  let sent: any;
  const client = createAiClient({
    env: {},
    openAiTransport: async (body) => {
      sent = body;
      return { model: FALLBACK_AI_MODEL, choices: [{ message: { content: "{}" }, finish_reason: "stop" }] };
    },
  });
  await client.chat.completions.create({
    model: FALLBACK_AI_MODEL,
    messages: [{ role: "user", content: "hello" }],
    max_tokens: 50,
    temperature: 0.8,
    response_format: { type: "json_object" },
  });
  assert.equal(sent.max_completion_tokens, 50);
  assert.equal(sent.reasoning_effort, "minimal");
  assert.equal("temperature" in sent, false);
  assert.equal("jsonArray" in sent, false);
});

test("falls back once and reports a safe fallback event", async () => {
  const events: Record<string, unknown>[] = [];
  let fallbackCalls = 0;
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => { throw new Error("secret customer content"); },
    openAiTransport: async () => {
      fallbackCalls++;
      return { choices: [{ message: { content: "recovered" }, finish_reason: "stop" }] };
    },
    logger: (event) => events.push(event),
  });
  const result = await client.chat.completions.create({
    messages: [{ role: "user", content: "private prompt" }],
  });
  assert.equal(result.choices[0].message.content, "recovered");
  assert.equal(result.fallbackUsed, true);
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(events[0], {
    event: "ai_provider_fallback",
    from: DEFAULT_AI_MODEL,
    to: FALLBACK_AI_MODEL,
    primaryConfigured: false,
    primaryAttempted: true,
    reason: "provider_error",
  });
});

test("throws a sanitized explicit error when both providers fail", async () => {
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => { throw new Error("anthropic internals"); },
    openAiTransport: async () => { throw new Error("openai internals"); },
    logger: () => undefined,
  });
  await assert.rejects(
    client.chat.completions.create({ messages: [{ role: "user", content: "secret" }] }),
    (error: Error) => /AI providers failed/.test(error.message)
      && !error.message.includes("internals")
      && !error.message.includes("secret"),
  );
});

test("falls back for malformed and truncated structured output and normalizes code fences", async () => {
  for (const primary of [
    claudeOk("{bad"),
    { ...claudeOk('{"partial":true}'), stop_reason: "max_tokens" },
  ]) {
    const client = createAiClient({
      env: {},
      anthropicTransport: async () => primary,
      openAiTransport: async () => ({
        choices: [{ message: { content: "```json\n{\"valid\": true}\n```" }, finish_reason: "stop" }],
      }),
      logger: () => undefined,
    });
    const result = await client.chat.completions.create({
      messages: [{ role: "user", content: "json" }],
      response_format: { type: "json_object" },
    });
    assert.equal(result.choices[0].message.content, '{"valid":true}');
    assert.equal(result.fallbackUsed, true);
  }
});

test("validates requested JSON arrays", async () => {
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => claudeOk("```json\n[1, 2]\n```"),
  });
  const result = await client.chat.completions.create({
    messages: [{ role: "user", content: "array" }],
    response_format: { type: "json_object" },
    jsonArray: true,
  });
  assert.equal(result.choices[0].message.content, "[1,2]");
});

test("requests GPT JSON arrays without incompatible json_object mode", async () => {
  let sent: any;
  const client = createAiClient({
    env: {},
    openAiTransport: async (body) => {
      sent = body;
      return { choices: [{ message: { content: "[1]" }, finish_reason: "stop" }] };
    },
  });
  const result = await client.chat.completions.create({
    model: FALLBACK_AI_MODEL,
    messages: [{ role: "user", content: "array" }],
    response_format: { type: "json_object" },
    jsonArray: true,
  });
  assert.equal(sent.response_format, undefined);
  assert.match(sent.messages[0].content, /JSON array/);
  assert.equal(result.choices[0].message.content, "[1]");
});

test("falls back when valid JSON has the wrong application shape", async () => {
  let fallbackCalls = 0;
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => claudeOk('{"newItems":[{"name":42}]}'),
    openAiTransport: async (body) => {
      fallbackCalls++;
      assert.equal("validateJson" in body, false);
      return {
        choices: [{
          message: { content: '{"newItems":[{"name":"Box"}]}' },
          finish_reason: "stop",
        }],
      };
    },
    logger: () => undefined,
  });
  const validateJson = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null || !("newItems" in value)) return false;
    const newItems = (value as { newItems: unknown }).newItems;
    return Array.isArray(newItems)
      && newItems.every((item) => typeof item === "object"
        && item !== null
        && typeof (item as { name?: unknown }).name === "string");
  };
  const result = await client.chat.completions.create({
    messages: [{ role: "user", content: "items" }],
    response_format: { type: "json_object" },
    validateJson,
  });
  assert.equal(result.choices[0].message.content, '{"newItems":[{"name":"Box"}]}');
  assert.equal(result.fallbackUsed, true);
  assert.equal(fallbackCalls, 1);
});

test("fails explicitly when fallback JSON also has the wrong application shape", async () => {
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => claudeOk('{"newItems":"wrong"}'),
    openAiTransport: async () => ({
      choices: [{ message: { content: '{"newItems":[{"name":false}]}' }, finish_reason: "stop" }],
    }),
    logger: () => undefined,
  });
  await assert.rejects(
    client.chat.completions.create({
      messages: [{ role: "user", content: "items" }],
      response_format: { type: "json_object" },
      validateJson: (value) => {
        const items = (value as { newItems?: unknown }).newItems;
        return Array.isArray(items)
          && items.every((item) => typeof (item as { name?: unknown })?.name === "string");
      },
    }),
    /AI providers failed.*invalid shape.*invalid shape/,
  );
});

test("validator exceptions are treated as invalid provider output", async () => {
  const client = createAiClient({
    env: {},
    anthropicTransport: async () => claudeOk('{"ok":true}'),
    openAiTransport: async () => ({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
    }),
    logger: () => undefined,
  });
  await assert.rejects(
    client.chat.completions.create({
      messages: [{ role: "user", content: "json" }],
      response_format: { type: "json_object" },
      validateJson: () => { throw new Error("validator internals"); },
    }),
    (error: Error) => /invalid shape/.test(error.message)
      && !error.message.includes("validator internals"),
  );
});

test("does not fall back on explicit Claude or GPT safety refusals", async () => {
  let fallbackCalls = 0;
  const claudeClient = createAiClient({
    env: {},
    anthropicTransport: async () => ({ content: [], stop_reason: "refusal" }),
    openAiTransport: async () => { fallbackCalls++; return {}; },
  });
  await assert.rejects(
    claudeClient.chat.completions.create({ messages: [{ role: "user", content: "x" }] }),
    /safety/,
  );
  assert.equal(fallbackCalls, 0);

  const gptClient = createAiClient({
    env: {},
    openAiTransport: async () => ({
      choices: [{ message: { content: null, refusal: "no" }, finish_reason: "stop" }],
    }),
  });
  await assert.rejects(
    gptClient.chat.completions.create({ model: FALLBACK_AI_MODEL, messages: [{ role: "user", content: "x" }] }),
    /safety/,
  );
});

test("reports credential presence synchronously without treating OpenAI as Claude", () => {
  const status = getAiProviderStatus({
    AI_INTEGRATIONS_OPENAI_API_KEY: "openai",
    AI_INTEGRATIONS_OPENAI_BASE_URL: "https://openai.example",
  });
  assert.equal(status.connected, true);
  assert.equal(status.primaryConfigured, false);
  assert.equal(status.fallbackConfigured, true);
  assert.equal(status.primaryModel, DEFAULT_AI_MODEL);
  assert.equal(status.fallbackModel, FALLBACK_AI_MODEL);
  assert.deepEqual(status.models, [FALLBACK_AI_MODEL]);
});

test("uses only Replit-managed credentials even when personal provider keys exist", async () => {
  const personalOnly = getAiProviderStatus({
    ANTHROPIC_API_KEY: "personal-anthropic",
    OPENAI_API_KEY: "personal-openai",
  });
  assert.equal(personalOnly.connected, false);
  assert.equal(personalOnly.primaryConfigured, false);
  assert.equal(personalOnly.fallbackConfigured, false);

  const managed = getAiProviderStatus({
    AI_INTEGRATIONS_ANTHROPIC_API_KEY: "managed-claude",
    AI_INTEGRATIONS_ANTHROPIC_BASE_URL: "https://managed.example/v1",
    AI_INTEGRATIONS_OPENAI_API_KEY: "managed-gpt",
    AI_INTEGRATIONS_OPENAI_BASE_URL: "https://managed-openai.example/v1",
    ANTHROPIC_API_KEY: "personal-anthropic",
  });
  assert.equal(managed.primaryConfigured, true);
  assert.equal(managed.fallbackConfigured, true);

  let sent: { url: string; apiKey: string } | undefined;
  await createAiClient({
    env: {
      AI_INTEGRATIONS_ANTHROPIC_API_KEY: "managed-claude",
      AI_INTEGRATIONS_ANTHROPIC_BASE_URL: "https://managed.example/v1",
      ANTHROPIC_API_KEY: "personal-anthropic",
    },
    anthropicTransport: async (request) => {
      sent = request;
      return claudeOk();
    },
  }).chat.completions.create({ messages: [{ role: "user", content: "hello" }] });
  assert.equal(sent?.url, "https://managed.example/v1/messages");
  assert.equal(sent?.apiKey, "managed-claude");
});