import type {
  DisplayMode,
  ExtensionSettings,
  Intensity,
  LearningStats,
  ProviderMode,
} from "./types";
import { isCefrLevel, legacyLevelToCefr } from "./cefr";

export const SETTINGS_KEY = "gradualReadSettings";
export const STATS_KEY = "gradualReadStats";
export const AI_CACHE_KEY = "gradualReadAiCache";

const LEGACY_SETTINGS_KEY = "linguaWeaveSettings";
const LEGACY_STATS_KEY = "linguaWeaveStats";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  cefrLevel: "B1",
  intensity: "gentle",
  displayMode: "mixed",
  autoSites: [],
  provider: {
    mode: "local",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    apiKey: "",
  },
};

const INTENSITIES = new Set<Intensity>(["gentle", "balanced", "immersive"]);
const DISPLAY_MODES = new Set<DisplayMode>(["mixed", "bilingual", "original"]);
const PROVIDER_MODES = new Set<ProviderMode>(["local", "hybrid"]);

type SettingsInput = Partial<ExtensionSettings> & { level?: number };

export function normalizeSettings(input?: SettingsInput): ExtensionSettings {
  const provider = input?.provider ?? DEFAULT_SETTINGS.provider;
  const cefrLevel = isCefrLevel(input?.cefrLevel)
    ? input.cefrLevel
    : legacyLevelToCefr(input?.level);

  return {
    cefrLevel,
    intensity: INTENSITIES.has(input?.intensity as Intensity)
      ? (input?.intensity as Intensity)
      : DEFAULT_SETTINGS.intensity,
    displayMode: DISPLAY_MODES.has(input?.displayMode as DisplayMode)
      ? (input?.displayMode as DisplayMode)
      : DEFAULT_SETTINGS.displayMode,
    autoSites: Array.from(
      new Set((input?.autoSites ?? []).filter((site): site is string => typeof site === "string")),
    ),
    provider: {
      mode: PROVIDER_MODES.has(provider.mode as ProviderMode)
        ? (provider.mode as ProviderMode)
        : DEFAULT_SETTINGS.provider.mode,
      baseUrl: String(provider.baseUrl || DEFAULT_SETTINGS.provider.baseUrl).trim(),
      model: String(provider.model || DEFAULT_SETTINGS.provider.model).trim(),
      apiKey: String(provider.apiKey || "").trim(),
    },
  };
}

export async function readState(): Promise<{
  settings: ExtensionSettings;
  stats: LearningStats;
}> {
  const stored = await chrome.storage.local.get([
    SETTINGS_KEY,
    STATS_KEY,
    LEGACY_SETTINGS_KEY,
    LEGACY_STATS_KEY,
  ]);
  const settings = normalizeSettings(stored[SETTINGS_KEY] ?? stored[LEGACY_SETTINGS_KEY]);
  const stats = (stored[STATS_KEY] ?? stored[LEGACY_STATS_KEY] ?? {}) as LearningStats;
  if (!stored[SETTINGS_KEY] && stored[LEGACY_SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings, [STATS_KEY]: stats });
  }
  return {
    settings,
    stats,
  };
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const { settings } = await readState();
  const merged = normalizeSettings({
    ...settings,
    ...partial,
    provider: {
      ...settings.provider,
      ...(partial.provider ?? {}),
    },
  });
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}
