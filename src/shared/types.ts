import type { CefrLevel } from "./cefr";

export type Intensity = "gentle" | "balanced" | "immersive";
export type DisplayMode = "mixed" | "bilingual" | "original";
export type ProviderMode = "local" | "hybrid";
export type FeedbackStatus = "known" | "hard";

export interface ProviderSettings {
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ExtensionSettings {
  cefrLevel: CefrLevel;
  intensity: Intensity;
  displayMode: DisplayMode;
  autoSites: string[];
  provider: ProviderSettings;
}

export interface WordStat {
  exposures: number;
  status?: FeedbackStatus;
  updatedAt: number;
}

export type LearningStats = Record<string, WordStat>;

export interface TextItem {
  id: string;
  text: string;
}

export interface Replacement {
  start: number;
  end: number;
  source: string;
  target: string;
  gloss: string;
  difficulty: number;
  origin: "local" | "ai";
}

export interface EnhancedItem {
  id: string;
  replacements: Replacement[];
}

export type RuntimeMessage =
  | { type: "GET_STATE" }
  | { type: "SAVE_SETTINGS"; settings: Partial<ExtensionSettings> }
  | { type: "TOGGLE_ACTIVE_TAB" }
  | { type: "GET_ACTIVE_TAB_STATUS" }
  | { type: "REGISTER_AUTO_SITE"; origin: string }
  | { type: "UNREGISTER_AUTO_SITE"; origin: string }
  | { type: "ENHANCE_BATCH"; items: TextItem[] }
  | { type: "TEST_PROVIDER" }
  | { type: "UPDATE_WORD_FEEDBACK"; word: string; status: FeedbackStatus }
  | { type: "RECORD_EXPOSURES"; words: string[] }
  | { type: "PING" }
  | { type: "TOGGLE_ENHANCEMENT" }
  | { type: "SETTINGS_UPDATED" };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
