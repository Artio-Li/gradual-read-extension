// src/shared/cefr.ts
var CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
function isCefrLevel(value) {
  return typeof value === "string" && CEFR_LEVELS.includes(value);
}
function legacyLevelToCefr(value) {
  const level = Math.max(1, Math.min(6, Math.round(Number(value) || 3)));
  return CEFR_LEVELS[level - 1];
}

// src/shared/settings.ts
var SETTINGS_KEY = "gradualReadSettings";
var STATS_KEY = "gradualReadStats";
var AI_CACHE_KEY = "gradualReadAiCache";
var LEGACY_SETTINGS_KEY = "linguaWeaveSettings";
var LEGACY_STATS_KEY = "linguaWeaveStats";
var DEFAULT_SETTINGS = {
  cefrLevel: "B1",
  intensity: "gentle",
  displayMode: "mixed",
  autoSites: [],
  provider: {
    mode: "local",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    apiKey: ""
  }
};
var INTENSITIES = /* @__PURE__ */ new Set(["gentle", "balanced", "immersive"]);
var DISPLAY_MODES = /* @__PURE__ */ new Set(["mixed", "bilingual", "original"]);
var PROVIDER_MODES = /* @__PURE__ */ new Set(["local", "hybrid"]);
function normalizeSettings(input) {
  const provider = input?.provider ?? DEFAULT_SETTINGS.provider;
  const cefrLevel = isCefrLevel(input?.cefrLevel) ? input.cefrLevel : legacyLevelToCefr(input?.level);
  return {
    cefrLevel,
    intensity: INTENSITIES.has(input?.intensity) ? input?.intensity : DEFAULT_SETTINGS.intensity,
    displayMode: DISPLAY_MODES.has(input?.displayMode) ? input?.displayMode : DEFAULT_SETTINGS.displayMode,
    autoSites: Array.from(
      new Set((input?.autoSites ?? []).filter((site) => typeof site === "string"))
    ),
    provider: {
      mode: PROVIDER_MODES.has(provider.mode) ? provider.mode : DEFAULT_SETTINGS.provider.mode,
      baseUrl: String(provider.baseUrl || DEFAULT_SETTINGS.provider.baseUrl).trim(),
      model: String(provider.model || DEFAULT_SETTINGS.provider.model).trim(),
      apiKey: String(provider.apiKey || "").trim()
    }
  };
}
async function readState() {
  const stored = await chrome.storage.local.get([
    SETTINGS_KEY,
    STATS_KEY,
    LEGACY_SETTINGS_KEY,
    LEGACY_STATS_KEY
  ]);
  const settings = normalizeSettings(stored[SETTINGS_KEY] ?? stored[LEGACY_SETTINGS_KEY]);
  const stats = stored[STATS_KEY] ?? stored[LEGACY_STATS_KEY] ?? {};
  if (!stored[SETTINGS_KEY] && stored[LEGACY_SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings, [STATS_KEY]: stats });
  }
  return {
    settings,
    stats
  };
}
async function saveSettings(partial) {
  const { settings } = await readState();
  const merged = normalizeSettings({
    ...settings,
    ...partial,
    provider: {
      ...settings.provider,
      ...partial.provider ?? {}
    }
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

// src/background/provider.ts
function endpointFor(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function parseJsonContent(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}
function sanitizeItems(raw, input) {
  if (!raw || typeof raw !== "object") return [];
  const items = raw.items;
  if (!Array.isArray(items)) return [];
  const allowedIds = new Set(input.map((item) => item.id));
  return items.filter((item) => Boolean(item) && typeof item === "object").filter((item) => allowedIds.has(String(item.id ?? ""))).map((item) => ({
    id: String(item.id),
    replacements: Array.isArray(item.replacements) ? item.replacements.slice(0, 12).map((replacement) => {
      const value = replacement;
      return {
        start: Number(value.start),
        end: Number(value.end),
        source: String(value.source ?? ""),
        target: String(value.target ?? ""),
        gloss: String(value.gloss ?? value.source ?? ""),
        difficulty: Number(value.difficulty) || 3,
        origin: "ai"
      };
    }) : []
  }));
}
async function readCache(key) {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = stored[AI_CACHE_KEY] ?? {};
  const entry = cache[key];
  if (!entry || Date.now() - entry.createdAt > 7 * 24 * 60 * 60 * 1e3) return null;
  return entry.items;
}
async function writeCache(key, items) {
  const stored = await chrome.storage.local.get(AI_CACHE_KEY);
  const cache = stored[AI_CACHE_KEY] ?? {};
  cache[key] = { createdAt: Date.now(), items };
  const ordered = Object.entries(cache).sort((left, right) => right[1].createdAt - left[1].createdAt).slice(0, 120);
  await chrome.storage.local.set({ [AI_CACHE_KEY]: Object.fromEntries(ordered) });
}
async function enhanceWithProvider(items, settings) {
  if (settings.provider.mode !== "hybrid") return [];
  if (!settings.provider.baseUrl || !settings.provider.model) {
    throw new Error("\u8BF7\u5148\u586B\u5199\u6A21\u578B\u63A5\u53E3\u5730\u5740\u548C\u6A21\u578B\u540D\u79F0");
  }
  const cacheKey = await sha256(
    JSON.stringify({
      items,
      cefrLevel: settings.cefrLevel,
      intensity: settings.intensity,
      baseUrl: settings.provider.baseUrl,
      model: settings.provider.model
    })
  );
  const cached = await readCache(cacheKey);
  if (cached) return cached;
  const system = [
    "You enhance Chinese reading material with low-pressure English exposure.",
    'Return JSON only: {"items":[{"id":"...","replacements":[{"source":"exact Chinese substring","target":"natural English","gloss":"short Chinese explanation","difficulty":1}]}]}.',
    "Replace only useful words or short phrases, never names, numbers, URLs, code, or punctuation.",
    "Every source must be an exact substring of the supplied text. Do not return HTML.",
    `Learner target vocabulary level is CEFR ${settings.cefrLevel} and replacement intensity is ${settings.intensity}.`
  ].join("\n");
  const response = await fetch(endpointFor(settings.provider.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...settings.provider.apiKey ? { Authorization: `Bearer ${settings.provider.apiKey}` } : {}
    },
    body: JSON.stringify({
      model: settings.provider.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ items }) }
      ]
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`\u6A21\u578B\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${response.status}${detail ? ` \xB7 ${detail}` : ""}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u53EF\u89E3\u6790\u7684\u5185\u5BB9");
  const enhanced = sanitizeItems(parseJsonContent(content), items);
  await writeCache(cacheKey, enhanced);
  return enhanced;
}
async function testProvider(settings) {
  const result = await enhanceWithProvider(
    [{ id: "health-check", text: "\u8FD9\u4E2A\u5DE5\u5177\u53EF\u4EE5\u63D0\u9AD8\u9605\u8BFB\u6548\u7387\u3002" }],
    settings
  );
  return result.length > 0 ? "\u8FDE\u63A5\u6210\u529F\uFF0C\u6A21\u578B\u8FD4\u56DE\u4E86\u6709\u6548\u7ED3\u6784\u3002" : "\u8FDE\u63A5\u6210\u529F\uFF0C\u4F46\u6A21\u578B\u672A\u5EFA\u8BAE\u66FF\u6362\u3002";
}

// src/background/index.ts
function registrationId(origin) {
  let hash = 0;
  for (const char of origin) hash = Math.imul(hash, 31) + char.charCodeAt(0) | 0;
  return `gradual-read-${Math.abs(hash)}`;
}
function matchPattern(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.host}/*`;
}
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return;
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    throw new Error("\u5F53\u524D\u9875\u9762\u4E0D\u652F\u6301\u6269\u5C55\u8FD0\u884C");
  }
  return tab;
}
async function toggleActiveTab() {
  const tab = await activeTab();
  await ensureContentScript(tab.id);
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "TOGGLE_ENHANCEMENT"
  });
  if (!response.ok) throw new Error(response.error || "\u65E0\u6CD5\u5207\u6362\u9875\u9762\u72B6\u6001");
  return response.data ?? { active: false };
}
async function registerAutoSite(origin) {
  const { settings } = await readState();
  const id = registrationId(origin);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch {
  }
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: [matchPattern(origin)],
      js: ["content.js"],
      css: ["content.css"],
      runAt: "document_idle",
      persistAcrossSessions: true
    }
  ]);
  return saveSettings({ autoSites: [...settings.autoSites, origin] });
}
async function unregisterAutoSite(origin) {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [registrationId(origin)] });
  } catch {
  }
  const { settings } = await readState();
  return saveSettings({ autoSites: settings.autoSites.filter((site) => site !== origin) });
}
async function updateWordFeedback(word, status) {
  const { stats } = await readState();
  const key = word.toLowerCase();
  stats[key] = {
    exposures: stats[key]?.exposures ?? 0,
    status,
    updatedAt: Date.now()
  };
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}
async function recordExposures(words) {
  const { stats } = await readState();
  for (const word of new Set(words.map((value) => value.toLowerCase()))) {
    const previous = stats[word];
    stats[word] = {
      exposures: (previous?.exposures ?? 0) + 1,
      status: previous?.status,
      updatedAt: Date.now()
    };
  }
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}
async function notifyActiveTab() {
  try {
    const tab = await activeTab();
    await chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_UPDATED" });
  } catch {
  }
}
async function handleMessage(message) {
  switch (message.type) {
    case "GET_STATE":
      return { ok: true, data: await readState() };
    case "SAVE_SETTINGS": {
      const settings = await saveSettings(message.settings);
      await notifyActiveTab();
      return { ok: true, data: settings };
    }
    case "TOGGLE_ACTIVE_TAB":
      return { ok: true, data: await toggleActiveTab() };
    case "GET_ACTIVE_TAB_STATUS": {
      try {
        const tab = await activeTab();
        const response = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
        return { ok: true, data: response };
      } catch {
        return { ok: true, data: { active: false } };
      }
    }
    case "REGISTER_AUTO_SITE":
      return { ok: true, data: await registerAutoSite(message.origin) };
    case "UNREGISTER_AUTO_SITE":
      return { ok: true, data: await unregisterAutoSite(message.origin) };
    case "ENHANCE_BATCH": {
      const { settings } = await readState();
      return { ok: true, data: await enhanceWithProvider(message.items, settings) };
    }
    case "TEST_PROVIDER": {
      const { settings } = await readState();
      return { ok: true, data: await testProvider(settings) };
    }
    case "UPDATE_WORD_FEEDBACK":
      await updateWordFeedback(message.word, message.status);
      return { ok: true };
    case "RECORD_EXPOSURES":
      await recordExposures(message.words);
      return { ok: true };
    default:
      return { ok: false, error: "\u672A\u77E5\u6D88\u606F" };
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse).catch(
    (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  void readState().then(async ({ settings }) => {
    for (const origin of settings.autoSites) {
      try {
        await registerAutoSite(origin);
      } catch {
      }
    }
  });
});
//# sourceMappingURL=background.js.map
