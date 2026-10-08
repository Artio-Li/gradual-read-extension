import { createLocalReplacements, mergeReplacements, normalizeAiReplacements } from "../shared/engine";
import type {
  EnhancedItem,
  ExtensionSettings,
  LearningStats,
  Replacement,
  RuntimeMessage,
  RuntimeResponse,
  TextItem,
} from "../shared/types";

declare global {
  interface Window {
    __gradualReadLoaded?: boolean;
  }
}

interface ProcessedNode {
  wrapper: HTMLSpanElement;
  original: string;
}

function formatMeaning(source: string, gloss: string): string {
  const normalizedSource = source.trim();
  const normalizedGloss = gloss.trim();
  if (!normalizedGloss || normalizedGloss === normalizedSource) return normalizedSource;
  return `${normalizedSource} · ${normalizedGloss}`;
}

const EXCLUDED_SELECTOR = [
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
  "#gradual-read-card-host",
].join(",");

class GradualReadController {
  private active = false;
  private processing = false;
  private counter = 0;
  private observer: MutationObserver | null = null;
  private scanTimer: number | null = null;
  private processed = new Map<string, ProcessedNode>();
  private settings: ExtensionSettings | null = null;
  private stats: LearningStats = {};
  private cardHost: HTMLDivElement | null = null;

  constructor() {
    document.addEventListener("click", this.onDocumentClick, true);
    window.addEventListener("scroll", this.onScroll, { passive: true });
  }

  async initialize(): Promise<void> {
    const state = await this.getState();
    this.settings = state.settings;
    this.stats = state.stats;
    if (state.settings.autoSites.includes(location.origin)) await this.start();
  }

  getStatus(): { active: boolean; processed: number } {
    return { active: this.active, processed: this.processed.size };
  }

  async toggle(): Promise<{ active: boolean }> {
    if (this.active) this.restore();
    else await this.start();
    return { active: this.active };
  }

  async refreshSettings(): Promise<void> {
    const state = await this.getState();
    this.settings = state.settings;
    this.stats = state.stats;
    if (this.active) {
      this.restore();
      if (state.settings.displayMode !== "original") await this.start();
    }
  }

  private async getState(): Promise<{ settings: ExtensionSettings; stats: LearningStats }> {
    const response = (await chrome.runtime.sendMessage({ type: "GET_STATE" } satisfies RuntimeMessage)) as RuntimeResponse<{
      settings: ExtensionSettings;
      stats: LearningStats;
    }>;
    if (!response.ok || !response.data) throw new Error(response.error || "无法读取设置");
    return response.data;
  }

  private async start(): Promise<void> {
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

  private restore(): void {
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

  private observe(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      if (!this.active) return;
      if (
        mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE,
          ),
        )
      ) {
        this.scheduleScan();
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) window.clearTimeout(this.scanTimer);
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      void this.scan();
    }, 350);
  }

  private onScroll = (): void => {
    if (this.active) this.scheduleScan();
  };

  private isEligible(node: Text): boolean {
    const text = node.textContent?.trim() ?? "";
    if (text.length < 8 || text.length > 600 || !/[\u3400-\u9fff]/.test(text)) return false;
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED_SELECTOR)) return false;
    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = parent.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= -500 && rect.top <= innerHeight + 500;
  }

  private collectNodes(): Text[] {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (this.isEligible(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode()) && nodes.length < 48) nodes.push(current as Text);
    return nodes;
  }

  private async scan(): Promise<void> {
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

  private async processBatch(nodes: Text[]): Promise<void> {
    if (!this.settings) return;
    const entries = nodes.map((node) => ({
      id: `node-${Date.now().toString(36)}-${this.counter++}`,
      node,
      text: node.textContent ?? "",
    }));
    const items: TextItem[] = entries.map(({ id, text }) => ({ id, text }));
    let aiItems: EnhancedItem[] = [];
    if (this.settings.provider.mode === "hybrid") {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: "ENHANCE_BATCH",
          items,
        } satisfies RuntimeMessage)) as RuntimeResponse<EnhancedItem[]>;
        if (response.ok && response.data) aiItems = response.data;
      } catch {
        // Local replacements remain available when the provider is offline.
      }
    }

    const exposedWords: string[] = [];
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
        words: exposedWords,
      } satisfies RuntimeMessage);
    }
  }

  private buildEnhancedFragment(text: string, replacements: Replacement[]): DocumentFragment {
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

  private apply(id: string, node: Text, original: string, replacements: Replacement[]): void {
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

  private onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element) {
      const word = target.closest<HTMLElement>(".gradual-read-word");
      if (word) {
        event.stopPropagation();
        this.showCard(word);
        return;
      }
      if (!target.closest("#gradual-read-card-host")) this.hideCard();
    }
  };

  private showCard(word: HTMLElement): void {
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
      ["认识", "known"],
      ["太难", "hard"],
    ] as const) {
      const button = document.createElement("button");
      button.textContent = label;
      button.addEventListener("click", () => {
        void chrome.runtime.sendMessage({
          type: "UPDATE_WORD_FEEDBACK",
          word: word.textContent ?? "",
          status,
        } satisfies RuntimeMessage);
        this.hideCard();
      });
      actions.append(button);
    }
    card.append(target, source, actions);
    shadow.append(style, card);
    document.documentElement.append(host);
    this.cardHost = host;
  }

  private hideCard(): void {
    this.cardHost?.remove();
    this.cardHost = null;
  }
}

if (!window.__gradualReadLoaded) {
  window.__gradualReadLoaded = true;
  const controller = new GradualReadController();

  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "PING") {
      sendResponse({ ok: true, data: controller.getStatus() } satisfies RuntimeResponse);
      return false;
    }
    if (message.type === "TOGGLE_ENHANCEMENT") {
      void controller
        .toggle()
        .then((data) => sendResponse({ ok: true, data } satisfies RuntimeResponse))
        .catch((error: unknown) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
      return true;
    }
    if (message.type === "SETTINGS_UPDATED") {
      void controller.refreshSettings();
      sendResponse({ ok: true } satisfies RuntimeResponse);
      return false;
    }
    return false;
  });

  void controller.initialize();
}
