import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CEFR_LEVELS, CEFR_OPTIONS } from "../shared/cefr";
import type {
  CustomLexiconEntry,
  ExportedData,
  ExtensionState,
  FeedbackStatus,
  RuntimeMessage,
  RuntimeResponse,
  WordFeedbackInput,
  WordStat,
} from "../shared/types";

type Filter = "all" | "due" | "hard" | "known";

function send<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "尚未安排";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(timestamp);
}

function wordEntry(key: string, stat: WordStat): WordFeedbackInput {
  return {
    source: stat.source ?? "",
    target: stat.target ?? key,
    gloss: stat.gloss ?? stat.source ?? "",
    difficulty: stat.difficulty ?? 3,
  };
}

function App(): React.JSX.Element {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ source: "", target: "", gloss: "", level: 3 });
  const importInput = useRef<HTMLInputElement>(null);

  async function refresh(): Promise<void> {
    const response = await send<ExtensionState>({ type: "GET_STATE" });
    if (response.ok && response.data) setState(response.data);
    else setNotice(response.error || "读取数据失败");
  }

  useEffect(() => {
    void refresh();
  }, []);

  const words = useMemo(() => {
    if (!state) return [];
    const now = Date.now();
    return Object.entries(state.stats)
      .filter(([key, stat]) => {
        const haystack = `${key} ${stat.target ?? ""} ${stat.source ?? ""} ${stat.gloss ?? ""}`.toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) return false;
        if (filter === "due") return Boolean(stat.nextReviewAt && stat.nextReviewAt <= now);
        if (filter === "hard" || filter === "known") return stat.status === filter;
        return true;
      })
      .sort((left, right) => {
        const leftDue = left[1].nextReviewAt && left[1].nextReviewAt <= now ? 1 : 0;
        const rightDue = right[1].nextReviewAt && right[1].nextReviewAt <= now ? 1 : 0;
        return rightDue - leftDue || (right[1].lastSeenAt ?? 0) - (left[1].lastSeenAt ?? 0);
      });
  }, [filter, query, state]);

  const metrics = useMemo(() => {
    const entries = state ? Object.values(state.stats) : [];
    const now = Date.now();
    return {
      total: entries.length,
      exposures: entries.reduce((sum, item) => sum + item.exposures, 0),
      known: entries.filter((item) => item.status === "known").length,
      due: entries.filter((item) => item.nextReviewAt && item.nextReviewAt <= now).length,
    };
  }, [state]);

  async function mark(key: string, stat: WordStat, status: FeedbackStatus): Promise<void> {
    setBusy(true);
    const response = await send({ type: "UPDATE_WORD_FEEDBACK", entry: wordEntry(key, stat), status });
    if (!response.ok) setNotice(response.error || "更新失败");
    await refresh();
    setBusy(false);
  }

  async function removeWord(key: string): Promise<void> {
    const response = await send({ type: "DELETE_WORD", word: key });
    if (!response.ok) setNotice(response.error || "删除失败");
    await refresh();
  }

  async function addCustomEntry(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    const response = await send<CustomLexiconEntry[]>({ type: "ADD_CUSTOM_LEXICON_ENTRY", entry: draft });
    if (response.ok) {
      setDraft({ source: "", target: "", gloss: "", level: 3 });
      setNotice("自定义词条已保存，并会优先于内置词表。");
      await refresh();
    } else setNotice(response.error || "保存词条失败");
    setBusy(false);
  }

  async function removeCustomEntry(id: string): Promise<void> {
    const response = await send<CustomLexiconEntry[]>({ type: "DELETE_CUSTOM_LEXICON_ENTRY", id });
    if (!response.ok) setNotice(response.error || "删除词条失败");
    await refresh();
  }

  async function exportBackup(): Promise<void> {
    const response = await send<ExportedData>({ type: "EXPORT_DATA" });
    if (!response.ok || !response.data) {
      setNotice(response.error || "导出失败");
      return;
    }
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gradual-read-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("备份已导出。出于安全考虑，文件不包含 API Key。");
  }

  async function importBackup(file?: File): Promise<void> {
    if (!file) return;
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const response = await send({ type: "IMPORT_DATA", payload });
      if (!response.ok) throw new Error(response.error || "导入失败");
      await refresh();
      setNotice("备份导入完成，现有 API Key 已保留。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function clearLearningData(): Promise<void> {
    if (!window.confirm("确定清空全部学习记录吗？自定义词表和设置会保留。")) return;
    await send({ type: "CLEAR_LEARNING_DATA" });
    await refresh();
    setNotice("学习记录已清空。");
  }

  async function clearAiCache(): Promise<void> {
    await send({ type: "CLEAR_AI_CACHE" });
    await refresh();
    setNotice("AI 缓存与最近诊断已清空。");
  }

  if (!state) return <main className="loading">正在载入学习数据…</main>;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">GRADUAL READ</p>
          <h1>渐读学习中心</h1>
          <p>管理生词、复习节奏、自定义词表和本地数据。</p>
        </div>
        <button className="ghost" onClick={() => window.close()}>关闭</button>
      </header>

      <section className="metrics" aria-label="学习概览">
        <article><strong>{metrics.total}</strong><span>接触词汇</span></article>
        <article><strong>{metrics.exposures}</strong><span>累计出现</span></article>
        <article><strong>{metrics.known}</strong><span>已认识</span></article>
        <article><strong>{metrics.due}</strong><span>待复习</span></article>
      </section>

      <div className="layout">
        <section className="panel wordbook">
          <div className="panel-heading">
            <div><h2>生词本</h2><p>“认识”会延长复习间隔，“太难”会在 6 小时后重新出现。</p></div>
            <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词或中文" />
          </div>
          <div className="filters">
            {(["all", "due", "hard", "known"] as const).map((value) => (
              <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {{ all: "全部", due: "待复习", hard: "太难", known: "认识" }[value]}
              </button>
            ))}
          </div>
          <div className="word-list">
            {words.length === 0 && <p className="empty">还没有符合条件的词。浏览网页并点击英文词汇即可积累学习记录。</p>}
            {words.map(([key, stat]) => (
              <article className="word-row" key={key}>
                <div className="word-main">
                  <strong>{stat.target ?? key}</strong>
                  <span>{stat.source || "—"}{stat.gloss && stat.gloss !== stat.source ? ` · ${stat.gloss}` : ""}</span>
                </div>
                <div className="word-meta">
                  <span>出现 {stat.exposures} 次</span>
                  <span>下次：{formatDate(stat.nextReviewAt)}</span>
                </div>
                <div className="row-actions">
                  <button disabled={busy} onClick={() => void mark(key, stat, "known")}>记得</button>
                  <button disabled={busy} onClick={() => void mark(key, stat, "hard")}>再学</button>
                  <button className="danger" onClick={() => void removeWord(key)}>移除</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside>
          <section className="panel">
            <div className="panel-heading"><div><h2>自定义词表</h2><p>同一中文词条会覆盖内置翻译。</p></div></div>
            <form className="lexicon-form" onSubmit={(event) => void addCustomEntry(event)}>
              <label>中文原文<input required value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="例如：部署" /></label>
              <label>英文表达<input required value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })} placeholder="deployment" /></label>
              <label>中文释义<input value={draft.gloss} onChange={(event) => setDraft({ ...draft, gloss: event.target.value })} placeholder="部署、发布" /></label>
              <label>参考难度<select value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })}>{CEFR_OPTIONS.map((item, index) => <option key={item.value} value={index + 1}>{item.label}</option>)}</select></label>
              <button className="primary" disabled={busy}>添加词条</button>
            </form>
            <div className="custom-list">
              {state.customLexicon.slice(0, 30).map((entry) => (
                <div key={entry.id}><span><strong>{entry.source}</strong> → {entry.target} <small>{CEFR_LEVELS[entry.level - 1]}</small></span><button onClick={() => void removeCustomEntry(entry.id)}>删除</button></div>
              ))}
              {state.customLexicon.length === 0 && <p className="empty compact">暂无自定义词条。</p>}
            </div>
          </section>

          <section className="panel data-panel">
            <div className="panel-heading"><div><h2>数据与隐私</h2><p>所有学习数据保存在当前浏览器。本地模式不会发送网页文字。</p></div></div>
            <button onClick={() => void exportBackup()}>导出备份</button>
            <button onClick={() => importInput.current?.click()}>导入备份</button>
            <input ref={importInput} hidden type="file" accept="application/json" onChange={(event) => void importBackup(event.target.files?.[0])} />
            <button onClick={() => void clearAiCache()}>清除 AI 缓存</button>
            <button className="danger" onClick={() => void clearLearningData()}>清空学习记录</button>
          </section>
        </aside>
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}
      <footer>内置 CEFR 等级为学习参考分级，并非官方认证词表。AI 模式会将待处理的短文本发送到你配置的接口。</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
