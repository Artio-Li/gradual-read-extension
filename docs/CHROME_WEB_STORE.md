# Chrome Web Store 发布指南

## 推荐分发方式

个人使用建议选择 **Private**，把自己的 Google 账号加入 Trusted Testers。若需要通过链接分享，可选择 **Unlisted**。两种可见性都需要遵守相同政策并经过审核。

官方资料：

- <https://developer.chrome.com/docs/webstore/register/>
- <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution>
- <https://developer.chrome.com/docs/webstore/prepare>

## 发布前检查

1. 运行 `npm ci` 和 `npm run verify`。
2. 在 Chrome 中加载 `dist/`，验证本地、DeepSeek、学习中心、自动运行和恢复原文。
3. 更新版本号与 `CHANGELOG.md`。
4. 运行 `npm run package`。
5. 确认 zip 根目录直接包含 `manifest.json`，不包含 source map、API Key 或个人数据。
6. 在开发者控制台上传 `artifacts/gradual-read-v<version>.zip`。
7. 填写商店说明和隐私字段，文案见 `docs/STORE_LISTING.md`。
8. 上传 128×128 图标和商店截图，素材规范见 `docs/store-assets/README.md`。
9. 选择 Private，并配置 Trusted Testers。
10. 提交审核；审核通过后从商店安装并关闭开发者模式复测。

## 权限说明

- `storage`：保存本地设置、学习记录、词表和缓存。
- `activeTab`：用户点击“改造当前页面”时访问当前页面。
- `scripting`：注入页面处理脚本和样式。
- `optional_host_permissions`：按需授权自动运行的网站和用户配置的 AI 接口，不在安装时申请全部网页权限。

## 提交前仍需人工准备

- 可公开访问的隐私政策 URL
- 至少一张真实产品截图
- Chrome Web Store 开发者账号和一次性注册费
- 支持邮箱

仓库当前为私有时，不能直接把私有 GitHub 文件 URL 当作公开隐私政策页面。
