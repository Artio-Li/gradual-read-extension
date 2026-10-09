# 架构说明

## 运行结构

```text
Popup / Options
       │ runtime messages
       ▼
Background service worker ─── OpenAI-compatible API
       │                            │
       │ settings / cache           │ validated JSON
       ▼                            ▼
chrome.storage.local          Replacement[]
       ▲                            │
       │ runtime messages           │
       └──────── Content script ◀───┘
                    │
                    ▼
             visible text nodes
```

## 本地替换

内容脚本只处理视口附近的普通中文文本节点。引擎按以下顺序选择词条：

1. 合并内置词表和用户自定义词表；同一中文原文由自定义词条覆盖。
2. 排除高于目标 CEFR 的条目。
3. 优先完整短语，避免与更长表达重叠。
4. 根据目标等级、认识/太难反馈、接触次数和稳定哈希评分。
5. 按替换密度限制单个文本节点的替换数量。

## AI 增强

本地结果不会等待网络。启用混合模式后，内容脚本先渲染本地替换，只把尚未达到当前密度上限的文本交给 AI。请求按最多 6 个节点、合计最多 1,200 个字符自适应分批，最多 3 批并发。

后台使用正文、CEFR、密度、接口与模型生成稳定缓存键，不使用临时 DOM ID。模型返回只接受与输入 ID 匹配的项目；内容脚本随后再次校验原文子串、UTF-16 范围和替换重叠。

DeepSeek 预设使用非思考模式、JSON Output、动态输出预算和请求超时。模型返回被截断或 JSON 不完整时，先提高输出预算重试；仍失败则把批次自动拆半。网络错误与可重试 HTTP 状态只重试一次。

## 动态页面

MutationObserver 监听新增节点和 `characterData`，只把发生变化的局部节点加入扫描队列。滚动时会补扫视口附近内容。扩展自身生成的节点、编辑器、表单、代码和隐藏内容会被排除。

## 存储

所有持久化数据位于 `chrome.storage.local`：

- `gradualReadSettings`
- `gradualReadStats`
- `gradualReadCustomLexicon`
- `gradualReadAiCache`
- `gradualReadAiDiagnostics`

旧版 `linguaWeaveSettings` 与 `linguaWeaveStats` 会在读取时迁移。
