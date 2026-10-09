import { enhanceWithProvider, testProvider } from "./provider";
import {
  AI_CACHE_KEY,
  AI_DIAGNOSTICS_KEY,
  CUSTOM_LEXICON_KEY,
  normalizeSettings,
  readState,
  saveSettings,
  SETTINGS_KEY,
  STATS_KEY,
} from "../shared/settings";
import type {
  CustomLexiconEntry,
  ExtensionSettings,
  ExportedData,
  FeedbackStatus,
  LearningStats,
  RuntimeMessage,
  RuntimeResponse,
  WordFeedbackInput,
} from "../shared/types";

function registrationId(origin: string): string {
  let hash = 0;
  for (const char of origin) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return `gradual-read-${Math.abs(hash)}`;
}

function matchPattern(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.host}/*`;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" } satisfies RuntimeMessage);
    return;
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
    throw new Error("当前页面不支持扩展运行");
  }
  return tab;
}

async function toggleActiveTab(): Promise<{ active: boolean }> {
  const tab = await activeTab();
  await ensureContentScript(tab.id!);
  const response = (await chrome.tabs.sendMessage(tab.id!, {
    type: "TOGGLE_ENHANCEMENT",
  } satisfies RuntimeMessage)) as RuntimeResponse<{ active: boolean }>;
  if (!response.ok) throw new Error(response.error || "无法切换页面状态");
  return response.data ?? { active: false };
}

async function registerAutoSite(origin: string): Promise<ExtensionSettings> {
  const { settings } = await readState();
  const id = registrationId(origin);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch {
    // Registration may not exist yet.
  }
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: [matchPattern(origin)],
      js: ["content.js"],
      css: ["content.css"],
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
  return saveSettings({ autoSites: [...settings.autoSites, origin] });
}

async function unregisterAutoSite(origin: string): Promise<ExtensionSettings> {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [registrationId(origin)] });
  } catch {
    // It is already unregistered.
  }
  const { settings } = await readState();
  return saveSettings({ autoSites: settings.autoSites.filter((site) => site !== origin) });
}

function nextReviewTime(status: FeedbackStatus, reviewCount: number): number {
  if (status === "hard") return Date.now() + 6 * 60 * 60 * 1000;
  const intervals = [1, 3, 7, 14, 30, 60];
  const days = intervals[Math.min(Math.max(0, reviewCount - 1), intervals.length - 1)];
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

async function updateWordFeedback(entry: WordFeedbackInput, status: FeedbackStatus): Promise<void> {
  const { stats } = await readState();
  const key = entry.target.toLowerCase();
  const previous = stats[key];
  const reviewCount = status === "known" ? (previous?.reviewCount ?? 0) + 1 : 0;
  stats[key] = {
    ...previous,
    exposures: previous?.exposures ?? 0,
    status,
    updatedAt: Date.now(),
    firstSeenAt: previous?.firstSeenAt ?? Date.now(),
    lastSeenAt: previous?.lastSeenAt ?? Date.now(),
    nextReviewAt: nextReviewTime(status, reviewCount),
    reviewCount,
    source: entry.source,
    target: entry.target,
    gloss: entry.gloss,
    difficulty: entry.difficulty,
  };
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

async function recordExposures(entries: WordFeedbackInput[]): Promise<void> {
  const { stats } = await readState();
  const unique = new Map(entries.map((entry) => [entry.target.toLowerCase(), entry]));
  for (const [key, entry] of unique) {
    const previous = stats[key];
    stats[key] = {
      ...previous,
      exposures: (previous?.exposures ?? 0) + 1,
      updatedAt: Date.now(),
      firstSeenAt: previous?.firstSeenAt ?? Date.now(),
      lastSeenAt: Date.now(),
      source: entry.source,
      target: entry.target,
      gloss: entry.gloss,
      difficulty: entry.difficulty,
    };
  }
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

function sanitizeCustomEntry(
  entry: Omit<CustomLexiconEntry, "id" | "createdAt">,
): Omit<CustomLexiconEntry, "id" | "createdAt"> {
  const source = String(entry.source ?? "").trim();
  const target = String(entry.target ?? "").trim();
  const gloss = String(entry.gloss ?? source).trim();
  if (!source || !target) throw new Error("中文原文和英文表达不能为空");
  if (source.length > 40 || target.length > 80 || gloss.length > 120) throw new Error("自定义词条内容过长");
  return {
    source,
    target,
    gloss,
    level: Math.max(1, Math.min(6, Math.round(Number(entry.level) || 3))),
  };
}

async function addCustomEntry(
  raw: Omit<CustomLexiconEntry, "id" | "createdAt">,
): Promise<CustomLexiconEntry[]> {
  const entry = sanitizeCustomEntry(raw);
  const { customLexicon } = await readState();
  const next = customLexicon.filter((item) => item.source !== entry.source);
  next.unshift({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  if (next.length > 500) next.length = 500;
  await chrome.storage.local.set({ [CUSTOM_LEXICON_KEY]: next });
  await notifyActiveTab();
  return next;
}

async function exportData(): Promise<ExportedData> {
  const { settings, stats, customLexicon } = await readState();
  const { apiKey: _apiKey, ...provider } = settings.provider;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...settings, provider },
    stats,
    customLexicon,
  };
}

async function importData(payload: unknown): Promise<void> {
  if (!payload || typeof payload !== "object") throw new Error("备份文件格式无效");
  const data = payload as Partial<ExportedData>;
  if (data.schemaVersion !== 1 || !data.settings || !data.stats || !Array.isArray(data.customLexicon)) {
    throw new Error("不支持的备份文件版本");
  }
  const current = await readState();
  const settings = normalizeSettings({
    ...data.settings,
    provider: {
      ...current.settings.provider,
      ...data.settings.provider,
      apiKey: current.settings.provider.apiKey,
    },
  });
  const stats = Object.fromEntries(
    Object.entries(data.stats).filter(([, value]) => Boolean(value) && typeof value === "object"),
  ) as LearningStats;
  const customLexicon = data.customLexicon.slice(0, 500).map((entry) => ({
    ...sanitizeCustomEntry(entry),
    id: String(entry.id || crypto.randomUUID()),
    createdAt: Number(entry.createdAt) || Date.now(),
  }));
  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings,
    [STATS_KEY]: stats,
    [CUSTOM_LEXICON_KEY]: customLexicon,
  });
  await notifyActiveTab();
}

async function notifyActiveTab(): Promise<void> {
  try {
    const tab = await activeTab();
    await chrome.tabs.sendMessage(tab.id!, { type: "SETTINGS_UPDATED" } satisfies RuntimeMessage);
  } catch {
    // The page may not have a content script yet.
  }
}

async function handleMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
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
        const response = await chrome.tabs.sendMessage(tab.id!, { type: "PING" } satisfies RuntimeMessage);
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
      await updateWordFeedback(message.entry, message.status);
      return { ok: true };
    case "RECORD_EXPOSURES":
      await recordExposures(message.entries);
      return { ok: true };
    case "DELETE_WORD": {
      const { stats } = await readState();
      delete stats[message.word.toLowerCase()];
      await chrome.storage.local.set({ [STATS_KEY]: stats });
      return { ok: true };
    }
    case "CLEAR_LEARNING_DATA":
      await chrome.storage.local.set({ [STATS_KEY]: {} });
      return { ok: true };
    case "CLEAR_AI_CACHE":
      await chrome.storage.local.remove([AI_CACHE_KEY, AI_DIAGNOSTICS_KEY]);
      return { ok: true };
    case "ADD_CUSTOM_LEXICON_ENTRY":
      return { ok: true, data: await addCustomEntry(message.entry) };
    case "DELETE_CUSTOM_LEXICON_ENTRY": {
      const { customLexicon } = await readState();
      const next = customLexicon.filter((entry) => entry.id !== message.id);
      await chrome.storage.local.set({ [CUSTOM_LEXICON_KEY]: next });
      await notifyActiveTab();
      return { ok: true, data: next };
    }
    case "EXPORT_DATA":
      return { ok: true, data: await exportData() };
    case "IMPORT_DATA":
      await importData(message.payload);
      return { ok: true };
    default:
      return { ok: false, error: "未知消息" };
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void readState().then(async ({ settings }) => {
    for (const origin of settings.autoSites) {
      try {
        await registerAutoSite(origin);
      } catch {
        // Missing permissions are handled next time the user opens the popup.
      }
    }
  });
});
