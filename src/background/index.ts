import { enhanceWithProvider, testProvider } from "./provider";
import { readState, saveSettings, STATS_KEY } from "../shared/settings";
import type {
  ExtensionSettings,
  LearningStats,
  RuntimeMessage,
  RuntimeResponse,
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

async function updateWordFeedback(word: string, status: "known" | "hard"): Promise<void> {
  const { stats } = await readState();
  const key = word.toLowerCase();
  stats[key] = {
    exposures: stats[key]?.exposures ?? 0,
    status,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

async function recordExposures(words: string[]): Promise<void> {
  const { stats } = await readState();
  for (const word of new Set(words.map((value) => value.toLowerCase()))) {
    const previous = stats[word];
    stats[word] = {
      exposures: (previous?.exposures ?? 0) + 1,
      status: previous?.status,
      updatedAt: Date.now(),
    };
  }
  await chrome.storage.local.set({ [STATS_KEY]: stats });
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
      await updateWordFeedback(message.word, message.status);
      return { ok: true };
    case "RECORD_EXPOSURES":
      await recordExposures(message.words);
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
