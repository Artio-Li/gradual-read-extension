import type { Intensity } from "./types";

export const AI_MAX_BATCH_ITEMS = 6;
export const AI_MAX_BATCH_CHARACTERS = 1_200;

const REPLACEMENTS_BY_INTENSITY: Record<Intensity, number> = {
  gentle: 2,
  balanced: 4,
  immersive: 7,
};

export function maxAiReplacements(intensity: Intensity): number {
  return REPLACEMENTS_BY_INTENSITY[intensity];
}

export function createAiBatches<T extends { text: string }>(
  items: T[],
  options: { maxItems?: number; maxCharacters?: number } = {},
): T[][] {
  const maxItems = Math.max(1, options.maxItems ?? AI_MAX_BATCH_ITEMS);
  const maxCharacters = Math.max(1, options.maxCharacters ?? AI_MAX_BATCH_CHARACTERS);
  const batches: T[][] = [];
  let current: T[] = [];
  let characters = 0;

  for (const item of items) {
    const nextLength = item.text.length;
    if (
      current.length > 0 &&
      (current.length >= maxItems || characters + nextLength > maxCharacters)
    ) {
      batches.push(current);
      current = [];
      characters = 0;
    }
    current.push(item);
    characters += nextLength;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function aiOutputTokenBudget(itemCount: number, intensity: Intensity): number {
  const estimated = 320 + itemCount * maxAiReplacements(intensity) * 56;
  return Math.max(768, Math.min(4_096, estimated));
}
