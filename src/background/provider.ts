import { AI_CACHE_KEY } from "../shared/settings";
import type { EnhancedItem, ExtensionSettings, TextItem } from "../shared/types";

interface AiCacheEntry {
  createdAt: number;
  items: EnhancedItem[];
}

type AiCache = Record<string, AiCacheEntry>;

function endpointFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
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

async function readCache(key: string): Promise<EnhancedItem[] | null> {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = (stored[AI_CACHE_KEY] as AiCache | undefined) ?? {};
  const entry = cache[key];
  if (!entry || Date.now() - entry.createdAt > 7 * 24 * 60 * 60 * 1000) return null;
  return entry.items;
}

async function writeCache(key: string, items: EnhancedItem[]): Promise<void> {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = (stored[AI_CACHE_KEY] as AiCache | undefined) ?? {};
  cache[key] = { createdAt: Date.now(), items };
  const ordered = Object.entries(cache)
    .sort((left, right) => right[1].createdAt - left[1].createdAt)
    .slice(0, 120);
  await chrome.storage.local.set({ [AI_CACHE_KEY]: Object.fromEntries(ordered) });
}

export async function enhanceWithProvider(
  items: TextItem[],
  settings: ExtensionSettings,
): Promise<EnhancedItem[]> {
  if (settings.provider.mode !== "hybrid") return [];
  if (!settings.provider.baseUrl || !settings.provider.model) {
    throw new Error("请先填写模型接口地址和模型名称");
  }

  const cacheKey = await sha256(
    JSON.stringify({
      items,
      cefrLevel: settings.cefrLevel,
      intensity: settings.intensity,
      baseUrl: settings.provider.baseUrl,
      model: settings.provider.model,
    }),
  );
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  const system = [
    "You enhance Chinese reading material with low-pressure English exposure.",
    "Return JSON only: {\"items\":[{\"id\":\"...\",\"replacements\":[{\"source\":\"exact Chinese substring\",\"target\":\"natural English\",\"gloss\":\"short Chinese explanation\",\"difficulty\":1}]}]}.",
    "Replace only useful words or short phrases, never names, numbers, URLs, code, or punctuation.",
    "Every source must be an exact substring of the supplied text. Do not return HTML.",
    `Learner target vocabulary level is CEFR ${settings.cefrLevel} and replacement intensity is ${settings.intensity}.`,
  ].join("\n");

  const response = await fetch(endpointFor(settings.provider.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.provider.apiKey ? { Authorization: `Bearer ${settings.provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.provider.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ items }) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`模型请求失败：HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型没有返回可解析的内容");
  const enhanced = sanitizeItems(parseJsonContent(content), items);
  await writeCache(cacheKey, enhanced);
  return enhanced;
}

export async function testProvider(settings: ExtensionSettings): Promise<string> {
  const result = await enhanceWithProvider(
    [{ id: "health-check", text: "这个工具可以提高阅读效率。" }],
    settings,
  );
  return result.length > 0 ? "连接成功，模型返回了有效结构。" : "连接成功，但模型未建议替换。";
}
