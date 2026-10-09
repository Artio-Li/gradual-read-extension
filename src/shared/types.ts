import type { CefrLevel } from "./cefr";

export type Intensity = "gentle" | "balanced" | "immersive";
export type DisplayMode = "mixed" | "bilingual" | "original";
export type ProviderMode = "local" | "hybrid";
export type ProviderPreset = "deepseek" | "ollama" | "custom";
export type FeedbackStatus = "known" | "hard";

export interface ProviderSettings {
  mode: ProviderMode;
  preset: ProviderPreset;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export interface ExtensionSettings {
  cefrLevel: CefrLevel;
  intensity: Intensity;
  displayMode: DisplayMode;
  autoSites: string[];
  provider: ProviderSettings;
}

export interface CustomLexiconEntry {
  id: string;
  source: string;
  target: string;
  gloss: string;
  level: number;
  createdAt: number;
}

export interface WordStat {
  exposures: number;
  status?: FeedbackStatus;
  updatedAt: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  nextReviewAt?: number;
  reviewCount?: number;
  source?: string;
  target?: string;
  gloss?: string;
  difficulty?: number;
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

export interface AiDiagnostics {
  timestamp: number;
  durationMs: number;
  cacheHit: boolean;
  inputCount: number;
  replacementCount: number;
  provider: string;
  status: "success" | "error";
  message?: string;
}

export interface ExtensionState {
  settings: ExtensionSettings;
  stats: LearningStats;
  customLexicon: CustomLexiconEntry[];
  aiDiagnostics: AiDiagnostics | null;
}

export interface WordFeedbackInput {
  source: string;
  target: string;
  gloss: string;
  difficulty: number;
}

export interface ExportedData {
  schemaVersion: 1;
  exportedAt: string;
  settings: Omit<ExtensionSettings, "provider"> & {
    provider: Omit<ProviderSettings, "apiKey">;
  };
  stats: LearningStats;
  customLexicon: CustomLexiconEntry[];
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
  | { type: "UPDATE_WORD_FEEDBACK"; entry: WordFeedbackInput; status: FeedbackStatus }
  | { type: "RECORD_EXPOSURES"; entries: WordFeedbackInput[] }
  | { type: "DELETE_WORD"; word: string }
  | { type: "CLEAR_LEARNING_DATA" }
  | { type: "CLEAR_AI_CACHE" }
  | { type: "ADD_CUSTOM_LEXICON_ENTRY"; entry: Omit<CustomLexiconEntry, "id" | "createdAt"> }
  | { type: "DELETE_CUSTOM_LEXICON_ENTRY"; id: string }
  | { type: "EXPORT_DATA" }
  | { type: "IMPORT_DATA"; payload: unknown }
  | { type: "PING" }
  | { type: "TOGGLE_ENHANCEMENT" }
  | { type: "SETTINGS_UPDATED" };

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
