import assert from "node:assert/strict";
import test from "node:test";
import { createLocalReplacements, mergeReplacements, normalizeAiReplacements } from "../src/shared/engine";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/shared/settings";

test("local engine selects non-overlapping entries near the configured CEFR level", () => {
  const settings = { ...DEFAULT_SETTINGS, cefrLevel: "B1" as const, intensity: "balanced" as const };
  const replacements = createLocalReplacements(
    "这个浏览器插件可以改善用户体验，也能提高阅读效率。",
    settings,
  );
  assert.ok(replacements.length >= 1);
  assert.ok(replacements.every((item, index) => index === 0 || replacements[index - 1].end <= item.start));
  assert.ok(replacements.every((item) => item.origin === "local"));
});

test("AI replacements must reference exact source text", () => {
  const text = "这个方法可以改善阅读体验。";
  const replacements = normalizeAiReplacements(text, [
    { source: "改善", target: "improve", gloss: "改善", difficulty: 3 },
    { source: "不存在", target: "missing", gloss: "不存在", difficulty: 2 },
  ]);
  assert.equal(replacements.length, 1);
  assert.equal(text.slice(replacements[0].start, replacements[0].end), "改善");
});

test("AI replacements cannot overlap local replacements", () => {
  const local = [
    { start: 0, end: 4, source: "用户体验", target: "user experience", gloss: "用户体验", difficulty: 4, origin: "local" as const },
  ];
  const ai = [
    { start: 2, end: 4, source: "体验", target: "experience", gloss: "体验", difficulty: 2, origin: "ai" as const },
    { start: 5, end: 7, source: "改善", target: "improve", gloss: "改善", difficulty: 3, origin: "ai" as const },
  ];
  const merged = mergeReplacements(local, ai);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].source, "改善");
});

test("local engine prefers a complete phrase over adjacent word fragments", () => {
  const settings = { ...DEFAULT_SETTINGS, cefrLevel: "B2" as const, intensity: "immersive" as const };
  const replacements = createLocalReplacements("学习难度会逐渐增加。", settings);
  assert.ok(replacements.some((item) => item.source === "逐渐增加" && item.target === "gradually increase"));
  assert.ok(!replacements.some((item) => item.source === "逐渐" || item.source === "增加"));
});

test("legacy numeric levels migrate to CEFR and invalid enum values fall back", () => {
  const settings = normalizeSettings({ level: 99, intensity: "wrong" as never });
  assert.equal(settings.cefrLevel, "C2");
  assert.equal(settings.intensity, DEFAULT_SETTINGS.intensity);
});

test("CEFR A1 excludes vocabulary above the selected band", () => {
  const settings = { ...DEFAULT_SETTINGS, cefrLevel: "A1" as const, intensity: "immersive" as const };
  const replacements = createLocalReplacements("网站重视隐私，也提供复杂算法。", settings);
  assert.ok(replacements.some((item) => item.source === "网站"));
  assert.ok(!replacements.some((item) => ["隐私", "复杂", "算法"].includes(item.source)));
});
