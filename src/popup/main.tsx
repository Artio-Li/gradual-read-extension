import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CEFR_OPTIONS, type CefrLevel } from "../shared/cefr";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type {
  AiDiagnostics,
  ExtensionSettings,
  ExtensionState,
  ProviderPreset,
  RuntimeMessage,
  RuntimeResponse,
} from "../shared/types";

function send<T>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>;
}

async function currentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function originPattern(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}/*`;
}

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState("");
  const [supported, setSupported] = useState(false);
  const [notice, setNotice] = useState("正在读取页面状态…");
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<AiDiagnostics | null>(null);

  const autoEnabled = useMemo(() => settings.autoSites.includes(origin), [settings.autoSites, origin]);

  useEffect(() => {
    void (async () => {
      const [stateResponse, statusResponse, tab] = await Promise.all([
        send<ExtensionState>({ type: "GET_STATE" }),
        send<{ active: boolean }>({ type: "GET_ACTIVE_TAB_STATUS" }),
        currentTab(),
      ]);
      if (stateResponse.ok && stateResponse.data) {
        setSettings(stateResponse.data.settings);
        setDiagnostics(stateResponse.data.aiDiagnostics);
      }
      if (statusResponse.ok && statusResponse.data) setActive(statusResponse.data.active);
      if (tab?.url && /^https?:/.test(tab.url)) {
        setSupported(true);
        setOrigin(new URL(tab.url).origin);
        setNotice("准备好了。本地模式不需要 API Key。");
      } else {
        setNotice("当前页面不允许扩展注入，请打开普通网页。");
      }
    })();
  }, []);

  async function toggle(): Promise<void> {
    setBusy(true);
    const response = await send<{ active: boolean }>({ type: "TOGGLE_ACTIVE_TAB" });
    setBusy(false);
    if (response.ok && response.data) {
      setActive(response.data.active);
      setNotice(response.data.active ? "已改造当前页面。" : "已恢复原文。");
    } else setNotice(response.error || "切换失败");
  }

  async function save(): Promise<void> {
    setBusy(true);
    try {
      if (settings.provider.mode === "hybrid") {
        const granted = await chrome.permissions.request({
          origins: [originPattern(settings.provider.baseUrl)],
        });
        if (!granted) throw new Error("未获得模型接口的访问权限");
      }
      const response = await send<ExtensionSettings>({ type: "SAVE_SETTINGS", settings });
      if (!response.ok || !response.data) throw new Error(response.error || "保存失败");
      setSettings(response.data);
      setNotice("设置已保存，当前页面会使用新配置重新处理。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(): Promise<void> {
    if (!origin) return;
    setBusy(true);
    try {
      if (!autoEnabled) {
        const granted = await chrome.permissions.request({ origins: [originPattern(origin)] });
        if (!granted) throw new Error("未获得当前网站的自动运行权限");
      }
      const response = await send<ExtensionSettings>({
        type: autoEnabled ? "UNREGISTER_AUTO_SITE" : "REGISTER_AUTO_SITE",
        origin,
      });
      if (!response.ok || !response.data) throw new Error(response.error || "更新失败");
      setSettings(response.data);
      setNotice(autoEnabled ? "已关闭本网站自动运行。" : "下次打开本网站时会自动运行。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testConnection(): Promise<void> {
    setBusy(true);
    try {
      const granted = await chrome.permissions.request({
        origins: [originPattern(settings.provider.baseUrl)],
      });
      if (!granted) throw new Error("未获得模型接口访问权限");
      const saved = await send<ExtensionSettings>({ type: "SAVE_SETTINGS", settings });
      if (!saved.ok) throw new Error(saved.error || "保存失败");
      const response = await send<string>({ type: "TEST_PROVIDER" });
      if (!response.ok) throw new Error(response.error || "连接测试失败");
      setNotice(response.data || "连接成功");
      const refreshed = await send<ExtensionState>({ type: "GET_STATE" });
      if (refreshed.ok && refreshed.data) setDiagnostics(refreshed.data.aiDiagnostics);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function selectPreset(preset: ProviderPreset): void {
    const provider = { ...settings.provider, preset };
    if (preset === "deepseek") {
      provider.baseUrl = "https://api.deepseek.com";
      provider.model = "deepseek-flash";
      provider.timeoutMs = 18_000;
    } else if (preset === "ollama") {
      provider.baseUrl = "http://localhost:11434/v1";
      provider.model = "qwen2.5:7b";
      provider.timeoutMs = 30_000;
    }
    setSettings({ ...settings, provider });
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">网页英语学习助手</p>
          <h1>渐读</h1>
        </div>
        <span className={`status ${active ? "is-active" : ""}`}>{active ? "运行中" : "未运行"}</span>
      </header>

      <button className="primary" disabled={!supported || busy} onClick={() => void toggle()}>
        {busy ? "处理中…" : active ? "恢复当前页面" : "改造当前页面"}
      </button>

      <label className="switch-row">
        <span>
          <strong>在这个网站自动运行</strong>
          <small>{origin || "仅支持普通网页"}</small>
        </span>
        <input type="checkbox" checked={autoEnabled} disabled={!supported || busy} onChange={() => void toggleAuto()} />
      </label>

      <section>
        <div className="section-heading">
          <h2>词汇难度</h2>
          <span>CEFR {settings.cefrLevel}</span>
        </div>
        <label>
          目标等级
          <select
            value={settings.cefrLevel}
            onChange={(event) =>
              setSettings({ ...settings, cefrLevel: event.target.value as CefrLevel })
            }
          >
            {CEFR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid two">
          <label>
            替换密度
            <select
              value={settings.intensity}
              onChange={(event) =>
                setSettings({ ...settings, intensity: event.target.value as ExtensionSettings["intensity"] })
              }
            >
              <option value="gentle">轻度</option>
              <option value="balanced">标准</option>
              <option value="immersive">沉浸</option>
            </select>
          </label>
          <label>
            显示方式
            <select
              value={settings.displayMode}
              onChange={(event) =>
                setSettings({ ...settings, displayMode: event.target.value as ExtensionSettings["displayMode"] })
              }
            >
              <option value="mixed">中英混合</option>
              <option value="bilingual">原文 + 混合</option>
              <option value="original">仅原文</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>增强引擎</h2>
          <span>{settings.provider.mode === "local" ? "零费用" : "自备接口"}</span>
        </div>
        <label>
          模式
          <select
            value={settings.provider.mode}
            onChange={(event) =>
              setSettings({
                ...settings,
                provider: { ...settings.provider, mode: event.target.value as "local" | "hybrid" },
              })
            }
          >
            <option value="local">仅本地词表</option>
            <option value="hybrid">本地 + AI 语境增强</option>
          </select>
        </label>

        {settings.provider.mode === "hybrid" && (
          <div className="provider-fields">
            <label>
              接口预设
              <select
                value={settings.provider.preset}
                onChange={(event) => selectPreset(event.target.value as ProviderPreset)}
              >
                <option value="deepseek">DeepSeek 官方 API（快速模式）</option>
                <option value="ollama">本地 Ollama</option>
                <option value="custom">其他 OpenAI-compatible 接口</option>
              </select>
            </label>
            <label>
              OpenAI-compatible Base URL
              <input
                value={settings.provider.baseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={(event) =>
                  setSettings({ ...settings, provider: { ...settings.provider, baseUrl: event.target.value } })
                }
              />
            </label>
            <label>
              模型
              <input
                value={settings.provider.model}
                placeholder="qwen2.5:7b"
                onChange={(event) =>
                  setSettings({ ...settings, provider: { ...settings.provider, model: event.target.value } })
                }
              />
            </label>
            <label>
              API Key（Ollama 可留空）
              <input
                type="password"
                value={settings.provider.apiKey}
                placeholder="sk-…"
                onChange={(event) =>
                  setSettings({ ...settings, provider: { ...settings.provider, apiKey: event.target.value } })
                }
              />
            </label>
            <label>
              请求超时
              <select
                value={settings.provider.timeoutMs}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    provider: { ...settings.provider, timeoutMs: Number(event.target.value) },
                  })
                }
              >
                <option value={10_000}>10 秒</option>
                <option value={18_000}>18 秒</option>
                <option value={30_000}>30 秒</option>
                <option value={60_000}>60 秒</option>
              </select>
            </label>
            <button className="secondary" disabled={busy} onClick={() => void testConnection()}>
              测试连接
            </button>
            {diagnostics && (
              <p className={`diagnostics ${diagnostics.status === "error" ? "is-error" : ""}`}>
                最近请求：{(diagnostics.durationMs / 1000).toFixed(1)} 秒
                {diagnostics.cacheHit ? " · 命中缓存" : ""}
                {diagnostics.message ? ` · ${diagnostics.message}` : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <button className="save" disabled={busy} onClick={() => void save()}>
        保存设置
      </button>
      <button className="text-button" onClick={() => void chrome.runtime.openOptionsPage()}>
        打开学习中心 · 生词本与自定义词表
      </button>
      <p className="notice">{notice}</p>
      <footer>不会处理输入框、密码框或网页编辑器；AI 模式只发送待改造的短文本。</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
