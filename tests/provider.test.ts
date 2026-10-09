import assert from "node:assert/strict";
import test from "node:test";
import { enhanceWithProvider } from "../src/background/provider";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

function installChromeStorage(): void {
  const storage: Record<string, unknown> = {};
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          async get(key: string | string[]) {
            const keys = Array.isArray(key) ? key : [key];
            return Object.fromEntries(keys.filter((item) => item in storage).map((item) => [item, storage[item]]));
          },
          async set(values: Record<string, unknown>) {
            Object.assign(storage, values);
          },
        },
      },
    },
  });
}

function deepSeekSettings() {
  return {
    ...DEFAULT_SETTINGS,
    provider: {
      ...DEFAULT_SETTINGS.provider,
      mode: "hybrid" as const,
      preset: "deepseek" as const,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      apiKey: "test-key",
    },
  };
}

test("DeepSeek truncation increases the output budget and retries", async () => {
  installChromeStorage();

  const bodies: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    if (bodies.length === 1) {
      return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                items: [
                  {
                    id: "one",
                    replacements: [
                      { start: 2, end: 4, source: "工具", target: "tool", difficulty: 1 },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await enhanceWithProvider(
      [{ id: "one", text: "这个工具很好用。" }],
      deepSeekSettings(),
      { skipCache: true },
    );
    assert.equal(bodies.length, 2);
    assert.ok(Number(bodies[1].max_tokens) > Number(bodies[0].max_tokens));
    assert.equal(result[0].replacements[0].target, "tool");
    assert.equal(result[0].replacements[0].gloss, "工具");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("repeated truncation automatically splits a batch", async () => {
  installChromeStorage();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    if (calls <= 2) {
      return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userMessage = body.messages.find((message) => message.role === "user");
    const input = JSON.parse(userMessage?.content ?? "{}") as { items?: Array<{ id: string }> };
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                items: (input.items ?? []).map((item) => ({ id: item.id, replacements: [] })),
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await enhanceWithProvider(
      [
        { id: "one", text: "第一段用于测试自动拆分。" },
        { id: "two", text: "第二段用于测试自动拆分。" },
      ],
      deepSeekSettings(),
      { skipCache: true },
    );
    assert.equal(calls, 4);
    assert.deepEqual(result.map((item) => item.id), ["one", "two"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
