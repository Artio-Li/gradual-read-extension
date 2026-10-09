import { createLocalReplacements, mergeReplacements, normalizeAiReplacements } from "../shared/engine";
import type {
  CustomLexiconEntry,
  EnhancedItem,
  ExtensionSettings,
  ExtensionState,
  LearningStats,
  Replacement,
  RuntimeMessage,
  RuntimeResponse,
  TextItem,
  WordFeedbackInput,
} from "../shared/types";

declare global {
  interface Window {
    __gradualReadLoaded?: boolean;
  }
}

interface ProcessedNode {
  wrapper: HTMLSpanElement;
  original: string;
  replacements: Replacement[];
}

interface NodeEntry {
  id: string;
  node: Text;
  text: string;
  local: Replacement[];
}

const MAX_NODES_PER_SCAN = 72;
const AI_BATCH_SIZE = 12;
const AI_CONCURRENCY = 2;

function formatMeaning(source: string, gloss: string): string {
  const normalizedSource = source.trim();
  const normalizedGloss = gloss.trim();
  if (!normalizedGloss || normalizedGloss === normalizedSource) return normalizedSource;
  return `${normalizedSource} · ${normalizedGloss}`;
}

function toFeedbackInput(replacement: Replacement): WordFeedbackInput {
  return {
    source: replacement.source,
    target: replacement.target,
    gloss: replacement.gloss,
    difficulty: replacement.difficulty,
  };
}

async function runWithConcurrency<T>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await worker(values[index]);
    }
  });
  await Promise.all(runners);
}

const EXCLUDED_SELECTOR = [
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
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
  "[aria-hidden='true']",
  ".CodeMirror",
  ".monaco-editor",
  "[data-gradual-read-node]",
  "#gradual-read-card-host",
].join(",");

class GradualReadController {
  private active = false;
  private processing = false;
  private scanQueued = false;
  private generation = 0;
  private counter = 0;
  private observer: MutationObserver | null = null;
  private scanTimer: number | null = null;
  private processed = new Map<string, ProcessedNode>();
  private seenNodes = new WeakMap<Text, string>();
  private pendingRoots = new Set<Node>();
  private settings: ExtensionSettings | null = null;
  private stats: LearningStats = {};
  private customLexicon: CustomLexiconEntry[] = [];
  private cardHost: HTMLDivElement | null = null;
  private cardWord: HTMLElement | null = null;

  constructor() {
    document.addEventListener("click", this.onDocumentClick, true);
    document.addEventListener("keydown", this.onDocumentKeydown, true);
    window.addEventListener("scroll", this.onScroll, { passive: true });
  }

  async initialize(): Promise<void> {
    const state = await this.getState();
    this.applyState(state);
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
    this.applyState(state);
    if (this.active) {
      this.restore();
      if (state.settings.displayMode !== "original") await this.start();
    }
  }

  private applyState(state: ExtensionState): void {
    this.settings = state.settings;
    this.stats = state.stats;
    this.customLexicon = state.customLexicon ?? [];
  }

  private async getState(): Promise<ExtensionState> {
    const response = (await chrome.runtime.sendMessage({ type: "GET_STATE" } satisfies RuntimeMessage)) as RuntimeResponse<ExtensionState>;
    if (!response.ok || !response.data) throw new Error(response.error || "无法读取设置");
    return response.data;
  }

  private async start(): Promise<void> {
    if (!this.settings) this.applyState(await this.getState());
    if (!this.settings || this.settings.displayMode === "original") return;
    this.active = true;
    this.generation += 1;
    this.observe();
    this.pendingRoots.add(document.body);
    await this.scan();
  }

  private restore(): void {
    this.active = false;
    this.generation += 1;
    this.observer?.disconnect();
    this.observer = null;
    if (this.scanTimer !== null) window.clearTimeout(this.scanTimer);
    this.scanTimer = null;
    this.scanQueued = false;
    this.pendingRoots.clear();
    for (const { wrapper, original } of this.processed.values()) {
      if (wrapper.isConnected) wrapper.replaceWith(document.createTextNode(original));
    }
    this.processed.clear();
    this.seenNodes = new WeakMap<Text, string>();
    this.hideCard();
  }

  private isInsideOwnNode(node: Node): boolean {
    const element = node instanceof Element ? node : node.parentElement;
    return Boolean(element?.closest("[data-gradual-read-node], #gradual-read-card-host"));
  }

  private observe(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      if (!this.active) return;
      let queued = false;
      for (const mutation of mutations) {
        if (this.isInsideOwnNode(mutation.target)) continue;
        if (mutation.type === "characterData" && mutation.target instanceof Text) {
          this.seenNodes.delete(mutation.target);
          this.pendingRoots.add(mutation.target);
          queued = true;
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (this.isInsideOwnNode(node)) continue;
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            this.pendingRoots.add(node);
            queued = true;
          }
        }
      }
      if (queued) this.scheduleScan();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private scheduleScan(): void {
    if (this.processing) {
      this.scanQueued = true;
      return;
    }
    if (this.scanTimer !== null) window.clearTimeout(this.scanTimer);
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null;
      void this.scan();
    }, 250);
  }

  private onScroll = (): void => {
    if (!this.active) return;
    this.pendingRoots.add(document.body);
    this.scheduleScan();
  };

  private isEligible(node: Text): boolean {
    const raw = node.textContent ?? "";
    if (this.seenNodes.get(node) === raw) return false;
    const text = raw.trim();
    if (text.length < 8 || text.length > 600 || !/[\u3400-\u9fff]/.test(text)) return false;
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED_SELECTOR)) return false;
    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = parent.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= -600 && rect.top <= innerHeight + 600;
  }

  private collectNodes(): Text[] {
    const roots = this.pendingRoots.size > 0 ? Array.from(this.pendingRoots) : [document.body];
    this.pendingRoots.clear();
    const nodes: Text[] = [];
    const unique = new Set<Text>();

    const add = (node: Text): boolean => {
      if (!unique.has(node) && this.isEligible(node)) {
        unique.add(node);
        nodes.push(node);
      }
      return nodes.length >= MAX_NODES_PER_SCAN;
    };

    for (const root of roots) {
      if (!root.isConnected || this.isInsideOwnNode(root)) continue;
      if (root instanceof Text) {
        if (add(root)) break;
        continue;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (this.isEligible(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      let current: Node | null;
      while ((current = walker.nextNode())) {
        if (add(current as Text)) break;
      }
      if (nodes.length >= MAX_NODES_PER_SCAN) {
        this.pendingRoots.add(root);
        this.scanQueued = true;
        break;
      }
    }
    return nodes;
  }

  private async scan(): Promise<void> {
    if (!this.active || !this.settings) return;
    if (this.processing) {
      this.scanQueued = true;
      return;
    }
    this.processing = true;
    const generation = this.generation;
    try {
      const nodes = this.collectNodes();
      const entries: NodeEntry[] = nodes.map((node) => {
        const text = node.textContent ?? "";
        this.seenNodes.set(node, text);
        return {
          id: `node-${this.counter++}`,
          node,
          text,
          local: createLocalReplacements(text, this.settings!, this.stats, this.customLexicon),
        };
      });

      const localExposures: Replacement[] = [];
      for (const entry of entries) {
        if (entry.local.length === 0 || !entry.node.isConnected || entry.node.textContent !== entry.text) continue;
        this.apply(entry.id, entry.node, entry.text, entry.local);
        localExposures.push(...entry.local);
      }
      this.recordExposures(localExposures);

      if (this.settings.provider.mode === "hybrid" && entries.length > 0) {
        const batches: NodeEntry[][] = [];
        for (let offset = 0; offset < entries.length; offset += AI_BATCH_SIZE) {
          batches.push(entries.slice(offset, offset + AI_BATCH_SIZE));
        }
        await runWithConcurrency(batches, AI_CONCURRENCY, async (batch) => {
          await this.enhanceBatch(batch, generation);
        });
      }
    } finally {
      this.processing = false;
      if (this.scanQueued && this.active) {
        this.scanQueued = false;
        this.scheduleScan();
      }
    }
  }

  private async enhanceBatch(entries: NodeEntry[], generation: number): Promise<void> {
    const items: TextItem[] = entries.map(({ id, text }) => ({ id, text }));
    let aiItems: EnhancedItem[] = [];
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "ENHANCE_BATCH",
        items,
      } satisfies RuntimeMessage)) as RuntimeResponse<EnhancedItem[]>;
      if (response.ok && response.data) aiItems = response.data;
    } catch {
      return;
    }
    if (!this.active || generation !== this.generation) return;

    const aiExposures: Replacement[] = [];
    for (const entry of entries) {
      const rawAi = aiItems.find((item) => item.id === entry.id)?.replacements ?? [];
      const ai = normalizeAiReplacements(entry.text, rawAi, entry.local);
      if (ai.length === 0) continue;
      const merged = mergeReplacements(entry.local, ai);
      const processed = this.processed.get(entry.id);
      if (processed?.wrapper.isConnected) {
        processed.replacements = merged;
        this.renderWrapper(processed.wrapper, entry.text, merged);
      } else if (entry.node.isConnected && entry.node.textContent === entry.text) {
        this.apply(entry.id, entry.node, entry.text, merged);
      }
      aiExposures.push(...ai);
    }
    this.recordExposures(aiExposures);
  }

  private recordExposures(replacements: Replacement[]): void {
    if (replacements.length === 0) return;
    const entries = Array.from(
      new Map(replacements.map((replacement) => [replacement.target.toLowerCase(), toFeedbackInput(replacement)])).values(),
    );
    void chrome.runtime.sendMessage({ type: "RECORD_EXPOSURES", entries } satisfies RuntimeMessage);
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
      word.setAttribute("role", "button");
      word.setAttribute("aria-label", `${replacement.target}，${formatMeaning(replacement.source, replacement.gloss)}`);
      fragment.append(word);
      cursor = replacement.end;
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    return fragment;
  }

  private renderWrapper(wrapper: HTMLSpanElement, original: string, replacements: Replacement[]): void {
    if (!this.settings) return;
    wrapper.className = `gradual-read-wrapper gradual-read-${this.settings.displayMode}`;
    wrapper.replaceChildren();
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
  }

  private apply(id: string, node: Text, original: string, replacements: Replacement[]): void {
    const wrapper = document.createElement("span");
    wrapper.dataset.gradualReadNode = id;
    this.renderWrapper(wrapper, original, replacements);
    node.replaceWith(wrapper);
    this.processed.set(id, { wrapper, original, replacements });
  }

  private onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const word = target.closest<HTMLElement>(".gradual-read-word");
    if (!word) return;
    event.preventDefault();
    event.stopPropagation();
    this.showCard(word);
  };

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
    word.classList.add("is-card-open");
    this.cardWord = word;
    const host = document.createElement("div");
    host.id = "gradual-read-card-host";
    const shadow = host.attachShadow({ mode: "open" });
    const rect = word.getBoundingClientRect();
    host.style.left = `${Math.max(12, Math.min(innerWidth - 286, rect.left))}px`;
    host.style.top = `${Math.max(12, Math.min(innerHeight - 174, rect.bottom + 8))}px`;

    const style = document.createElement("style");
    style.textContent = `
      :host { position: fixed; z-index: 2147483647; }
      .card { width: 258px; padding: 14px; color: #eef7f1; background: #13221c; border: 1px solid #375346; border-radius: 14px; box-shadow: 0 18px 48px rgba(0,0,0,.28); font: 13px/1.45 system-ui,sans-serif; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .target { color: #e6c879; font: 600 18px/1.2 Georgia,serif; }
      .speak { flex: 0 0 auto; width: 30px; padding: 4px; border: 0; color: #a9bcb2; background: transparent; }
      .source { margin-top: 5px; color: #a9bcb2; }
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      button { flex: 1; border: 1px solid #4d695b; border-radius: 9px; padding: 7px 9px; color: #eaf3ed; background: #20352b; cursor: pointer; }
      button:hover { border-color: #d7bb6a; color: #f7dda0; }
    `;
    const card = document.createElement("div");
    card.className = "card";
    const head = document.createElement("div");
    head.className = "head";
    const target = document.createElement("div");
    target.className = "target";
    target.textContent = word.textContent ?? "";
    const speak = document.createElement("button");
    speak.className = "speak";
    speak.type = "button";
    speak.title = "朗读英文";
    speak.setAttribute("aria-label", "朗读英文");
    speak.textContent = "🔊";
    speak.addEventListener("click", () => {
      const utterance = new SpeechSynthesisUtterance(word.textContent ?? "");
      utterance.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
    head.append(target, speak);
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
        const entry: WordFeedbackInput = {
          source: word.dataset.source ?? "",
          target: word.textContent ?? "",
          gloss: word.dataset.gloss ?? word.dataset.source ?? "",
          difficulty: Number(word.dataset.difficulty) || 3,
        };
        void chrome.runtime.sendMessage({
          type: "UPDATE_WORD_FEEDBACK",
          entry,
          status,
        } satisfies RuntimeMessage);
        this.stats[entry.target.toLowerCase()] = {
          ...this.stats[entry.target.toLowerCase()],
          exposures: this.stats[entry.target.toLowerCase()]?.exposures ?? 0,
          status,
          updatedAt: Date.now(),
          source: entry.source,
          target: entry.target,
          gloss: entry.gloss,
          difficulty: entry.difficulty,
        };
        this.hideCard();
      });
      actions.append(button);
    }
    card.append(head, source, actions);
    shadow.append(style, card);
    document.documentElement.append(host);
    this.cardHost = host;
  }

  private hideCard(): void {
    this.cardHost?.remove();
    this.cardWord?.classList.remove("is-card-open");
    this.cardHost = null;
    this.cardWord = null;
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
