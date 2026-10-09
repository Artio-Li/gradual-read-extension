# 渐读｜网页英语学习助手

渐读是一个本地优先的 Chrome Manifest V3 扩展，把日常中文网页逐步变成低压力、可理解的英语接触环境。

它是独立实现，不包含或复制任何商业扩展的源代码、素材、提示词或私有词库。

## 功能

- 在普通网页上按需启用，随时一键恢复原文
- 340 条内置中英词汇与短语，覆盖 A1–C2 参考难度
- 支持轻度、标准、沉浸三档替换密度
- 支持中英混合、原文 + 混合、仅原文三种显示方式
- 本地结果即时展示，AI 结果异步补充
- DeepSeek 官方 API 快速预设：关闭思考模式、JSON 输出、超时和失败重试
- OpenAI-compatible API 与本地 Ollama
- 正文缓存、批次并发和最近请求耗时诊断
- 悬停释义、英文朗读、认识/太难反馈
- 学习中心、生词本、简易间隔复习和学习统计
- 自定义词条、数据导入导出、AI 缓存清理
- 动态 DOM、SPA 页面增量处理和按网站授权自动运行

> 内置 CEFR 等级是用于渐进阅读的参考分级，并非 Cambridge、Council of Europe 或其他机构认证的官方词表。

## 安装与开发

要求 Node.js 20+、npm 10+、Chrome 120+。

```bash
npm install
npm run verify
```

开发构建输出到 `dist/`：

```bash
npm run build
```

然后打开 `chrome://extensions/`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择项目的 `dist/` 目录。

生成可提交 Chrome Web Store 的压缩包：

```bash
npm run package
```

产物位于 `artifacts/gradual-read-v<version>.zip`。发布准备清单见 [Chrome Web Store 发布指南](docs/CHROME_WEB_STORE.md)。

## DeepSeek 配置

在扩展弹窗中选择：

1. 增强引擎：`本地 + AI 语境增强`
2. 接口预设：`DeepSeek 官方 API（快速模式）`
3. 填入自己的 API Key
4. 保存后测试连接

预设会自动填写官方 Base URL 和适合短文本增强的模型，并限制输出与等待时间。API Key 仅保存在本机 `chrome.storage.local`。

## 数据与隐私

- 本地模式不会发送网页内容。
- AI 模式只发送当前批次中需要处理的短文本。
- 不收集账号、浏览历史、分析数据或遥测数据。
- API Key 不会包含在备份文件中。
- 输入框、密码框、代码块和网页编辑器默认不处理。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 项目结构

```text
src/background/   扩展后台、AI 接口、缓存与数据操作
src/content/      页面文本扫描、替换、动态页面兼容
src/popup/        浏览器工具栏弹窗
src/options/      学习中心与数据管理
src/shared/       类型、设置迁移、CEFR 与词表引擎
tests/            核心引擎测试
scripts/          构建与商店打包
public/           扩展静态资源与图标
docs/             架构和发布文档
```

更详细的技术说明见 [架构文档](docs/ARCHITECTURE.md)。

## 常用命令

```bash
npm run check      # TypeScript 类型检查
npm test           # 单元测试
npm run build      # 开发构建，包含 source map
npm run verify     # 类型检查 + 测试 + 构建
npm run package    # 生产构建并生成商店 zip
```

## 安全

如果发现安全问题，请不要创建公开 Issue，处理方式见 [SECURITY.md](SECURITY.md)。

## 当前状态

项目当前版本为 `0.2.0`，适合个人日常使用与 Private Chrome Web Store 测试。视频字幕、PDF 专项适配、多设备云同步和 Firefox 版本仍在后续规划中。

## 许可

当前仓库用于个人项目开发，尚未授予公开复制、修改或再分发许可。
