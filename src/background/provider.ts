import { AI_CACHE_KEY, AI_DIAGNOSTICS_KEY } from "../shared/settings";
import type {
  AiDiagnostics,
  EnhancedItem,
  ExtensionSettings,
  Replacement,
  TextItem,
} from "../shared/types";

interface CachedBatch {
  createdAt: number;
  texts: string[];
  replacements: Replacement[][];
}

type AiCache = Record<string, CachedBatch>;

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 300;
const PROMPT_VERSION = 2;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const inFlight = new Map<string, Promise<Replacement[][]>>();

function endpointFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function isDeepSeek(settings: ExtensionSettings): boolean {
  return settings.provider.preset === "deepseek" || /api\.deepseek\.com/i.test(settings.provider.baseUrl);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function sanitizeItems(raw: unknown, input: TextItem[]): EnhancedItem[] {
  if (!raw || typeof raw !== "object") return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const allowedIds = new Set(input.map((item) => item.id));

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => allowedIds.has(String(item.id ?? "")))
    .map((item) => ({
      id: String(item.id),
      replacements: Array.isArray(item.replacements)
        ? item.replacements.slice(0, 12).map((replacement) => {
            const value = replacement as Record<string, unknown>;
            return {
              start: Number(value.start),
              end: Number(value.end),
              source: String(value.source ?? ""),
              target: String(value.target ?? ""),
              gloss: String(value.gloss ?? value.source ?? ""),
              difficulty: Number(value.difficulty) || 3,
              origin: "ai" as const,
            };
          })
        : [],
    }));
}

async function readCache(key: string, input: TextItem[]): Promise<EnhancedItem[] | null> {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = (stored[AI_CACHE_KEY] as AiCache | undefined) ?? {};
  const entry = cache[key];
  if (
    !entry ||
    !Array.isArray(entry.texts) ||
    !Array.isArray(entry.replacements) ||
    Date.now() - entry.createdAt > CACHE_TTL_MS
  ) return null;
  if (entry.texts.length !== input.length || entry.texts.some((text, index) => text !== input[index].text)) {
    return null;
  }
  return input.map((item, index) => ({ id: item.id, replacements: entry.replacements[index] ?? [] }));
}

async function writeCache(key: string, input: TextItem[], items: EnhancedItem[]): Promise<void> {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = (stored[AI_CACHE_KEY] as AiCache | undefined) ?? {};
  const byId = new Map(items.map((item) => [item.id, item.replacements]));
  cache[key] = {
    createdAt: Date.now(),
    texts: input.map((item) => item.text),
    replacements: input.map((item) => byId.get(item.id) ?? []),
  };
  const ordered = Object.entries(cache)
    .filter(([, entry]) => Date.now() - entry.createdAt <= CACHE_TTL_MS)
    .sort((left, right) => right[1].createdAt - left[1].createdAt)
    .slice(0, CACHE_LIMIT);
  await chrome.storage.local.set({ [AI_CACHE_KEY]: Object.fromEntries(ordered) });
}

async function recordDiagnostics(value: AiDiagnostics): Promise<void> {
  await chrome.storage.local.set({ [AI_DIAGNOSTICS_KEY]: value });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestCompletion(
  items: TextItem[],
  settings: ExtensionSettings,
): Promise<EnhancedItem[]> {
  const system = [
    "You enhance Chinese reading material with low-pressure English exposure.",
    "Return JSON only in this exact shape: {\"items\":[{\"id\":\"...\",\"replacements\":[{\"start\":0,\"end\":2,\"source\":\"exact Chinese substring\",\"target\":\"natural English\",\"gloss\":\"short Chinese explanation\",\"difficulty\":3}]}]}.",
    "Replace only useful words or short phrases, never names, numbers, URLs, code, or punctuation.",
    "Every source must be an exact substring of the supplied text. Offsets use JavaScript UTF-16 string indexes. Do not return HTML.",
    `Learner target vocabulary level is CEFR ${settings.cefrLevel} and replacement intensity is ${settings.intensity}.`,
  ].join("\n");
  const outputBudget = Math.max(
    320,
    Math.min(1_600, 240 + items.reduce((total, item) => total + item.text.length, 0) * 2),
  );
  const body: Record<string, unknown> = {
    model: settings.provider.model,
    temperature: 0.2,
    max_tokens: outputBudget,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ items }) },
    ],
  };
  if (isDeepSeek(settings)) {
    body.thinking = { type: "disabled" };
    body.reasoning_effort = "none";
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.provider.timeoutMs);
    try {
      const response = await fetch(endpointFor(settings.provider.baseUrl), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(settings.provider.apiKey ? { Authorization: `Bearer ${settings.provider.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        const error = new Error(`模型请求失败：HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
        if (attempt === 0 && RETRYABLE_STATUS.has(response.status)) {
          lastError = error;
          await sleep(450);
          continue;
        }
        if (attempt === 0 && response.status === 400 && !isDeepSeek(settings)) {
          delete body.response_format;
          lastError = error;
          continue;
        }
        Object.assign(error, { nonRetryable: true });
        throw error;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      };
      const choice = payload.choices?.[0];
      if (choice?.finish_reason === "length") throw new Error("模型返回内容被截断，请减少批次或提高输出上限");
      const content = choice?.message?.content;
      if (!content) throw new Error("模型没有返回可解析的内容");
      return sanitizeItems(parseJsonContent(content), items);
    } catch (error) {
      const normalized =
        error instanceof DOMException && error.name === "AbortError"
          ? new Error(`模型请求超过 ${Math.round(settings.provider.timeoutMs / 1000)} 秒，已取消`)
          : error instanceof Error
            ? error
            : new Error(String(error));
      if (
        attempt === 0 &&
        !(error instanceof SyntaxError) &&
        !(error as { nonRetryable?: boolean }).nonRetryable
      ) {
        lastError = normalized;
        await sleep(450);
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("模型请求失败");
}

export async function enhanceWithProvider(
  items: TextItem[],
  settings: ExtensionSettings,
  options: { skipCache?: boolean } = {},
): Promise<EnhancedItem[]> {
  if (settings.provider.mode !== "hybrid") return [];
  if (!settings.provider.baseUrl || !settings.provider.model) {
    throw new Error("请先填写模型接口地址和模型名称");
  }

  const startedAt = performance.now();
  const cacheKey = await sha256(
    JSON.stringify({
      promptVersion: PROMPT_VERSION,
      texts: items.map((item) => item.text),
      cefrLevel: settings.cefrLevel,
      intensity: settings.intensity,
      baseUrl: settings.provider.baseUrl,
      model: settings.provider.model,
    }),
  );

  if (!options.skipCache) {
    const cached = await readCache(cacheKey, items);
    if (cached) {
      await recordDiagnostics({
        timestamp: Date.now(),
        durationMs: Math.round(performance.now() - startedAt),
        cacheHit: true,
        inputCount: items.length,
        replacementCount: cached.reduce((total, item) => total + item.replacements.length, 0),
        provider: settings.provider.preset,
        status: "success",
      });
      return cached;
    }
  }

  try {
    let pending = inFlight.get(cacheKey);
    if (!pending || options.skipCache) {
      pending = requestCompletion(items, settings).then((result) => {
        const byId = new Map(result.map((item) => [item.id, item.replacements]));
        return items.map((item) => byId.get(item.id) ?? []);
      });
      if (!options.skipCache) inFlight.set(cacheKey, pending);
    }
    const replacements = await pending;
    const enhanced = items.map((item, index) => ({ id: item.id, replacements: replacements[index] ?? [] }));
    await writeCache(cacheKey, items, enhanced);
    await recordDiagnostics({
      timestamp: Date.now(),
      durationMs: Math.round(performance.now() - startedAt),
      cacheHit: false,
      inputCount: items.length,
      replacementCount: enhanced.reduce((total, item) => total + item.replacements.length, 0),
      provider: settings.provider.preset,
      status: "success",
    });
    return enhanced;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordDiagnostics({
      timestamp: Date.now(),
      durationMs: Math.round(performance.now() - startedAt),
      cacheHit: false,
      inputCount: items.length,
      replacementCount: 0,
      provider: settings.provider.preset,
      status: "error",
      message,
    });
    throw error;
  } finally {
    if (!options.skipCache) inFlight.delete(cacheKey);
  }
}

export async function testProvider(settings: ExtensionSettings): Promise<string> {
  const startedAt = performance.now();
  const result = await enhanceWithProvider(
    [{ id: "health-check", text: "这个工具可以提高阅读效率。" }],
    settings,
    { skipCache: true },
  );
  const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
  return result.length > 0
    ? `连接成功，模型返回了有效结构（${duration} 秒）。`
    : `连接成功，模型未建议替换（${duration} 秒）。`;
}
