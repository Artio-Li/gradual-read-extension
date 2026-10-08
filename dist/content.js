"use strict";
(() => {
  // src/shared/lexicon.ts
  var LOCAL_LEXICON = [
    { source: "\u4E0D\u53EF\u6216\u7F3A", target: "indispensable", gloss: "\u4E0D\u53EF\u7F3A\u5C11\u7684", level: 6 },
    { source: "\u9519\u7EFC\u590D\u6742", target: "intricate", gloss: "\u590D\u6742\u4E14\u76F8\u4E92\u5173\u8054\u7684", level: 6 },
    { source: "\u7EC6\u81F4\u5165\u5FAE", target: "nuanced", gloss: "\u7EC6\u817B\u4E14\u6709\u5C42\u6B21\u7684", level: 6 },
    { source: "\u6A21\u68F1\u4E24\u53EF", target: "ambiguous", gloss: "\u542B\u4E49\u4E0D\u660E\u786E\u7684", level: 6 },
    { source: "\u4EBA\u5DE5\u667A\u80FD", target: "artificial intelligence", gloss: "\u4EBA\u5DE5\u667A\u80FD", level: 3 },
    { source: "\u9010\u6E10\u589E\u52A0", target: "gradually increase", gloss: "\u9010\u6E10\u589E\u52A0", level: 4 },
    { source: "\u673A\u5668\u5B66\u4E60", target: "machine learning", gloss: "\u673A\u5668\u5B66\u4E60", level: 4 },
    { source: "\u6DF1\u5EA6\u5B66\u4E60", target: "deep learning", gloss: "\u6DF1\u5EA6\u5B66\u4E60", level: 5 },
    { source: "\u7528\u6237\u4F53\u9A8C", target: "user experience", gloss: "\u7528\u6237\u4F53\u9A8C", level: 4 },
    { source: "\u89E3\u51B3\u65B9\u6848", target: "solution", gloss: "\u89E3\u51B3\u65B9\u6848", level: 3 },
    { source: "\u64CD\u4F5C\u7CFB\u7EDF", target: "operating system", gloss: "\u64CD\u4F5C\u7CFB\u7EDF", level: 3 },
    { source: "\u6570\u636E\u5E93", target: "database", gloss: "\u6570\u636E\u5E93", level: 3 },
    { source: "\u6D4F\u89C8\u5668", target: "browser", gloss: "\u6D4F\u89C8\u5668", level: 2 },
    { source: "\u670D\u52A1\u5668", target: "server", gloss: "\u670D\u52A1\u5668", level: 2 },
    { source: "\u5F00\u53D1\u8005", target: "developer", gloss: "\u5F00\u53D1\u8005", level: 3 },
    { source: "\u5E94\u7528\u7A0B\u5E8F", target: "application", gloss: "\u5E94\u7528\u7A0B\u5E8F", level: 3 },
    { source: "\u6E90\u4EE3\u7801", target: "source code", gloss: "\u6E90\u4EE3\u7801", level: 3 },
    { source: "\u5F00\u6E90", target: "open source", gloss: "\u5F00\u6E90", level: 3 },
    { source: "\u529F\u80FD", target: "feature", gloss: "\u529F\u80FD", level: 2 },
    { source: "\u6027\u80FD", target: "performance", gloss: "\u6027\u80FD", level: 4 },
    { source: "\u5B89\u5168", target: "security", gloss: "\u5B89\u5168", level: 3 },
    { source: "\u9690\u79C1", target: "privacy", gloss: "\u9690\u79C1", level: 3 },
    { source: "\u6570\u636E", target: "data", gloss: "\u6570\u636E", level: 1 },
    { source: "\u7F51\u7EDC", target: "network", gloss: "\u7F51\u7EDC", level: 2 },
    { source: "\u6A21\u578B", target: "model", gloss: "\u6A21\u578B", level: 2 },
    { source: "\u7B97\u6CD5", target: "algorithm", gloss: "\u7B97\u6CD5", level: 4 },
    { source: "\u5DE5\u5177", target: "tool", gloss: "\u5DE5\u5177", level: 1 },
    { source: "\u9879\u76EE", target: "project", gloss: "\u9879\u76EE", level: 2 },
    { source: "\u4EA7\u54C1", target: "product", gloss: "\u4EA7\u54C1", level: 2 },
    { source: "\u670D\u52A1", target: "service", gloss: "\u670D\u52A1", level: 2 },
    { source: "\u8BBE\u8BA1", target: "design", gloss: "\u8BBE\u8BA1", level: 2 },
    { source: "\u7CFB\u7EDF", target: "system", gloss: "\u7CFB\u7EDF", level: 2 },
    { source: "\u6280\u672F", target: "technology", gloss: "\u6280\u672F", level: 3 },
    { source: "\u6548\u7387", target: "efficiency", gloss: "\u6548\u7387", level: 4 },
    { source: "\u8D28\u91CF", target: "quality", gloss: "\u8D28\u91CF", level: 3 },
    { source: "\u73AF\u5883", target: "environment", gloss: "\u73AF\u5883", level: 3 },
    { source: "\u5185\u5BB9", target: "content", gloss: "\u5185\u5BB9", level: 2 },
    { source: "\u4E0A\u4E0B\u6587", target: "context", gloss: "\u4E0A\u4E0B\u6587", level: 4 },
    { source: "\u8BED\u8A00", target: "language", gloss: "\u8BED\u8A00", level: 2 },
    { source: "\u5B66\u4E60", target: "learning", gloss: "\u5B66\u4E60", level: 2 },
    { source: "\u7406\u89E3", target: "understand", gloss: "\u7406\u89E3", level: 2 },
    { source: "\u9605\u8BFB", target: "reading", gloss: "\u9605\u8BFB", level: 2 },
    { source: "\u9009\u62E9", target: "choose", gloss: "\u9009\u62E9", level: 2 },
    { source: "\u652F\u6301", target: "support", gloss: "\u652F\u6301", level: 2 },
    { source: "\u63D0\u4F9B", target: "provide", gloss: "\u63D0\u4F9B", level: 2 },
    { source: "\u521B\u5EFA", target: "create", gloss: "\u521B\u5EFA", level: 2 },
    { source: "\u589E\u52A0", target: "increase", gloss: "\u589E\u52A0", level: 3 },
    { source: "\u51CF\u5C11", target: "reduce", gloss: "\u51CF\u5C11", level: 3 },
    { source: "\u6539\u5584", target: "improve", gloss: "\u6539\u5584", level: 3 },
    { source: "\u5F71\u54CD", target: "impact", gloss: "\u5F71\u54CD", level: 3 },
    { source: "\u7ED3\u679C", target: "result", gloss: "\u7ED3\u679C", level: 2 },
    { source: "\u539F\u56E0", target: "reason", gloss: "\u539F\u56E0", level: 2 },
    { source: "\u95EE\u9898", target: "problem", gloss: "\u95EE\u9898", level: 2 },
    { source: "\u65B9\u6CD5", target: "approach", gloss: "\u65B9\u6CD5\u3001\u9014\u5F84", level: 4 },
    { source: "\u76EE\u6807", target: "goal", gloss: "\u76EE\u6807", level: 2 },
    { source: "\u8BA1\u5212", target: "plan", gloss: "\u8BA1\u5212", level: 1 },
    { source: "\u9700\u6C42", target: "requirement", gloss: "\u9700\u6C42", level: 4 },
    { source: "\u98CE\u9669", target: "risk", gloss: "\u98CE\u9669", level: 3 },
    { source: "\u673A\u4F1A", target: "opportunity", gloss: "\u673A\u4F1A", level: 4 },
    { source: "\u53D8\u5316", target: "change", gloss: "\u53D8\u5316", level: 2 },
    { source: "\u8FC7\u7A0B", target: "process", gloss: "\u8FC7\u7A0B", level: 3 },
    { source: "\u5173\u952E", target: "essential", gloss: "\u5173\u952E\u7684", level: 5 },
    { source: "\u91CD\u8981", target: "important", gloss: "\u91CD\u8981\u7684", level: 2 },
    { source: "\u590D\u6742", target: "complex", gloss: "\u590D\u6742\u7684", level: 3 },
    { source: "\u7B80\u5355", target: "simple", gloss: "\u7B80\u5355\u7684", level: 1 },
    { source: "\u7A33\u5B9A", target: "stable", gloss: "\u7A33\u5B9A\u7684", level: 3 },
    { source: "\u7075\u6D3B", target: "flexible", gloss: "\u7075\u6D3B\u7684", level: 4 },
    { source: "\u53EF\u9760", target: "reliable", gloss: "\u53EF\u9760\u7684", level: 4 },
    { source: "\u5F53\u524D", target: "current", gloss: "\u5F53\u524D\u7684", level: 2 },
    { source: "\u672A\u6765", target: "future", gloss: "\u672A\u6765", level: 2 },
    { source: "\u901A\u5E38", target: "usually", gloss: "\u901A\u5E38", level: 2 },
    { source: "\u53EF\u80FD", target: "potentially", gloss: "\u53EF\u80FD\u5730", level: 5 },
    { source: "\u7279\u522B", target: "particularly", gloss: "\u7279\u522B\u5730", level: 5 },
    { source: "\u9010\u6E10", target: "gradually", gloss: "\u9010\u6E10\u5730", level: 4 },
    { source: "\u51C6\u786E", target: "accurate", gloss: "\u51C6\u786E\u7684", level: 4 },
    { source: "\u81EA\u52A8", target: "automatically", gloss: "\u81EA\u52A8\u5730", level: 4 },
    { source: "\u514D\u8D39", target: "free", gloss: "\u514D\u8D39\u7684", level: 1 },
    { source: "\u7528\u6237", target: "user", gloss: "\u7528\u6237", level: 1 },
    { source: "\u7F51\u7AD9", target: "website", gloss: "\u7F51\u7AD9", level: 1 },
    { source: "\u9875\u9762", target: "page", gloss: "\u9875\u9762", level: 1 },
    { source: "\u6587\u672C", target: "text", gloss: "\u6587\u672C", level: 1 },
    { source: "\u5355\u8BCD", target: "word", gloss: "\u5355\u8BCD", level: 1 },
    { source: "\u77ED\u8BED", target: "phrase", gloss: "\u77ED\u8BED", level: 3 },
    { source: "\u53E5\u5B50", target: "sentence", gloss: "\u53E5\u5B50", level: 2 }
  ];

  // src/shared/cefr.ts
  var CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  function cefrRank(value) {
    return CEFR_LEVELS.indexOf(value) + 1;
  }

  // src/shared/engine.ts
  var LIMITS = {
    gentle: { density: 0.09, max: 2 },
    balanced: { density: 0.16, max: 4 },
    immersive: { density: 0.26, max: 7 }
  };
  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function findAll(text, needle) {
    const indexes = [];
    let cursor = 0;
    while (cursor < text.length) {
      const index = text.indexOf(needle, cursor);
      if (index === -1) break;
      indexes.push(index);
      cursor = index + needle.length;
    }
    return indexes;
  }
  function scoreEntry(entry, text, settings, stats) {
    const stat = stats[entry.target.toLowerCase()];
    const targetLevel = cefrRank(settings.cefrLevel);
    const levelDistance = Math.abs(entry.level - targetLevel);
    const feedbackPenalty = stat?.status === "known" ? 8 : stat?.status === "hard" ? 3 : 0;
    const exposurePenalty = Math.min(5, stat?.exposures ?? 0) * 0.4;
    const deterministicNoise = stableHash(`${text}:${entry.source}`) % 100 / 100;
    return 12 - levelDistance * 2 - feedbackPenalty - exposurePenalty + deterministicNoise;
  }
  function createLocalReplacements(text, settings, stats = {}) {
    const policy = LIMITS[settings.intensity];
    const candidateLimit = Math.max(1, Math.min(policy.max, Math.ceil(text.length * policy.density / 3)));
    const allCandidates = LOCAL_LEXICON.filter(
      (entry) => entry.level <= cefrRank(settings.cefrLevel) && text.includes(entry.source)
    ).sort((left, right) => {
      if (right.source.length !== left.source.length) return right.source.length - left.source.length;
      return scoreEntry(right, text, settings, stats) - scoreEntry(left, text, settings, stats);
    }).flatMap(
      (entry) => findAll(text, entry.source).map((start) => ({
        entry,
        start,
        score: scoreEntry(entry, text, settings, stats)
      }))
    );
    const candidates = allCandidates.filter((candidate) => {
      const end = candidate.start + candidate.entry.source.length;
      return !allCandidates.some((other) => {
        if (other.entry.source.length <= candidate.entry.source.length) return false;
        const otherEnd = other.start + other.entry.source.length;
        return other.start <= candidate.start && otherEnd >= end;
      });
    }).sort((left, right) => right.score - left.score || left.start - right.start);
    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= candidateLimit) break;
      const end = candidate.start + candidate.entry.source.length;
      const overlaps = selected.some(
        (replacement) => candidate.start < replacement.end && end > replacement.start
      );
      if (overlaps) continue;
      selected.push({
        start: candidate.start,
        end,
        source: candidate.entry.source,
        target: candidate.entry.target,
        gloss: candidate.entry.gloss,
        difficulty: candidate.entry.level,
        origin: "local"
      });
    }
    return selected.sort((left, right) => left.start - right.start);
  }
  function normalizeAiReplacements(text, raw, existing = []) {
    if (!Array.isArray(raw)) return [];
    const accepted = [];
    for (const value of raw.slice(0, 12)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value;
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
        (replacement) => start < replacement.end && end > replacement.start
      );
      if (overlaps) continue;
      accepted.push({
        start,
        end,
        source,
        target,
        gloss,
        difficulty: Math.max(1, Math.min(10, Math.round(Number(candidate.difficulty) || 3))),
        origin: "ai"
      });
    }
    return accepted.sort((left, right) => left.start - right.start);
  }
  function mergeReplacements(local, ai) {
    const merged = [...local];
    for (const candidate of ai) {
      if (merged.some(
        (replacement) => candidate.start < replacement.end && candidate.end > replacement.start
      )) {
        continue;
      }
      merged.push(candidate);
    }
    return merged.sort((left, right) => left.start - right.start);
  }

  // src/content/index.ts
  function formatMeaning(source, gloss) {
    const normalizedSource = source.trim();
    const normalizedGloss = gloss.trim();
    if (!normalizedGloss || normalizedGloss === normalizedSource) return normalizedSource;
    return `${normalizedSource} \xB7 ${normalizedGloss}`;
  }
  var EXCLUDED_SELECTOR = [
    "script",
    "style",
    "noscript",
    "code",
    "pre",
    "textarea",
    "input",
    "select",
    "option",
    "button",
    "svg",
    "canvas",
    "iframe",
    "[contenteditable='true']",
    "[role='textbox']",
    "[data-gradual-read-node]",
    "#gradual-read-card-host"
  ].join(",");
  var GradualReadController = class {
    active = false;
    processing = false;
    counter = 0;
    observer = null;
    scanTimer = null;
    processed = /* @__PURE__ */ new Map();
    settings = null;
    stats = {};
    cardHost = null;
    constructor() {
      document.addEventListener("click", this.onDocumentClick, true);
      window.addEventListener("scroll", this.onScroll, { passive: true });
    }
    async initialize() {
      const state = await this.getState();
      this.settings = state.settings;
      this.stats = state.stats;
      if (state.settings.autoSites.includes(location.origin)) await this.start();
    }
    getStatus() {
      return { active: this.active, processed: this.processed.size };
    }
    async toggle() {
      if (this.active) this.restore();
      else await this.start();
      return { active: this.active };
    }
    async refreshSettings() {
      const state = await this.getState();
      this.settings = state.settings;
      this.stats = state.stats;
      if (this.active) {
        this.restore();
        if (state.settings.displayMode !== "original") await this.start();
      }
    }
    async getState() {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!response.ok || !response.data) throw new Error(response.error || "\u65E0\u6CD5\u8BFB\u53D6\u8BBE\u7F6E");
      return response.data;
    }
    async start() {
      if (!this.settings) {
        const state = await this.getState();
        this.settings = state.settings;
        this.stats = state.stats;
      }
      if (this.settings.displayMode === "original") return;
      this.active = true;
      this.observe();
      await this.scan();
    }
    restore() {
      this.active = false;
      this.observer?.disconnect();
      this.observer = null;
      if (this.scanTimer !== null) window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
      for (const { wrapper, original } of this.processed.values()) {
        if (wrapper.isConnected) wrapper.replaceWith(document.createTextNode(original));
      }
      this.processed.clear();
      this.hideCard();
    }
    observe() {
      this.observer?.disconnect();
      this.observer = new MutationObserver((mutations) => {
        if (!this.active) return;
        if (mutations.some(
          (mutation) => Array.from(mutation.addedNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE
          )
        )) {
          this.scheduleScan();
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
    scheduleScan() {
      if (this.scanTimer !== null) window.clearTimeout(this.scanTimer);
      this.scanTimer = window.setTimeout(() => {
        this.scanTimer = null;
        void this.scan();
      }, 350);
    }
    onScroll = () => {
      if (this.active) this.scheduleScan();
    };
    isEligible(node) {
      const text = node.textContent?.trim() ?? "";
      if (text.length < 8 || text.length > 600 || !/[\u3400-\u9fff]/.test(text)) return false;
      const parent = node.parentElement;
      if (!parent || parent.closest(EXCLUDED_SELECTOR)) return false;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = parent.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom >= -500 && rect.top <= innerHeight + 500;
    }
    collectNodes() {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => this.isEligible(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      const nodes = [];
      let current;
      while ((current = walker.nextNode()) && nodes.length < 48) nodes.push(current);
      return nodes;
    }
    async scan() {
      if (!this.active || this.processing || !this.settings) return;
      this.processing = true;
      try {
        const nodes = this.collectNodes();
        for (let offset = 0; offset < nodes.length; offset += 12) {
          if (!this.active) break;
          await this.processBatch(nodes.slice(offset, offset + 12));
        }
      } finally {
        this.processing = false;
      }
    }
    async processBatch(nodes) {
      if (!this.settings) return;
      const entries = nodes.map((node) => ({
        id: `node-${Date.now().toString(36)}-${this.counter++}`,
        node,
        text: node.textContent ?? ""
      }));
      const items = entries.map(({ id, text }) => ({ id, text }));
      let aiItems = [];
      if (this.settings.provider.mode === "hybrid") {
        try {
          const response = await chrome.runtime.sendMessage({
            type: "ENHANCE_BATCH",
            items
          });
          if (response.ok && response.data) aiItems = response.data;
        } catch {
        }
      }
      const exposedWords = [];
      for (const entry of entries) {
        if (!entry.node.isConnected || entry.node.textContent !== entry.text) continue;
        const local = createLocalReplacements(entry.text, this.settings, this.stats);
        const rawAi = aiItems.find((item) => item.id === entry.id)?.replacements ?? [];
        const ai = normalizeAiReplacements(entry.text, rawAi, local);
        const replacements = mergeReplacements(local, ai);
        if (replacements.length === 0) continue;
        replacements.forEach((replacement) => exposedWords.push(replacement.target));
        this.apply(entry.id, entry.node, entry.text, replacements);
      }
      if (exposedWords.length > 0) {
        void chrome.runtime.sendMessage({
          type: "RECORD_EXPOSURES",
          words: exposedWords
        });
      }
    }
    buildEnhancedFragment(text, replacements) {
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const replacement of replacements) {
        if (replacement.start > cursor) fragment.append(document.createTextNode(text.slice(cursor, replacement.start)));
        const word = document.createElement("span");
        word.className = "gradual-read-word";
        word.textContent = replacement.target;
        word.dataset.source = replacement.source;
        word.dataset.gloss = replacement.gloss;
        word.dataset.meaning = formatMeaning(replacement.source, replacement.gloss);
        word.dataset.difficulty = String(replacement.difficulty);
        word.dataset.origin = replacement.origin;
        word.tabIndex = 0;
        fragment.append(word);
        cursor = replacement.end;
      }
      if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
      return fragment;
    }
    apply(id, node, original, replacements) {
      if (!this.settings) return;
      const wrapper = document.createElement("span");
      wrapper.dataset.gradualReadNode = id;
      wrapper.className = `gradual-read-wrapper gradual-read-${this.settings.displayMode}`;
      if (this.settings.displayMode === "bilingual") {
        const originalLine = document.createElement("span");
        originalLine.className = "gradual-read-original-line";
        originalLine.textContent = original;
        const enhancedLine = document.createElement("span");
        enhancedLine.className = "gradual-read-enhanced-line";
        enhancedLine.append(this.buildEnhancedFragment(original, replacements));
        wrapper.append(originalLine, enhancedLine);
      } else {
        wrapper.append(this.buildEnhancedFragment(original, replacements));
      }
      node.replaceWith(wrapper);
      this.processed.set(id, { wrapper, original });
    }
    onDocumentClick = (event) => {
      const target = event.target;
      if (target instanceof Element) {
        const word = target.closest(".gradual-read-word");
        if (word) {
          event.stopPropagation();
          this.showCard(word);
          return;
        }
        if (!target.closest("#gradual-read-card-host")) this.hideCard();
      }
    };
    showCard(word) {
      this.hideCard();
      const host = document.createElement("div");
      host.id = "gradual-read-card-host";
      const shadow = host.attachShadow({ mode: "open" });
      const rect = word.getBoundingClientRect();
      host.style.left = `${Math.max(12, Math.min(innerWidth - 286, rect.left))}px`;
      host.style.top = `${Math.min(innerHeight - 150, rect.bottom + 8)}px`;
      const style = document.createElement("style");
      style.textContent = `
      :host { position: fixed; z-index: 2147483647; }
      .card { width: 250px; padding: 14px; color: #eef7f1; background: #13221c; border: 1px solid #375346; border-radius: 14px; box-shadow: 0 18px 48px rgba(0,0,0,.28); font: 13px/1.45 system-ui,sans-serif; }
      .target { color: #e6c879; font: 600 18px/1.2 Georgia,serif; }
      .source { margin-top: 5px; color: #a9bcb2; }
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      button { flex: 1; border: 1px solid #4d695b; border-radius: 9px; padding: 7px 9px; color: #eaf3ed; background: #20352b; cursor: pointer; }
      button:hover { border-color: #d7bb6a; color: #f7dda0; }
    `;
      const card = document.createElement("div");
      card.className = "card";
      const target = document.createElement("div");
      target.className = "target";
      target.textContent = word.textContent ?? "";
      const source = document.createElement("div");
      source.className = "source";
      source.textContent = word.dataset.meaning ?? word.dataset.source ?? "";
      const actions = document.createElement("div");
      actions.className = "actions";
      for (const [label, status] of [
        ["\u8BA4\u8BC6", "known"],
        ["\u592A\u96BE", "hard"]
      ]) {
        const button = document.createElement("button");
        button.textContent = label;
        button.addEventListener("click", () => {
          void chrome.runtime.sendMessage({
            type: "UPDATE_WORD_FEEDBACK",
            word: word.textContent ?? "",
            status
          });
          this.hideCard();
        });
        actions.append(button);
      }
      card.append(target, source, actions);
      shadow.append(style, card);
      document.documentElement.append(host);
      this.cardHost = host;
    }
    hideCard() {
      this.cardHost?.remove();
      this.cardHost = null;
    }
  };
  if (!window.__gradualReadLoaded) {
    window.__gradualReadLoaded = true;
    const controller = new GradualReadController();
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "PING") {
        sendResponse({ ok: true, data: controller.getStatus() });
        return false;
      }
      if (message.type === "TOGGLE_ENHANCEMENT") {
        void controller.toggle().then((data) => sendResponse({ ok: true, data })).catch(
          (error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
        );
        return true;
      }
      if (message.type === "SETTINGS_UPDATED") {
        void controller.refreshSettings();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });
    void controller.initialize();
  }
})();
//# sourceMappingURL=content.js.map
