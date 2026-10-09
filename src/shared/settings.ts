import type {
  DisplayMode,
  ExtensionSettings,
  Intensity,
  LearningStats,
  ProviderMode,
  ProviderPreset,
  CustomLexiconEntry,
  AiDiagnostics,
  ExtensionState,
} from "./types";
import { isCefrLevel, legacyLevelToCefr } from "./cefr";

export const SETTINGS_KEY = "gradualReadSettings";
export const STATS_KEY = "gradualReadStats";
export const AI_CACHE_KEY = "gradualReadAiCache";
export const CUSTOM_LEXICON_KEY = "gradualReadCustomLexicon";
export const AI_DIAGNOSTICS_KEY = "gradualReadAiDiagnostics";

const LEGACY_SETTINGS_KEY = "linguaWeaveSettings";
const LEGACY_STATS_KEY = "linguaWeaveStats";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  cefrLevel: "B1",
  intensity: "gentle",
  displayMode: "mixed",
  autoSites: [],
  provider: {
    mode: "local",
    preset: "ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    apiKey: "",
    timeoutMs: 18_000,
  },
};

const INTENSITIES = new Set<Intensity>(["gentle", "balanced", "immersive"]);
const DISPLAY_MODES = new Set<DisplayMode>(["mixed", "bilingual", "original"]);
const PROVIDER_MODES = new Set<ProviderMode>(["local", "hybrid"]);
const PROVIDER_PRESETS = new Set<ProviderPreset>(["deepseek", "ollama", "custom"]);

type SettingsInput = Partial<ExtensionSettings> & { level?: number };

function inferProviderPreset(baseUrl: string): ProviderPreset {
  if (/api\.deepseek\.com/i.test(baseUrl)) return "deepseek";
  if (/localhost:11434|127\.0\.0\.1:11434/i.test(baseUrl)) return "ollama";
  return "custom";
}

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
      preset: PROVIDER_PRESETS.has(provider.preset as ProviderPreset)
        ? (provider.preset as ProviderPreset)
        : inferProviderPreset(String(provider.baseUrl || DEFAULT_SETTINGS.provider.baseUrl)),
      baseUrl: String(provider.baseUrl || DEFAULT_SETTINGS.provider.baseUrl).trim(),
      model: String(provider.model || DEFAULT_SETTINGS.provider.model).trim(),
      apiKey: String(provider.apiKey || "").trim(),
      timeoutMs: Math.max(5_000, Math.min(60_000, Number(provider.timeoutMs) || DEFAULT_SETTINGS.provider.timeoutMs)),
    },
  };
}

export async function readState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get([
    SETTINGS_KEY,
    STATS_KEY,
    CUSTOM_LEXICON_KEY,
    AI_DIAGNOSTICS_KEY,
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
    customLexicon: Array.isArray(stored[CUSTOM_LEXICON_KEY])
      ? (stored[CUSTOM_LEXICON_KEY] as CustomLexiconEntry[])
      : [],
    aiDiagnostics: (stored[AI_DIAGNOSTICS_KEY] as AiDiagnostics | undefined) ?? null,
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
