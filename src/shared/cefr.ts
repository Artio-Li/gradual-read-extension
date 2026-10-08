export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_OPTIONS: ReadonlyArray<{ value: CefrLevel; label: string }> = [
  { value: "A1", label: "A1 · 入门" },
  { value: "A2", label: "A2 · 基础" },
  { value: "B1", label: "B1 · 中级" },
  { value: "B2", label: "B2 · 中高级" },
  { value: "C1", label: "C1 · 高级" },
  { value: "C2", label: "C2 · 熟练" },
];

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && CEFR_LEVELS.includes(value as CefrLevel);
}

export function cefrRank(value: CefrLevel): number {
  return CEFR_LEVELS.indexOf(value) + 1;
}

export function legacyLevelToCefr(value: unknown): CefrLevel {
  const level = Math.max(1, Math.min(6, Math.round(Number(value) || 3)));
  return CEFR_LEVELS[level - 1];
}
