import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const cefrPath = args.get("--cefrj");
const advancedPath = args.get("--advanced");
const dictionaryPath = args.get("--ecdict");
const outputPath = resolve(
  args.get("--output") ?? resolve(import.meta.dirname, "../src/shared/lexicon-cefrj.ts"),
);

if (!cefrPath || !dictionaryPath) {
  throw new Error(
    "Usage: node scripts/generate-cefr-lexicon.mjs --cefrj <cefrj.csv> [--advanced <c1c2.csv>] --ecdict <ecdict.csv> [--output <file>]",
  );
}

const LEVELS = new Map([
  ["A1", 1],
  ["A2", 2],
  ["B1", 3],
  ["B2", 4],
  ["C1", 5],
  ["C2", 6],
]);

const PER_LEVEL_LIMIT = 500;
const ALLOWED_PARTS_OF_SPEECH = new Set(["noun", "verb", "adjective", "adverb"]);
const BLOCKED_TARGETS = new Set([
  "are",
  "been",
  "being",
  "did",
  "does",
  "act",
  "address",
  "bear",
  "beat",
  "break",
  "call",
  "carry",
  "charge",
  "check",
  "close",
  "come",
  "cover",
  "cut",
  "draw",
  "drive",
  "drop",
  "fall",
  "field",
  "form",
  "get",
  "give",
  "got",
  "hand",
  "had",
  "has",
  "have",
  "head",
  "hit",
  "hold",
  "keep",
  "leave",
  "left",
  "lie",
  "line",
  "look",
  "make",
  "mean",
  "move",
  "open",
  "order",
  "pass",
  "pick",
  "place",
  "play",
  "point",
  "pull",
  "put",
  "raise",
  "record",
  "rest",
  "return",
  "right",
  "run",
  "set",
  "show",
  "stand",
  "state",
  "stop",
  "take",
  "turn",
  "watch",
  "way",
  "work",
  "was",
  "were",
]);
const BLOCKED_SOURCES = new Set([
  "一种",
  "一个",
  "一些",
  "东西",
  "事情",
  "事物",
  "某人",
  "某物",
  "其他",
  "表示",
  "用于",
  "具有",
  "关于",
  "等等",
  "英语",
  "人名",
  "地名",
  "姓氏",
  "名词",
  "动词",
  "形容词",
  "副词",
  "过去式",
  "过去分词",
  "现在分词",
  "第三人称",
]);

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  fields.push(value);
  return fields;
}

function normalizeEnglish(value) {
  return value.trim().toLowerCase();
}

function translationLinesForPartOfSpeech(translation, partOfSpeech) {
  const acceptedPrefixes = {
    noun: new Set(["n"]),
    verb: new Set(["v", "vi", "vt"]),
    adjective: new Set(["a", "adj", "s"]),
    adverb: new Set(["ad", "adv", "r"]),
  }[partOfSpeech];
  if (!acceptedPrefixes) return [];
  return translation.split(/\\n/).flatMap((line) => {
    const match = line.trim().match(/^([a-z]+)\.\s*(.*)$/i);
    if (!match || !acceptedPrefixes.has(match[1].toLowerCase())) return [];
    return match[2];
  });
}

function extractChineseCandidates(translation, partOfSpeech) {
  const cleaned = translationLinesForPartOfSpeech(translation, partOfSpeech)
    .join("；")
    .replace(/\[[^\]]*]/g, "；")
    .replace(/[（(][^）)]*[）)]/g, "；");
  const candidates = [];
  for (const segment of cleaned.split(/[;,，；、/]/)) {
    const matches = segment.match(/[\u3400-\u9fff]{2,8}/g) ?? [];
    for (let source of matches) {
      source = source
        .replace(/^(使得?|成为|表示|用于|关于)/, "")
        .replace(/(?:中一人|的一种|的一类|之一)$/, "");
      if (source.length < 2 || source.length > 5) continue;
      if (BLOCKED_SOURCES.has(source)) continue;
      if (/人名|地名|姓氏|词尾|前缀|后缀|过去式|分词|复数/.test(source)) continue;
      candidates.push(source);
    }
  }
  return [...new Set(candidates)].sort((left, right) => {
    const leftPenalty = left.length > 4 ? 4 : Math.abs(left.length - 2);
    const rightPenalty = right.length > 4 ? 4 : Math.abs(right.length - 2);
    return leftPenalty - rightPenalty || candidates.indexOf(left) - candidates.indexOf(right);
  });
}

function frequencyRank(row) {
  const values = [Number(row[8]), Number(row[9])].filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
}

const cefrTexts = [await readFile(resolve(cefrPath), "utf8")];
if (advancedPath) cefrTexts.push(await readFile(resolve(advancedPath), "utf8"));
const cefrByWord = new Map();
for (const cefrText of cefrTexts) {
  for (const line of cefrText.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const row = parseCsvLine(line);
    const word = normalizeEnglish(row[0] ?? "");
    const level = LEVELS.get(row[2]);
    const partOfSpeech = String(row[1] ?? "").trim().toLowerCase();
    if (
      !level ||
      !ALLOWED_PARTS_OF_SPEECH.has(partOfSpeech) ||
      word.length < 3 ||
      BLOCKED_TARGETS.has(word) ||
      !/^[a-z]+(?:[ '-][a-z]+){0,2}$/.test(word)
    ) continue;
    const profiles = cefrByWord.get(word) ?? [];
    if (!profiles.some((profile) => profile.level === level && profile.partOfSpeech === partOfSpeech)) {
      profiles.push({ level, partOfSpeech });
      cefrByWord.set(word, profiles);
    }
  }
}

const dictionaryText = await readFile(resolve(dictionaryPath), "utf8");
const candidates = [];
for (const line of dictionaryText.split(/\r?\n/).slice(1)) {
  if (!line) continue;
  const row = parseCsvLine(line);
  const target = normalizeEnglish(row[0] ?? "");
  const profiles = cefrByWord.get(target);
  if (!profiles) continue;
  for (const { level, partOfSpeech } of profiles) {
    const sources = extractChineseCandidates(row[3] ?? "", partOfSpeech);
    // Highly polysemous entries are unsafe for context-free page replacement.
    if (sources.length === 0 || sources.length > 3) continue;
    candidates.push({
      source: sources[0],
      target,
      gloss: sources[0],
      level,
      frequency: frequencyRank(row),
    });
  }
}

candidates.sort(
  (left, right) =>
    left.level - right.level ||
    left.frequency - right.frequency ||
    left.target.localeCompare(right.target),
);

const counts = new Map();
const usedSources = new Set();
const selected = [];
for (const entry of candidates) {
  if ((counts.get(entry.level) ?? 0) >= PER_LEVEL_LIMIT) continue;
  if (usedSources.has(entry.source)) continue;
  usedSources.add(entry.source);
  counts.set(entry.level, (counts.get(entry.level) ?? 0) + 1);
  selected.push(entry);
}

selected.sort(
  (left, right) =>
    right.source.length - left.source.length || left.level - right.level || left.source.localeCompare(right.source),
);

const lines = [
  'import type { LexiconEntry } from "./lexicon";',
  "",
  "// Generated by scripts/generate-cefr-lexicon.mjs.",
  "// CEFR levels: CEFR-J Vocabulary Profile v1.5, Tono Laboratory at TUFS.",
  "// C1/C2 levels: Octanove Vocabulary Profile v1.0, CC BY-SA 4.0.",
  "// Chinese translations: ECDICT, MIT License. See THIRD_PARTY_NOTICES.md.",
  "// Do not edit this file by hand.",
  "export const CEFR_J_LEXICON: LexiconEntry[] = [",
  ...selected.map(
    ({ source, target, gloss, level }) =>
      `  ${JSON.stringify({ source, target, gloss, level })},`,
  ),
  "];",
  "",
];

await writeFile(outputPath, lines.join("\n"), "utf8");
console.log(
  `Generated ${selected.length} entries at ${outputPath} (${[1, 2, 3, 4, 5, 6]
    .map((level) => `${["A1", "A2", "B1", "B2", "C1", "C2"][level - 1]}=${counts.get(level) ?? 0}`)
    .join(", ")})`,
);
