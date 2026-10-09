import { LOCAL_LEXICON, type LexiconEntry } from "./lexicon";
import { cefrRank } from "./cefr";
import type { CustomLexiconEntry, ExtensionSettings, LearningStats, Replacement } from "./types";

const LIMITS = {
  gentle: { density: 0.09, max: 2 },
  balanced: { density: 0.16, max: 4 },
  immersive: { density: 0.26, max: 7 },
} as const;

export function replacementLimitForText(
  text: string,
  intensity: ExtensionSettings["intensity"],
): number {
  const policy = LIMITS[intensity];
  return Math.max(1, Math.min(policy.max, Math.ceil((text.length * policy.density) / 3)));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function findAll(text: string, needle: string): number[] {
  const indexes: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(needle, cursor);
    if (index === -1) break;
    indexes.push(index);
    cursor = index + needle.length;
  }
  return indexes;
}

function scoreEntry(
  entry: LexiconEntry,
  text: string,
  settings: ExtensionSettings,
  stats: LearningStats,
): number {
  const stat = stats[entry.target.toLowerCase()];
  const targetLevel = cefrRank(settings.cefrLevel);
  const levelDistance = Math.abs(entry.level - targetLevel);
  const waitingForReview = Boolean(stat?.nextReviewAt && stat.nextReviewAt > Date.now());
  const feedbackPenalty = stat?.status === "known" && waitingForReview ? 8 : stat?.status === "hard" && waitingForReview ? 3 : 0;
  const exposurePenalty = Math.min(5, stat?.exposures ?? 0) * 0.4;
  const deterministicNoise = (stableHash(`${text}:${entry.source}`) % 100) / 100;
  return 12 - levelDistance * 2 - feedbackPenalty - exposurePenalty + deterministicNoise;
}

function availableLexicon(customLexicon: CustomLexiconEntry[]): LexiconEntry[] {
  if (customLexicon.length === 0) return LOCAL_LEXICON;
  const entries = new Map(LOCAL_LEXICON.map((entry) => [entry.source, entry]));
  for (const entry of customLexicon) {
    entries.set(entry.source, {
      source: entry.source,
      target: entry.target,
      gloss: entry.gloss,
      level: Math.max(1, Math.min(6, Math.round(entry.level))),
    });
  }
  return Array.from(entries.values());
}

export function createLocalReplacements(
  text: string,
  settings: ExtensionSettings,
  stats: LearningStats = {},
  customLexicon: CustomLexiconEntry[] = [],
): Replacement[] {
  const candidateLimit = replacementLimitForText(text, settings.intensity);
  const allCandidates = availableLexicon(customLexicon).filter(
    (entry) => entry.level <= cefrRank(settings.cefrLevel) && text.includes(entry.source),
  )
    .sort((left, right) => {
      if (right.source.length !== left.source.length) return right.source.length - left.source.length;
      return scoreEntry(right, text, settings, stats) - scoreEntry(left, text, settings, stats);
    })
    .flatMap((entry) =>
      findAll(text, entry.source).map((start) => ({
        entry,
        start,
        score: scoreEntry(entry, text, settings, stats),
      })),
    );

  const candidates = allCandidates
    .filter((candidate) => {
      const end = candidate.start + candidate.entry.source.length;
      return !allCandidates.some((other) => {
        if (other.entry.source.length <= candidate.entry.source.length) return false;
        const otherEnd = other.start + other.entry.source.length;
        return other.start <= candidate.start && otherEnd >= end;
      });
    })
    .sort((left, right) => right.score - left.score || left.start - right.start);

  const selected: Replacement[] = [];
  for (const candidate of candidates) {
    if (selected.length >= candidateLimit) break;
    const end = candidate.start + candidate.entry.source.length;
    const overlaps = selected.some(
      (replacement) => candidate.start < replacement.end && end > replacement.start,
    );
    if (overlaps) continue;
    selected.push({
      start: candidate.start,
      end,
      source: candidate.entry.source,
      target: candidate.entry.target,
      gloss: candidate.entry.gloss,
      difficulty: candidate.entry.level,
      origin: "local",
    });
  }

  return selected.sort((left, right) => left.start - right.start);
}

export function normalizeAiReplacements(
  text: string,
  raw: unknown,
  existing: Replacement[] = [],
): Replacement[] {
  if (!Array.isArray(raw)) return [];
  const accepted: Replacement[] = [];

  for (const value of raw.slice(0, 12)) {
    if (!value || typeof value !== "object") continue;
    const candidate = value as Record<string, unknown>;
    const source = String(candidate.source ?? "").trim();
    const target = String(candidate.target ?? "").trim();
    const gloss = String(candidate.gloss ?? source).trim();
    if (!source || !target || source === target || source.length > 80 || target.length > 120) continue;

    let start = Number(candidate.start);
    let end = Number(candidate.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || text.slice(start, end) !== source) {
      start = text.indexOf(source);
      end = start + source.length;
    }
    if (start < 0 || end <= start || text.slice(start, end) !== source) continue;

    const overlaps = [...existing, ...accepted].some(
      (replacement) => start < replacement.end && end > replacement.start,
    );
    if (overlaps) continue;

    accepted.push({
      start,
      end,
      source,
      target,
      gloss,
      difficulty: Math.max(1, Math.min(10, Math.round(Number(candidate.difficulty) || 3))),
      origin: "ai",
    });
  }

  return accepted.sort((left, right) => left.start - right.start);
}

export function mergeReplacements(
  local: Replacement[],
  ai: Replacement[],
): Replacement[] {
  const merged = [...local];
  for (const candidate of ai) {
    if (
      merged.some(
        (replacement) => candidate.start < replacement.end && candidate.end > replacement.start,
      )
    ) {
      continue;
    }
    merged.push(candidate);
  }
  return merged.sort((left, right) => left.start - right.start);
}
