# Contributing

## 开发流程

1. 从 `main` 创建短生命周期分支。
2. 修改代码并补充与行为对应的测试。
3. 运行 `npm run verify`。
4. 如果涉及发布，运行 `npm run package` 并在 Chrome 中加载生产构建验证。
5. 提交时使用清晰、可追踪的说明。

## 代码约定

- TypeScript 保持严格模式，不使用远程加载代码。
- 新权限必须有明确功能目的，并同步更新隐私说明。
- AI 返回内容必须经过原文子串、范围和重叠校验后才能进入页面。
- 词表条目应避免歧义严重的单字，CEFR 等级只作为参考难度。
- 不提交真实 API Key、用户学习数据、浏览内容或构建压缩包。

## 发布检查

版本号应同时更新 `package.json`、`package-lock.json`、`manifest.json` 和 `CHANGELOG.md`。
